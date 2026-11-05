#!/usr/bin/env node
// Generates CHANGELOG.md from src/data/changelog.json (what the ⓘ in the app
// shows). Edit the JSON when releasing, then run: pnpm changelog
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {{ versions: { version: string, date: string, title: string, items: string[] }[] }} data */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function renderChangelog(data) {
  const lines = [
    "# 更新紀錄",
    "",
    "App 右上角的 ⓘ 也看得到。這個檔案由 `src/data/changelog.json` 產生（`pnpm changelog`）。",
    "1.x 桌面版的紀錄在 [docs/CHANGELOG-desktop.md](docs/CHANGELOG-desktop.md)。",
    "",
  ];
  for (const v of data.versions) {
    lines.push(`## v${v.version}（${v.date}）${v.title}`, "");
    for (const item of v.items) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(
    readFileSync(join(root, "src", "data", "changelog.json"), "utf8"),
  );
  writeFileSync(join(root, "CHANGELOG.md"), renderChangelog(data));
  console.log(`CHANGELOG.md: ${data.versions.length} versions`);
}
