import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

await loadLocalEnv();

const port = Number(process.env.OPS_PORT || 8789);
const remoteBaseUrl = (process.env.OPS_REMOTE_BASE_URL || "https://aiwebminar.pages.dev").replace(/\/+$/, "");
const adminExportToken = process.env.OPS_ADMIN_EXPORT_TOKEN || process.env.ADMIN_EXPORT_TOKEN || "";
const root = process.cwd();

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
        adminExportTokenConfigured: Boolean(adminExportToken)
      });
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
  console.log(`Proxy API: ${remoteBaseUrl}`);
  console.log(`Admin export token: ${adminExportToken ? "configured" : "missing"}`);
});

function resolveStaticFile(pathname) {
  const routes = new Map([
    ["/", "ops.html"],
    ["/ops", "ops.html"],
    ["/ops.html", "ops.html"],
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

function sendJson(response, payload) {
  response.writeHead(200, {
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
