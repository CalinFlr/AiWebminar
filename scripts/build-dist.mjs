import { cp, mkdir, rm } from "node:fs/promises";

const staticFiles = [
  "index.html",
  "thank-you.html",
  "privacy.html",
  "404.html",
  "mentor.jpeg",
  "_headers"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of staticFiles) {
  await cp(file, `dist/${file}`, { recursive: true });
}
