const BLOCKED_STATIC_PATHS = [
  /^\/package(?:-lock)?\.json$/i,
  /^\/wrangler\.toml$/i,
  /^\/tests(?:\/|$)/i,
  /^\/functions(?:\/|$)/i,
  /^\/migrations(?:\/|$)/i,
  /^\/scripts(?:\/|$)/i
];

function isBlockedStaticPath(pathname) {
  return BLOCKED_STATIC_PATHS.some((pattern) => pattern.test(pathname));
}

export async function onRequest({ request, next }) {
  const { pathname } = new URL(request.url);
  if (isBlockedStaticPath(pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff"
      }
    });
  }

  return next();
}
