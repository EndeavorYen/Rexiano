import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const assets = [
  ["docs/assets/screenshots/rexiano-library.png", "rexiano-library.png"],
  ["docs/assets/screenshots/rexiano-practice.png", "rexiano-practice.png"],
  [
    "docs/assets/screenshots/rexiano-split-sheet.png",
    "rexiano-split-sheet.png",
  ],
  ["docs/figure/Rexiano_icon.png", "Rexiano_icon.png"],
];

const outputDir = join(repoRoot, "site/public/assets");

await mkdir(outputDir, { recursive: true });

await Promise.all(
  assets.map(([source, destination]) =>
    copyFile(join(repoRoot, source), join(outputDir, destination)),
  ),
);

console.log(`Copied ${assets.length} Rexiano site assets.`);
