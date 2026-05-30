import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || appRoot,
      env: process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });

    let stdout = "";
    let stderr = "";

    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} a esuat cu exit code ${code}.`));
    });
  });
}

async function output(command, args, options = {}) {
  const result = await run(command, args, { ...options, capture: true });

  if (result.code !== 0) {
    throw new Error(result.stderr || `${command} ${args.join(" ")} a esuat.`);
  }

  return result.stdout.trim();
}

function assertWranglerConfig(source) {
  const requiredChecks = [
    {
      label: 'name = "aiwebminar"',
      ok: /^name\s*=\s*"aiwebminar"\s*$/m.test(source)
    },
    {
      label: 'pages_build_output_dir = "dist"',
      ok: /^pages_build_output_dir\s*=\s*"dist"\s*$/m.test(source)
    },
    {
      label: 'D1 binding "AIWEBMINAR_DB"',
      ok: /^binding\s*=\s*"AIWEBMINAR_DB"\s*$/m.test(source)
    },
    {
      label: "PUBLIC_SITE_URL",
      ok: /^PUBLIC_SITE_URL\s*=\s*".+"/m.test(source)
    },
    {
      label: "WORKSHOP_STATUS",
      ok: /^WORKSHOP_STATUS\s*=\s*".+"/m.test(source)
    },
    {
      label: "EXPECTED_VIP_AMOUNT",
      ok: /^EXPECTED_VIP_AMOUNT\s*=\s*".+"/m.test(source)
    },
    {
      label: "EXPECTED_VIP_CURRENCY",
      ok: /^EXPECTED_VIP_CURRENCY\s*=\s*".+"/m.test(source)
    },
    {
      label: "TURNSTILE_SITE_KEY",
      ok: /^TURNSTILE_SITE_KEY\s*=\s*".+"/m.test(source)
    }
  ];

  const forbiddenCommittedVars = [
    "ADMIN_EXPORT_TOKEN",
    "GOOGLE_OPS_WEBHOOK_SECRET",
    "GOOGLE_OPS_WEBHOOK_URL",
    "MAKE_LEAD_WEBHOOK_URL",
    "MAKE_ONBOARDING_WEBHOOK_URL",
    "MAKE_PAYMENT_WEBHOOK_URL",
    "OPS_ADMIN_EXPORT_TOKEN",
    "RATE_LIMIT_SALT",
    "SMS_GATEWAY_PASSWORD",
    "SMS_GATEWAY_URL",
    "SMS_GATEWAY_USERNAME",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "TURNSTILE_SECRET_KEY",
    "WHATSAPP_FREE_GROUP_URL",
    "WHATSAPP_VIP_GROUP_URL"
  ];

  const missing = requiredChecks.filter((check) => !check.ok).map((check) => check.label);
  const committedSecrets = forbiddenCommittedVars.filter((name) => new RegExp(`^${name}\\s*=`, "m").test(source));

  if (missing.length || committedSecrets.length) {
    if (missing.length) {
      console.error("\n[maturity] wrangler.toml nu are configuratia minima:");
      for (const item of missing) {
        console.error(`- ${item}`);
      }
    }

    if (committedSecrets.length) {
      console.error("\n[maturity] wrangler.toml contine variabile care trebuie setate ca secrete/runtime, nu comise:");
      for (const item of committedSecrets) {
        console.error(`- ${item}`);
      }
    }

    process.exit(1);
  }

  console.log("[maturity] OK: wrangler.toml are configuratia publica minima.");
}

async function reportOutdated(repoRoot) {
  console.log("\n> npm outdated --json (informational)");
  const result = await run("npm", ["outdated", "--json"], {
    cwd: repoRoot,
    capture: true,
    allowFailure: true
  });

  const outputText = `${result.stdout}${result.stderr}`.trim();

  if (!outputText || outputText === "{}") {
    console.log("[maturity] OK: npm outdated nu raporteaza pachete outdated.");
    return;
  }

  console.warn("[maturity] Warning: npm outdated a raportat diferente. Nu blocheaza maturitatea.");
  console.warn(outputText);
}

const repoRoot = await output("git", ["rev-parse", "--show-toplevel"]);

console.log("\n> Verific wrangler.toml");
assertWranglerConfig(await readFile(join(appRoot, "wrangler.toml"), "utf8"));

console.log("\n> npm run build");
await run("npm", ["run", "build"], { cwd: appRoot });

console.log("\n> npm run check:dist");
await run("npm", ["run", "check:dist"], { cwd: appRoot });

console.log("\n> npm run test:security");
await run("npm", ["run", "test:security"], { cwd: appRoot });

console.log("\n> npm audit");
await run("npm", ["audit"], { cwd: repoRoot });

console.log("\n> git diff --check");
await run("git", ["diff", "--check"], { cwd: repoRoot });

await reportOutdated(repoRoot);

console.log("\n[maturity] OK: toate verificarile obligatorii au trecut.");
