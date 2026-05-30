import { cp, mkdir, rm } from "node:fs/promises";

const staticFiles = [
  "index.html",
  "thank-you.html",
  "bonus.html",
  "privacy.html",
  "404.html",
  "mentor.jpeg",
  "favicon.svg",
  "_headers"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of staticFiles) {
  await cp(file, `dist/${file}`, { recursive: true });
}
