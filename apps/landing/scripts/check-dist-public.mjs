import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..");
const distDir = join(appRoot, "dist");

const allowedPublicFiles = new Set([
  "404.html",
  "_headers",
  "bonus.html",
  "favicon.svg",
  "index.html",
  "mentor.jpeg",
  "privacy.html",
  "thank-you.html"
]);

const privateNames = new Set([
  "email-previews",
  "functions",
  "migrations",
  "node_modules",
  "ops.html",
  "package-lock.json",
  "package.json",
  "scripts",
  "tests",
  "wrangler.toml"
]);

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(current, entry.name);
    const publicPath = relative(root, absolutePath).split(sep).join("/");

    if (entry.isDirectory()) {
      files.push(...await listFiles(root, absolutePath));
      continue;
    }

    files.push(publicPath);
  }

  return files;
}

function findPrivateMatches(files) {
  return files.filter((file) => {
    const parts = file.split("/");
    return parts.some((part) => privateNames.has(part));
  });
}

function fail(message, details = []) {
  console.error(`\n[dist guard] ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exitCode = 1;
}

try {
  const distStats = await stat(distDir);

  if (!distStats.isDirectory()) {
    fail("dist exista, dar nu este director.");
  } else {
    const files = (await listFiles(distDir)).sort();
    const missing = [...allowedPublicFiles].filter((file) => !files.includes(file));
    const unexpected = files.filter((file) => !allowedPublicFiles.has(file));
    const privateMatches = findPrivateMatches(files);

    if (missing.length) {
      fail("Lipsesc asseturi publice obligatorii din dist.", missing);
    }

    if (unexpected.length) {
      fail("dist contine fisiere in afara allowlist-ului public.", unexpected);
    }

    if (privateMatches.length) {
      fail("dist contine fisiere sau directoare private.", privateMatches);
    }

    if (!missing.length && !unexpected.length && !privateMatches.length) {
      console.log(`[dist guard] OK: ${files.length} fisiere publice verificate.`);
    }
  }
} catch (error) {
  if (error?.code === "ENOENT") {
    fail("dist nu exista. Ruleaza mai intai npm run build.");
  } else {
    throw error;
  }
}
