import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { promisify } from "node:util";

await loadLocalEnv();

const port = Number(process.env.OPS_PORT || 8789);
const remoteBaseUrl = (process.env.OPS_REMOTE_BASE_URL || "https://aiwebminar.pages.dev").replace(/\/+$/, "");
const adminExportToken = process.env.OPS_ADMIN_EXPORT_TOKEN || process.env.ADMIN_EXPORT_TOKEN || "";
const root = process.cwd();
const execFileAsync = promisify(execFile);
const whatsappDesktopScript = normalize(join(root, "..", "tools", "whatsapp-desktop", "send-whatsapp.sh"));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/api/local-ops-status") {
      sendJson(response, {
        ok: true,
        remoteBaseUrl,
        adminExportTokenConfigured: Boolean(adminExportToken),
        whatsappDesktopAvailable: process.platform === "darwin"
      });
      return;
    }

    if (url.pathname === "/api/whatsapp-desktop") {
      await handleWhatsappDesktop(request, response);
      return;
    }

    if (url.pathname === "/api/config" || url.pathname === "/api/export") {
      await proxyApi(request, response, url);
      return;
    }

    const filePath = resolveStaticFile(url.pathname);
    if (!filePath) {
      sendText(response, 404, "Not found");
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(content);
  } catch (error) {
    sendText(response, 500, `Local ops error: ${error.message || error}`);
  }
});

server.listen(port, () => {
  console.log(`AIWebminar local ops: http://localhost:${port}/ops`);
  console.log(`AIWebminar email previews: http://localhost:${port}/emails`);
  console.log(`Proxy API: ${remoteBaseUrl}`);
  console.log(`Admin export token: ${adminExportToken ? "configured" : "missing"}`);
});

function resolveStaticFile(pathname) {
  const routes = new Map([
    ["/", "ops.html"],
    ["/ops", "ops.html"],
    ["/ops.html", "ops.html"],
    ["/emails", "email-previews/index.html"],
    ["/emails.html", "email-previews/index.html"],
    ["/email-previews", "email-previews/index.html"],
    ["/email-previews/", "email-previews/index.html"],
    ["/email-previews/index.html", "email-previews/index.html"],
    ["/email-previews/free-confirmation.html", "email-previews/free-confirmation.html"],
    ["/email-previews/vip-intent.html", "email-previews/vip-intent.html"],
    ["/email-previews/vip-confirmed.html", "email-previews/vip-confirmed.html"],
    ["/index.html", "index.html"],
    ["/privacy.html", "privacy.html"],
    ["/thank-you.html", "thank-you.html"],
    ["/mentor.jpeg", "mentor.jpeg"]
  ]);

  const file = routes.get(pathname);
  if (!file) return "";

  const fullPath = normalize(join(root, file));
  return fullPath.startsWith(root) ? fullPath : "";
}

async function handleWhatsappDesktop(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }

  if (process.platform !== "darwin") {
    sendJson(response, { ok: false, error: "whatsapp_desktop_mac_only" }, 400);
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, { ok: false, error: "invalid_json", message: error.message }, 400);
    return;
  }

  const target = String(payload.target || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();
  const mode = String(payload.mode || "preview").trim().toLowerCase();
  const validTargets = new Set(["free", "vip", "both"]);
  const validModes = new Set(["preview", "send"]);

  if (!validTargets.has(target)) {
    sendJson(response, { ok: false, error: "invalid_target" }, 400);
    return;
  }

  if (!validModes.has(mode)) {
    sendJson(response, { ok: false, error: "invalid_mode" }, 400);
    return;
  }

  if (!message || message.length > 3000) {
    sendJson(response, { ok: false, error: "invalid_message" }, 400);
    return;
  }

  if (target === "both" && mode === "preview") {
    sendJson(response, { ok: false, error: "both_preview_disabled" }, 400);
    return;
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      whatsappDesktopScript,
      [target, message, mode === "send" ? "--send" : "--preview"],
      {
        cwd: root,
        timeout: 45000,
        maxBuffer: 1024 * 64
      }
    );

    sendJson(response, {
      ok: true,
      target,
      mode,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error) {
    sendJson(response, {
      ok: false,
      error: "whatsapp_desktop_failed",
      message: error.message,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim()
    }, 500);
  }
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 12000) {
      throw new Error("request_body_too_large");
    }
  }
  return body ? JSON.parse(body) : {};
}

async function proxyApi(request, response, localUrl) {
  const targetUrl = new URL(`${remoteBaseUrl}${localUrl.pathname}`);
  localUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

  const headers = {};
  const authorization = request.headers.authorization;
  if (authorization) {
    headers.authorization = authorization;
  } else if (localUrl.pathname === "/api/export" && adminExportToken) {
    headers.authorization = `Bearer ${adminExportToken}`;
  }
  headers.accept = request.headers.accept || "application/json";

  const remoteResponse = await fetch(targetUrl, { headers });
  const body = await remoteResponse.arrayBuffer();
  response.writeHead(remoteResponse.status, {
    "content-type": remoteResponse.headers.get("content-type") || "application/octet-stream",
    "content-disposition": remoteResponse.headers.get("content-disposition") || "",
    "cache-control": "no-store"
  });
  response.end(Buffer.from(body));
}

async function loadLocalEnv() {
  for (const filename of [".dev.vars.local", ".env.local"]) {
    try {
      const content = await readFile(join(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch (_) {
      // Optional local secret file.
    }
  }
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}
