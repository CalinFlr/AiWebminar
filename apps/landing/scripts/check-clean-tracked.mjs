import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || appRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

const rootResult = await capture("git", ["rev-parse", "--show-toplevel"]);

if (rootResult.code !== 0) {
  console.error(rootResult.stderr || "Nu am putut detecta root-ul Git.");
  process.exit(1);
}

const repoRoot = rootResult.stdout.trim();
const status = await capture("git", ["status", "--porcelain=v1", "--untracked-files=normal"], { cwd: repoRoot });

if (status.code !== 0) {
  console.error(status.stderr || "Nu am putut verifica starea Git.");
  process.exit(1);
}

const deployBlockingChanges = status.stdout.trim();

if (deployBlockingChanges) {
  console.error("\n[deploy guard] Exista modificari necomise sau fisiere neignorate. Deploy-ul Cloudflare este blocat.");
  console.error("Commit/stash modificarile sau adauga in .gitignore artefactele locale, apoi ruleaza deploy-ul din nou.");
  console.error("\nFisiere detectate:");
  console.error(deployBlockingChanges);
  process.exit(1);
}

console.log("[deploy guard] OK: nu exista modificari necomise sau fisiere neignorate.");
