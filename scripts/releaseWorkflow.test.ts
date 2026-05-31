import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

describe("release workflow", () => {
  test("pins release-please to the Node 24 action major", () => {
    const workflow = readRepoFile(".github/workflows/release-please.yml");

    expect(workflow).toContain("uses: googleapis/release-please-action@v5");
    expect(workflow).not.toContain(
      "uses: google-github-actions/release-please-action",
    );
    expect(workflow).not.toContain("uses: googleapis/release-please-action@v4");
  });

  test("dispatches installer artifact builds after release-please publishes", () => {
    const workflow = readRepoFile(".github/workflows/release-please.yml");

    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("id: release");
    expect(workflow).toContain(
      "if: ${{ steps.release.outputs.release_created == 'true' }}",
    );
    expect(workflow).toContain(
      "RELEASE_TAG: ${{ steps.release.outputs.tag_name }}",
    );
    expect(workflow).toContain(
      'gh workflow run release.yml --ref main --field tag="$RELEASE_TAG"',
    );
  });

  test("documents conventional squash subjects for release notes", () => {
    const agentInstructions = readRepoFile("AGENTS.md");

    expect(agentInstructions).toContain("Conventional Commit");
    expect(agentInstructions).toContain("fix: ");
    expect(agentInstructions).toContain("feat: ");
    expect(agentInstructions).toContain("release-please");
  });

  test("runs Linux packaging through pnpm so local binaries resolve", () => {
    const workflow = readRepoFile(".github/workflows/release.yml");

    expect(workflow).toContain(
      "run: pnpm exec electron-vite build && pnpm exec electron-builder --linux AppImage deb",
    );
    expect(workflow).not.toContain(
      "run: electron-vite build && electron-builder --linux AppImage deb",
    );
  });

  test("wires optional Windows signing secrets while preserving unsigned fallback", () => {
    const workflow = readRepoFile(".github/workflows/release.yml");
    const signingDocs = readRepoFile("docs/release-signing.md");

    expect(workflow).toContain("WIN_CSC_LINK: ${{ secrets.WINDOWS_CSC_LINK }}");
    expect(workflow).toContain(
      "WIN_CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CSC_KEY_PASSWORD }}",
    );
    expect(workflow).toContain(
      "Windows signing secrets are incomplete; building unsigned installer.",
    );
    expect(workflow).toContain('$env:CSC_IDENTITY_AUTO_DISCOVERY = "true"');
    expect(workflow).toContain('$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"');
    expect(signingDocs).toContain("WINDOWS_CSC_LINK");
    expect(signingDocs).toContain("WINDOWS_CSC_KEY_PASSWORD");
  });

  test("wires optional macOS signing and notarization secrets with unsigned fallback", () => {
    const workflow = readRepoFile(".github/workflows/release.yml");
    const builderConfig = readRepoFile("electron-builder.yml");
    const signingDocs = readRepoFile("docs/release-signing.md");

    expect(workflow).toContain("CSC_LINK: ${{ secrets.MACOS_CSC_LINK }}");
    expect(workflow).toContain(
      "CSC_KEY_PASSWORD: ${{ secrets.MACOS_CSC_KEY_PASSWORD }}",
    );
    expect(workflow).toContain(
      "APPLE_API_KEY_BASE64: ${{ secrets.APPLE_API_KEY_BASE64 }}",
    );
    expect(workflow).toContain(
      "APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}",
    );
    expect(workflow).toContain(
      "APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}",
    );
    expect(workflow).toContain("APPLE_ID: ${{ secrets.APPLE_ID }}");
    expect(workflow).toContain(
      "APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}",
    );
    expect(workflow).toContain("APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}");
    expect(workflow).toContain("APPLE_API_KEY_PATH:");
    expect(workflow).toContain("unset APPLE_API_KEY");
    expect(workflow).toContain("unset CSC_LINK CSC_KEY_PASSWORD");
    expect(workflow).toContain('export APPLE_API_KEY="$APPLE_API_KEY_PATH"');
    expect(workflow).toContain(
      "pnpm exec electron-builder --mac -c.mac.notarize=true",
    );
    expect(workflow).toContain(
      "pnpm exec electron-builder --mac -c.mac.identity=null -c.mac.notarize=false",
    );
    expect(builderConfig).toContain("notarize: false");
    expect(signingDocs).toContain("MACOS_CSC_LINK");
    expect(signingDocs).toContain("APPLE_API_KEY_BASE64");
  });
});
