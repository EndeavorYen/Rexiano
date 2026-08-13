import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const jobBlock = (workflow: string, jobName: string): string => {
  const match = workflow.match(
    new RegExp(
      `(?:^|\\n)  ${escapeRegExp(jobName)}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|$)`,
    ),
  );

  expect(match, `missing ${jobName} job`).not.toBeNull();
  return match?.[0] ?? "";
};

describe("release workflow", () => {
  const releaseWorkflow = readRepoFile(".github/workflows/release.yml");
  const releasePleaseWorkflow = readRepoFile(
    ".github/workflows/release-please.yml",
  );

  test("creates draft Release Please releases and dispatches the immutable commit", () => {
    const config = JSON.parse(readRepoFile("release-please-config.json")) as {
      draft?: boolean;
      "force-tag-creation"?: boolean;
    };

    expect(config.draft).toBe(true);
    expect(config["force-tag-creation"]).toBe(true);
    expect(releasePleaseWorkflow).toContain(
      "uses: googleapis/release-please-action@v5",
    );
    expect(releasePleaseWorkflow).not.toContain("release-type:");
    expect(releasePleaseWorkflow).toContain(
      "config-file: release-please-config.json",
    );
    expect(releasePleaseWorkflow).toContain(
      "manifest-file: .release-please-manifest.json",
    );
    expect(releasePleaseWorkflow).toContain("actions: write");
    expect(releasePleaseWorkflow).toContain(
      "if: ${{ steps.release.outputs.release_created == 'true' }}",
    );
    expect(releasePleaseWorkflow).toContain(
      "RELEASE_TAG: ${{ steps.release.outputs.tag_name }}",
    );
    expect(releasePleaseWorkflow).toContain(
      "RELEASE_SHA: ${{ steps.release.outputs.sha }}",
    );
    expect(releasePleaseWorkflow).toMatch(
      /--ref main\s+--field tag="\$RELEASE_TAG" --field expected_sha="\$RELEASE_SHA"/,
    );
  });

  test("uses read-only defaults, exact release inputs, and per-tag serialization", () => {
    expect(releaseWorkflow).toContain('      - "v*"');
    expect(releaseWorkflow).toContain("expected_sha:");
    expect(releaseWorkflow).toContain("required: true");
    expect(releaseWorkflow).toContain("permissions:\n  contents: read");
    expect(releaseWorkflow.match(/contents: write/g)).toHaveLength(1);
    expect(releaseWorkflow).toContain(
      "group: release-${{ github.event.inputs.tag || github.ref_name }}",
    );
    expect(releaseWorkflow).toContain("cancel-in-progress: false");
  });

  test("resolves annotated or lightweight tags to a trusted main commit", () => {
    const resolver = jobBlock(releaseWorkflow, "resolve-release-ref");

    expect(resolver).toContain("fetch-depth: 0");
    expect(resolver).toContain("persist-credentials: false");
    expect(resolver).toContain("github.workflow_ref");
    expect(resolver).toContain("refs/heads/main");
    expect(resolver).toContain("github.event.inputs.tag");
    expect(resolver).toContain("github.event.inputs.expected_sha");
    expect(resolver).toMatch(/\^v\(0\|\[1-9\]\[0-9\]\*\)/);
    expect(resolver).toContain(
      "git fetch --force --prune --prune-tags --tags origin",
    );
    expect(resolver).toContain("refs/tags/$release_tag^{commit}");
    expect(resolver).toContain("^[0-9a-f]{40}$");
    expect(resolver).toContain('"$release_sha" != "$EXPECTED_SHA"');
    expect(resolver).toContain(
      'git merge-base --is-ancestor "$release_sha" origin/main',
    );
    expect(resolver).toContain('git show "$release_sha:package.json"');
    expect(resolver).toContain('"v$package_version" != "$release_tag"');
    expect(resolver).toContain("tag=$release_tag");
    expect(resolver).toContain("sha=$release_sha");
  });

  test("gates every build and publication on the required verification graph", () => {
    expect(jobBlock(releaseWorkflow, "preflight")).toContain(
      "needs: resolve-release-ref",
    );
    expect(jobBlock(releaseWorkflow, "windows-e2e")).toContain(
      "needs: resolve-release-ref",
    );

    for (const name of ["build-windows", "build-mac", "build-linux"]) {
      expect(jobBlock(releaseWorkflow, name)).toContain(
        "needs: [resolve-release-ref, preflight]",
      );
    }

    expect(jobBlock(releaseWorkflow, "publish")).toContain(
      "needs:\n      - resolve-release-ref\n      - preflight\n      - windows-e2e\n      - build-windows\n      - build-mac\n      - build-linux",
    );
    expect(releaseWorkflow).not.toContain("if: always()");
    expect(releaseWorkflow).not.toContain("if: ${{ always() }}");
  });

  test("checks out and asserts the resolved SHA in every downstream job", () => {
    for (const name of [
      "preflight",
      "windows-e2e",
      "build-windows",
      "build-mac",
      "build-linux",
      "publish",
    ]) {
      const job = jobBlock(releaseWorkflow, name);
      expect(job, name).toContain(
        "ref: ${{ needs.resolve-release-ref.outputs.sha }}",
      );
      expect(job, name).toContain("persist-credentials: false");
      expect(job, name).toContain(
        "EXPECTED_SHA: ${{ needs.resolve-release-ref.outputs.sha }}",
      );
      expect(job, name).toContain("git rev-parse HEAD");
    }
  });

  test("runs frozen preflight checks and a real Windows player flow", () => {
    const preflight = jobBlock(releaseWorkflow, "preflight");
    const e2e = jobBlock(releaseWorkflow, "windows-e2e");

    expect(preflight).toContain("pnpm install --frozen-lockfile");
    expect(preflight).toContain("run: pnpm lint");
    expect(preflight).toContain("run: pnpm typecheck");
    expect(preflight).toContain("run: pnpm test");
    expect(e2e).toContain("runs-on: windows-latest");
    expect(e2e).toContain("pnpm install --frozen-lockfile");
    expect(e2e).toContain("run: pnpm test:e2e");
    expect(e2e).toContain('ELECTRON_RUN_AS_NODE: ""');
  });

  test("fails Windows releases closed and verifies every executable", () => {
    const windows = jobBlock(releaseWorkflow, "build-windows");

    expect(windows).toContain("WIN_CSC_LINK: ${{ secrets.WINDOWS_CSC_LINK }}");
    expect(windows).toContain(
      "WIN_CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CSC_KEY_PASSWORD }}",
    );
    expect(windows).toContain("IsNullOrWhiteSpace");
    expect(windows).toContain("pnpm build");
    expect(windows).toContain(
      "pnpm exec electron-builder --win -c.forceCodeSigning=true --publish never",
    );
    expect(windows).toContain("rexiano-$version-setup.exe");
    expect(windows).toContain("rexiano-$version-portable.exe");
    expect(windows).toContain("rexiano-$version-win-x64.zip");
    expect(windows).toContain("Get-AuthenticodeSignature");
    expect(windows).toContain("Valid");
    expect(windows).toContain("signtool.exe");
    expect(windows).toContain("verify /pa /tw /v");
    expect(windows).toContain("Expand-Archive");
    expect(windows).toContain("Rexiano.exe");
  });

  test("fails macOS releases closed and verifies apps inside both DMGs", () => {
    const mac = jobBlock(releaseWorkflow, "build-mac");

    for (const secret of [
      "MACOS_CSC_LINK",
      "MACOS_CSC_KEY_PASSWORD",
      "APPLE_API_KEY_BASE64",
      "APPLE_API_KEY_ID",
      "APPLE_API_ISSUER",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
    ]) {
      expect(mac).toContain(`secrets.${secret}`);
    }

    expect(mac).toContain("umask 077");
    expect(mac).toContain("base64 -D");
    expect(mac).toMatch(/notarization sets must be complete/i);
    expect(mac).toContain("exactly one notarization credential set");
    expect(mac).toContain("pnpm build");
    expect(mac).toContain(
      "pnpm exec electron-builder --mac -c.forceCodeSigning=true -c.mac.notarize=true --publish never",
    );
    expect(mac).toContain("codesign --verify --deep --strict");
    expect(mac).toContain("Authority=Developer ID Application:");
    expect(mac).toContain("TeamIdentifier=");
    expect(mac).toContain("spctl --assess --type execute");
    expect(mac).toContain("xcrun stapler validate");
    expect(mac).toContain("hdiutil attach");
    expect(mac).toContain("Rexiano.app");
    expect(mac).toContain("rexiano-$version-x64.dmg");
    expect(mac).toContain("rexiano-$version-arm64.dmg");
    expect(mac).not.toContain("notarytool submit");
    expect(mac).not.toContain('xcrun stapler validate "$dmg_path"');
  });

  test("builds and inventories the two checked Linux packages", () => {
    const linux = jobBlock(releaseWorkflow, "build-linux");

    expect(linux).toContain("pnpm build");
    expect(linux).toContain(
      "pnpm exec electron-builder --linux AppImage deb --publish never",
    );
    expect(linux).toContain("rexiano-$version-x86_64.AppImage");
    expect(linux).toContain("rexiano-$version-amd64.deb");
    expect(linux).not.toContain("rexiano-$version-x64.AppImage");
    expect(linux).not.toContain("rexiano-$version-x64.deb");
  });

  test("publishes only seven verified packages into the existing draft", () => {
    const publish = jobBlock(releaseWorkflow, "publish");

    expect(publish).toContain("permissions:\n      contents: write");
    expect(publish).toContain(
      "git fetch --force --prune --prune-tags --tags origin",
    );
    expect(publish).toContain("refs/tags/$RELEASE_TAG^{commit}");
    expect(publish).toContain("releases?per_page=100");
    expect(publish).toContain("Release is already public");
    expect(publish).toContain("Duplicate releases found");
    expect(publish).toContain("actions/download-artifact@v8");
    expect(publish).toContain("Expected exactly 7 release packages");
    expect(publish).toContain("LC_ALL=C");
    expect(publish).toContain("SHA256SUMS.txt");
    expect(publish).toContain("sha256sum --check SHA256SUMS.txt");
    expect(publish).toContain("uses: softprops/action-gh-release@v3");
    expect(publish).toContain("artifacts/rexiano-*-x86_64.AppImage");
    expect(publish).not.toContain("artifacts/rexiano-*-x64.AppImage");
    expect(publish).toContain("artifacts/rexiano-*-amd64.deb");
    expect(publish).not.toContain("artifacts/rexiano-*-x64.deb");
    expect(publish).toContain("draft: false");
    expect(publish).toContain("append_body: true");
    expect(publish).toContain("fail_on_unmatched_files: true");
    expect(publish).not.toContain("generate_release_notes");

    const releaseFiles = publish.match(/ {12}artifacts\/.+/g) ?? [];
    expect(releaseFiles).toHaveLength(8);
    expect(
      releaseFiles.filter((line) => line.includes("SHA256SUMS")),
    ).toHaveLength(1);
  });

  test("keeps local builds unsigned but forbids release-workflow fallbacks", () => {
    const builderConfig = readRepoFile("electron-builder.yml");

    expect(builderConfig).toContain("notarize: false");
    expect(releaseWorkflow).not.toContain("unsigned fallback");
    expect(releaseWorkflow).not.toContain("building unsigned");
    expect(releaseWorkflow).not.toContain("CSC_IDENTITY_AUTO_DISCOVERY=false");
    expect(releaseWorkflow).not.toContain(
      'CSC_IDENTITY_AUTO_DISCOVERY = "false"',
    );
    expect(releaseWorkflow).not.toContain("mac.identity=null");
    expect(releaseWorkflow).not.toContain("mac.notarize=false");
    expect(releaseWorkflow).not.toContain("electron-vite build");
    expect(releaseWorkflow.match(/--publish never/g)).toHaveLength(3);
    expect(releaseWorkflow.match(/GH_TOKEN:/g)).toHaveLength(1);
  });

  test("documents production failure behavior and real-release evidence", () => {
    const signingDocs = readRepoFile("docs/release-signing.md");
    const design = readRepoFile("docs/DESIGN.md");
    const englishDesign = readRepoFile("docs/DESIGN-en.md");

    expect(signingDocs).toContain("Official production releases fail closed");
    expect(signingDocs).toContain("Local and fork builds");
    expect(signingDocs).toContain("WINDOWS_CSC_LINK");
    expect(signingDocs).toContain("MACOS_CSC_LINK");
    expect(signingDocs).toContain("Exactly one");
    expect(signingDocs).toContain("Issue #187");
    expect(signingDocs).toContain("Authenticode");
    expect(signingDocs).toContain("Gatekeeper");
    expect(signingDocs).toContain("SHA256SUMS.txt");
    expect(design).toContain("fail closed");
    expect(englishDesign).toContain("fail closed");
  });

  test("documents conventional squash subjects for release notes", () => {
    const agentInstructions = readRepoFile("AGENTS.md");

    expect(agentInstructions).toContain("Conventional Commit");
    expect(agentInstructions).toContain("fix: ");
    expect(agentInstructions).toContain("feat: ");
    expect(agentInstructions).toContain("release-please");
  });
});
