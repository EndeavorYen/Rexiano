import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const officialActionPins: Record<string, string> = {
  "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/configure-pages": "45bfe0192ca1faeb007ade9deae92b16b8254a0d",
  "actions/deploy-pages": "368f82528645a54fb793d4d04e342629a3f51346",
  "actions/setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1",
  "actions/upload-artifact": "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
  "actions/upload-pages-artifact": "fc324d3547104276b827a68afc52ff2a11cc49c9",
  "pnpm/action-setup": "ea17c68df8912ef543352723c149a84f56e3d413",
};

describe("release workflow", () => {
  test("pins every third-party workflow action to its verified commit", () => {
    const workflowNames = readdirSync(
      resolve(process.cwd(), ".github/workflows"),
    )
      .filter((name) => name.endsWith(".yml"))
      .sort();
    const seenActions = new Set<string>();

    for (const workflowName of workflowNames) {
      const workflow = readRepoFile(`.github/workflows/${workflowName}`);
      const uses = workflow.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g);

      for (const [, action, ref] of uses) {
        if (action.startsWith("./")) continue;
        seenActions.add(action);
        expect(ref, `${workflowName}: ${action}`).toBe(
          officialActionPins[action],
        );
      }
    }

    expect([...seenActions].sort()).toEqual(
      Object.keys(officialActionPins).sort(),
    );
  });

  test("keeps immutable action pins reviewable through Dependabot", () => {
    const dependabot = readRepoFile(".github/dependabot.yml");

    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    expect(dependabot).toContain('directory: "/"');
    expect(dependabot).toContain('interval: "monthly"');
  });

  test("ships no desktop installer or release-please pipeline", () => {
    const workflowNames = readdirSync(
      resolve(process.cwd(), ".github/workflows"),
    );
    expect(workflowNames).not.toContain("release.yml");
    expect(workflowNames).not.toContain("release-please.yml");
    for (const name of workflowNames) {
      const workflow = readRepoFile(`.github/workflows/${name}`);
      expect(workflow, name).not.toMatch(/electron/i);
    }
  });

  test("CHANGELOG.md is generated from the in-app changelog", async () => {
    const { renderChangelog } = (await import("./build-changelog.mjs")) as {
      renderChangelog: (data: unknown) => string;
    };
    const data = JSON.parse(readRepoFile("src/data/changelog.json"));
    expect(readRepoFile("CHANGELOG.md")).toBe(renderChangelog(data));
  });

  test("a new changelog version on main publishes its own release", async () => {
    const workflow = readRepoFile(".github/workflows/github-release.yml");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("node scripts/release-notes.mjs");
    expect(workflow).toContain('gh release view "$TAG"');
    expect(workflow).toContain("gh release create");

    const { renderRelease } = (await import("./release-notes.mjs")) as {
      renderRelease: (
        data: unknown,
        packageVersion: string,
      ) => { tag: string; title: string; body: string };
    };
    const data = JSON.parse(readRepoFile("src/data/changelog.json"));
    const pkg = JSON.parse(readRepoFile("package.json"));
    const release = renderRelease(data, pkg.version);
    const latest = data.versions[0];
    expect(release.tag).toBe(`v${pkg.version}`);
    expect(release.title).toBe(`v${pkg.version} — ${latest.title}`);
    expect(release.title).not.toContain("\n");
    expect(release.body).toContain("https://rexiano.vercel.app/");
    for (const item of [...latest.items, ...latest.en.items]) {
      expect(release.body).toContain(`- ${item}`);
    }
    expect(() => renderRelease(data, "9.9.9")).toThrow(/does not match/);
  });

  test("CI checks can still be dispatched for an exact commit", () => {
    for (const workflowPath of [
      ".github/workflows/ci.yml",
      ".github/workflows/playwright.yml",
    ]) {
      const workflow = readRepoFile(workflowPath);
      expect(workflow).toContain("workflow_dispatch:");
      expect(workflow).toContain("expected_sha:");
      expect(workflow).toContain("Assert dispatched commit SHA");
      expect(workflow).toContain(
        "if: ${{ github.event_name == 'workflow_dispatch' }}",
      );
      expect(workflow).toContain(
        '[[ "$(git rev-parse HEAD)" == "$EXPECTED_SHA" ]]',
      );
    }
  });

  test("documents conventional squash subjects and the changelog", () => {
    const agentInstructions = readRepoFile("AGENTS.md");

    expect(agentInstructions).toContain("Conventional Commit");
    expect(agentInstructions).toContain("fix: ");
    expect(agentInstructions).toContain("feat: ");
    expect(agentInstructions).toContain("src/data/changelog.json");
  });
});
