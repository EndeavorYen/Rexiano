#!/usr/bin/env node
// Release notes for the newest version in src/data/changelog.json.
// The GitHub Release workflow runs this after every merge to main:
//   node scripts/release-notes.mjs <notes.md>   → prints tag=… and title=…
// and publishes a release when that tag does not exist yet.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const APP_URL = "https://rexiano.vercel.app/";

/**
 * @param {{ versions: { version: string, date: string, title: string, items: string[], en?: { title: string, items: string[] } }[] }} data
 * @param {string} packageVersion
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function renderRelease(data, packageVersion) {
  const latest = data.versions[0];
  if (!latest) throw new Error("changelog.json has no versions");
  if (!packageVersion.startsWith(`${latest.version}.`)) {
    throw new Error(
      `package.json ${packageVersion} does not match changelog ${latest.version}`,
    );
  }
  const tag = `v${packageVersion}`;
  const lines = [
    `**開始練琴 → ${APP_URL}**`,
    "",
    `## ${latest.title}`,
    "",
    ...latest.items.map((item) => `- ${item}`),
  ];
  if (latest.en) {
    lines.push(
      "",
      "---",
      "",
      `**Open Rexiano → ${APP_URL}**`,
      "",
      `## ${latest.en.title}`,
      "",
      ...latest.en.items.map((item) => `- ${item}`),
    );
  }
  lines.push(
    "",
    `${latest.date} · [CHANGELOG.md](https://github.com/EndeavorYen/Rexiano/blob/${tag}/CHANGELOG.md)`,
    "",
  );
  return { tag, title: `${tag} — ${latest.title}`, body: lines.join("\n") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(
    readFileSync(join(root, "src", "data", "changelog.json"), "utf8"),
  );
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const release = renderRelease(data, pkg.version);
  writeFileSync(process.argv[2] ?? "release-notes.md", release.body);
  console.log(`tag=${release.tag}`);
  console.log(`title=${release.title}`);
}
