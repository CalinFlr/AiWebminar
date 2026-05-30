import { execFile, spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import net from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const chromePath = process.env.WA_WEB_CHROME_PATH || defaultChromePath();
const profileDir = process.env.WA_WEB_CHROME_PROFILE || join(__dirname, "..", ".local", "whatsapp-web-chrome-profile");
const execFileAsync = promisify(execFile);
const humanMode = process.env.WA_WEB_HUMAN !== "0";
const actionDelayMin = Number(process.env.WA_WEB_DELAY_MIN || 120);
const actionDelayMax = Number(process.env.WA_WEB_DELAY_MAX || 420);
const keyDelayMin = Number(process.env.WA_WEB_KEY_DELAY_MIN || 18);
const keyDelayMax = Number(process.env.WA_WEB_KEY_DELAY_MAX || 75);

const settings = await loadOpsSettings();
const groups = Object.fromEntries(
  (settings.whatsapp?.targets || [])
    .filter((item) => item.id && item.chatTitle)
    .map((item) => [String(item.id).toLowerCase(), item.chatTitle])
);
const validTargets = Object.keys(groups);

const args = process.argv.slice(2);
const phoneMode = args[0] === "--phone";
const phone = phoneMode ? normalizeWhatsAppPhone(args[1]) : "";
const target = phoneMode ? "" : String(args[0] || "").trim().toLowerCase();
const message = String(phoneMode ? args[2] || "" : args[1] || "");
const mode = String(phoneMode ? args[3] || "--send" : args[2] || "--preview").replace(/^--/, "");

if (phoneMode && !phone) {
  fail(`Usage: node whatsapp-web-cdp.mjs --phone <digits> "Message" [--send]`);
}

if (!phoneMode && !validTargets.includes(target)) {
  fail(`Usage: node whatsapp-web-cdp.mjs <${validTargets.join("|")}> "Message" [--open|--preview|--send] OR node whatsapp-web-cdp.mjs --phone <digits> "Message" [--send]`);
}

if (!["open", "preview", "send"].includes(mode)) {
  fail("Mode must be --open, --preview or --send.");
}

if (phoneMode && mode !== "send") {
  fail("Phone mode supports --send only.");
}

if (mode !== "open" && !message.trim()) {
  fail("Message is required for preview/send.");
}

async function main() {
  await mkdir(profileDir, { recursive: true });

  const existingPort = await findExistingDebugPort();
  const port = existingPort || await freePort();

  if (!existingPort) {
    const chrome = spawn(chromePath, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "https://web.whatsapp.com/"
    ], {
      detached: true,
      stdio: "ignore"
    });
    chrome.unref();
  }

  const pageWsUrl = await waitForPageWebSocket(port);
  const cdp = await CdpClient.connect(pageWsUrl);

  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await ensureWhatsAppPage(cdp);
    await waitForWhatsAppReady(cdp);

    if (phoneMode) {
      await openPhoneChat(cdp, phone);
      console.log(`opened phone ${phone}`);
      await focusMessageBox(cdp);
      await clearFocusedEditable(cdp);
      await typeText(cdp, message);
      console.log(`drafted message for phone ${phone}`);
      await clickSend(cdp);
      console.log(`sent message to phone ${phone}`);
      await cdp.close();
      return;
    }

    const groupName = groups[target];
    await focusSearch(cdp);
    await clearFocusedEditable(cdp);
    await typeText(cdp, groupName);
    await humanPause(900, 1500);
    await clickChatByTitle(cdp, groupName);
    await waitForChat(cdp, groupName);
    console.log(`opened ${groupName}`);

    if (mode === "open") {
      await cdp.close();
      return;
    }

    await focusMessageBox(cdp);
    await clearFocusedEditable(cdp);
    await typeText(cdp, message);
    console.log(`drafted message in ${groupName}`);

    if (mode === "send") {
      await clickSend(cdp);
      console.log(`sent message in ${groupName}`);
    }

    await cdp.close();
  } catch (error) {
    await cdp.close().catch(() => {});
    fail(error.message || String(error));
  }
}

async function loadOpsSettings() {
  try {
    return JSON.parse(await readFile(join(__dirname, "..", "ops-settings.json"), "utf8"));
  } catch (error) {
    fail(`Could not load ops-settings.json: ${error.message}`);
  }
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `40${digits.slice(1)}`;
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

async function findExistingDebugPort() {
  if (process.env.WA_WEB_CDP_PORT) {
    return Number(process.env.WA_WEB_CDP_PORT);
  }

  const { stdout } = await execFileAsync("ps", ["axo", "command"]);
  const profileNeedle = `--user-data-dir=${profileDir}`;
  const line = stdout
    .split("\n")
    .find((processLine) => processLine.includes(profileNeedle) && processLine.includes("--remote-debugging-port="));

  const match = line?.match(/--remote-debugging-port=(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function openPhoneChat(cdp, phone) {
  const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&type=phone_number&app_absent=0`;
  await cdp.send("Page.navigate", { url });
  await sleep(1200);
  await waitForWhatsAppReady(cdp);

  const ok = await waitFor(async () => evaluate(cdp, `(() => {
    const bodyText = document.body?.innerText || "";
    if (/phone number shared via url is invalid|numarul de telefon.*invalid|numărul de telefon.*invalid/i.test(bodyText)) {
      return "invalid";
    }
    const footer = document.querySelector('footer');
    const box = footer?.querySelector('[contenteditable="true"]');
    return Boolean(box);
  })()`), 30000);

  if (!ok) {
    throw new Error(`Could not open WhatsApp chat for phone ${phone}.`);
  }

  const invalid = await evaluate(cdp, `(() => {
    const bodyText = document.body?.innerText || "";
    return /phone number shared via url is invalid|numarul de telefon.*invalid|numărul de telefon.*invalid/i.test(bodyText);
  })()`);
  if (invalid) {
    throw new Error(`WhatsApp rejected phone ${phone}.`);
  }
}

async function ensureWhatsAppPage(cdp) {
  const locationHref = await evaluate(cdp, "location.href");
  if (typeof locationHref === "string" && locationHref.startsWith("https://web.whatsapp.com/")) return;

  await cdp.send("Page.navigate", { url: "https://web.whatsapp.com/" });
  await sleep(1000);
}

async function waitForWhatsAppReady(cdp) {
  let qrNoticeShown = false;
  const deadline = Date.now() + 180000;

  while (Date.now() < deadline) {
    const state = await evaluate(cdp, `(() => {
      const editables = document.querySelectorAll('[contenteditable="true"], input[aria-label], textarea[aria-label]');
      const hasQr = Boolean(document.querySelector('canvas'));
      return { hasQr, editableCount: editables.length, title: document.title };
    })()`);

    if (state?.editableCount > 0) return;

    if (state?.hasQr && !qrNoticeShown) {
      console.log("Scan the WhatsApp Web QR code in Chrome. Waiting for login...");
      qrNoticeShown = true;
    }

    await sleep(1000);
  }

  throw new Error("Timed out waiting for WhatsApp Web login/UI.");
}

async function focusSearch(cdp) {
  const rect = await evaluate(cdp, `(() => {
    const editables = [...document.querySelectorAll('[contenteditable="true"], input[aria-label], textarea[aria-label]')];
    const search = editables.find((el) => {
      const label = [
        el.getAttribute('aria-label'),
        el.getAttribute('aria-placeholder'),
        el.getAttribute('title'),
        el.textContent
      ].filter(Boolean).join(' ');
      return /search|cauta|caută/i.test(label);
    }) || editables[0];

    if (!search) return null;
    search.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = search.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + Math.min(rect.width * 0.35, 180),
      y: rect.top + rect.height / 2
    };
  })()`);

  if (!rect) throw new Error("Could not focus WhatsApp search box.");
  await clickPoint(cdp, rect.x, rect.y);
  await humanPause();
}

async function clickChatByTitle(cdp, groupName) {
  const rect = await waitForValue(async () => evaluate(cdp, `((groupName) => {
    const byTitle = [...document.querySelectorAll('span[title]')]
      .find((el) => el.getAttribute('title') === groupName);
    const byText = [...document.querySelectorAll('span, div')]
      .find((el) => el.textContent?.trim() === groupName);
    const el = byTitle || byText;
    if (!el) return null;
    const row = el.closest('[role="row"]') || el.closest('[role="listitem"]') || el.closest('[tabindex]') || el;
    row.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = row.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  })(${JSON.stringify(groupName)})`), 10000);

  if (!rect) throw new Error(`Could not find chat result: ${groupName}`);
  await clickPoint(cdp, rect.x, rect.y);
}

async function waitForChat(cdp, groupName) {
  const ok = await waitFor(async () => evaluate(cdp, `((groupName) => {
    const headers = [...document.querySelectorAll('header')];
    return headers.some((header) => [...header.querySelectorAll('span[title], span, div')]
      .some((el) => el.getAttribute?.('title') === groupName || el.textContent?.trim() === groupName)
    );
  })(${JSON.stringify(groupName)})`), 12000);

  if (!ok) throw new Error(`Chat did not open or header did not match: ${groupName}`);
}

async function focusMessageBox(cdp) {
  const rect = await evaluate(cdp, `(() => {
    const footer = document.querySelector('footer');
    const boxes = [...document.querySelectorAll('[contenteditable="true"]')];
    const box = footer?.querySelector('[contenteditable="true"]') || boxes.at(-1);
    if (!box) return null;
    box.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + Math.min(rect.width * 0.25, 240),
      y: rect.top + rect.height / 2
    };
  })()`);

  if (!rect) throw new Error("Could not focus WhatsApp message box.");
  await clickPoint(cdp, rect.x, rect.y);
  await humanPause();
}

async function clickSend(cdp) {
  const rect = await evaluate(cdp, `(() => {
    const sendByLabel = document.querySelector('button[aria-label="Send"], button[aria-label="Trimite"]');
    const sendByIcon = document.querySelector('span[data-icon="send"]')?.closest('button');
    const button = sendByLabel || sendByIcon;
    if (!button) return null;
    button.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  })()`);

  if (!rect) throw new Error("Could not find WhatsApp send button.");
  await humanPause(300, 900);
  await clickPoint(cdp, rect.x, rect.y);
}

async function clearFocusedEditable(cdp) {
  await evaluate(cdp, `(() => {
    const el = document.activeElement;
    if (!el) return false;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const prototype = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      el.focus();
      el.select();
      valueSetter.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.getAttribute('contenteditable') !== 'true') return false;
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    return true;
  })()`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description ||
      response.exceptionDetails.exception?.value ||
      response.exceptionDetails.text ||
      "Runtime.evaluate failed";
    throw new Error(detail);
  }

  return response.result?.value;
}

async function waitFor(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await sleep(400);
  }
  return false;
}

async function waitForValue(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await sleep(400);
  }
  return null;
}

async function clickPoint(cdp, x, y) {
  await moveMouse(cdp, x, y);
  await humanPause(80, 180);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1
  });
  await humanPause(45, 140);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1
  });
}

async function moveMouse(cdp, targetX, targetY) {
  if (!humanMode) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: targetX,
      y: targetY
    });
    return;
  }

  const start = await evaluate(cdp, `(() => {
    const state = window.__waAutomationMouse || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return state;
  })()`);
  const fromX = Number(start?.x || 0);
  const fromY = Number(start?.y || 0);
  const distance = Math.hypot(targetX - fromX, targetY - fromY);
  const steps = Math.max(8, Math.min(34, Math.round(distance / 35)));

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    const wobble = Math.sin(t * Math.PI) * 2.5;
    const x = fromX + (targetX - fromX) * eased + wobble;
    const y = fromY + (targetY - fromY) * eased - wobble;
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y
    });
    await sleep(randomInt(8, 22));
  }

  await evaluate(cdp, `((x, y) => {
    window.__waAutomationMouse = { x, y };
  })(${JSON.stringify(targetX)}, ${JSON.stringify(targetY)})`);
}

async function typeText(cdp, text) {
  if (!humanMode) {
    await cdp.send("Input.insertText", { text });
    return;
  }

  for (const char of text) {
    await cdp.send("Input.insertText", { text: char });
    await sleep(randomInt(keyDelayMin, keyDelayMax));
  }
  await humanPause(160, 360);
}

async function humanPause(min = actionDelayMin, max = actionDelayMax) {
  if (!humanMode) return;
  await sleep(randomInt(min, max));
}

async function waitForPageWebSocket(port) {
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`${base}/json/list`).then((res) => res.json());
      const page = targets.find((targetInfo) =>
        targetInfo.type === "page" &&
        targetInfo.url?.startsWith("https://web.whatsapp.com/") &&
        targetInfo.webSocketDebuggerUrl
      ) || targets.find((targetInfo) => targetInfo.type === "page" && targetInfo.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {
      // Chrome is still booting.
    }
    await sleep(250);
  }

  throw new Error("Could not connect to Chrome DevTools.");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

class CdpClient {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const client = new CdpClient(socket);
      socket.addEventListener("open", () => resolve(client), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event));
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id || !this.pending.has(message.id)) return;

    const { resolve, reject } = this.pending.get(message.id);
    this.pending.delete(message.id);

    if (message.error) {
      reject(new Error(message.error.message || "CDP error"));
    } else {
      resolve(message.result);
    }
  }

  close() {
    return new Promise((resolve) => {
      if (this.socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      this.socket.addEventListener("close", resolve, { once: true });
      this.socket.close();
    });
  }
}

await main();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function fail(messageText) {
  console.error(messageText);
  process.exit(1);
}

function defaultChromePath() {
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  if (process.platform === "win32") {
    return process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
      : "chrome.exe";
  }

  return "google-chrome";
}
