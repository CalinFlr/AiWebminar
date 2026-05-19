import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.OPS_PORT || 8789);
const remoteBaseUrl = (process.env.OPS_REMOTE_BASE_URL || "https://aiwebminar.pages.dev").replace(/\/+$/, "");
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

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}
