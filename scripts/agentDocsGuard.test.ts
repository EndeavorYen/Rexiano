import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, test } from "vitest";

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

describe("agent docs do not regenerate deleted chrome", () => {
  test("CLAUDE.md is not a second progress snapshot", () => {
    const claude = readRepoFile("CLAUDE.md");

    expect(claude).toContain("進度 checkbox 只活在");
    expect(claude).not.toContain("6.5+");
    expect(claude).not.toContain("343 tests");
    expect(claude).not.toContain("6 個 store");
    expect(claude).not.toContain("當前進度快照");
  });

  test("CLAUDE.md lists settings and progress stores", () => {
    const claude = readRepoFile("CLAUDE.md");

    expect(claude).toContain("useSettingsStore");
    expect(claude).toContain("stores/useSettingsStore.ts");
    expect(claude).toContain("useProgressStore");
    expect(claude).toContain("stores/useProgressStore.ts");
  });

  test("CLAUDE.md states the live constraints", () => {
    const claude = readRepoFile("CLAUDE.md");

    expect(claude).toContain("樂譜主渲染器是 VexFlow。不要加入 OSMD");
    expect(claude).toContain("已公開的安裝檔是未簽章的");
    expect(claude).toContain("`site/` 不是產品需求");
  });

  test("ROADMAP parity table is not a backlog", () => {
    const roadmap = readRepoFile("docs/ROADMAP.md");

    expect(roadmap).toContain("歷史紀錄，不是待辦。");
    expect(roadmap).not.toContain("畫面密度下降");
    expect(roadmap).not.toContain("下落音符、命中回饋");
    expect(roadmap).not.toContain("裝置連線與設定");
    expect(roadmap).not.toContain("動效／間距／字級");
  });

  test("ROADMAP product stages stay less dumb", () => {
    const roadmap = readRepoFile("docs/ROADMAP.md");

    expect(roadmap).toContain("不要另開通用樂譜匯入器");
    expect(roadmap).toContain(
      "有一首被點名、已經不能練的曲子之前，不做音樂家級 MIDI → 譜轉換",
    );
  });

  test("ROADMAP says published assets are unsigned", () => {
    const roadmap = readRepoFile("docs/ROADMAP.md");

    expect(roadmap).toContain("已公開的 GitHub Release 安裝檔是未簽章的");
    expect(roadmap).toContain(
      "- [ ] 使用 production secrets 完成真實三平台簽章發行與安裝 smoke 證據（#187）",
    );
  });

  test("ROADMAP keeps VexFlow as the only renderer", () => {
    const roadmap = readRepoFile("docs/ROADMAP.md");

    expect(roadmap).toContain("不要併入 OSMD，不要做 OSMD native cursor");
  });

  test("release signing doc is not the live path", () => {
    const signingDocs = readRepoFile("docs/release-signing.md");

    expect(signingDocs).toContain(
      "Published GitHub Release assets are unsigned",
    );
    expect(signingDocs).toContain(
      "Fail-closed signing is not the live public path",
    );
    expect(signingDocs).not.toContain(
      "Official production releases fail closed",
    );
  });

  test("P2 checklist uses the surviving surface", () => {
    const checklist = readRepoFile("docs/p2-synthesia-feel-checklist.md");

    expect(checklist).toContain("Mode pick is Watch / Wait only");
    expect(checklist).toContain(
      "Stage shows falling / split on the playback surface. Split is the default for score-backed songs.",
    );
    expect(checklist).not.toContain("Watch / Wait / Free");
    expect(checklist).not.toContain("falling / sheet / split");
  });
});
