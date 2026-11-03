import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const readRepoFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const officialActionPins: Record<string, string> = {
  "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/configure-pages": "45bfe0192ca1faeb007ade9deae92b16b8254a0d",
  "actions/deploy-pages": "368f82528645a54fb793d4d04e342629a3f51346",
  "actions/setup-node": "820762786026740c76f36085b0efc47a31fe5020",
  "actions/upload-artifact": "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "actions/upload-pages-artifact": "fc324d3547104276b827a68afc52ff2a11cc49c9",
  "googleapis/release-please-action":
    "45996ed1f6d02564a971a2fa1b5860e934307cf7",
  "pnpm/action-setup": "ea17c68df8912ef543352723c149a84f56e3d413",
};

describe("release workflow", () => {
  const releasePleaseWorkflow = readRepoFile(
    ".github/workflows/release-please.yml",
  );

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

  test("publishes Release Please releases as version notes for the web app", () => {
    const config = JSON.parse(readRepoFile("release-please-config.json")) as {
      draft?: boolean;
      "force-tag-creation"?: boolean;
      "include-component-in-tag"?: boolean;
    };

    // Vercel deploys main; a release is only a tagged changelog entry.
    expect(config.draft).toBe(false);
    expect(config["force-tag-creation"]).toBe(true);
    expect(config["include-component-in-tag"]).toBe(false);
    expect(releasePleaseWorkflow).toContain(
      `uses: googleapis/release-please-action@${officialActionPins["googleapis/release-please-action"]}`,
    );
    expect(releasePleaseWorkflow).not.toContain("release-type:");
    expect(releasePleaseWorkflow).toContain(
      "config-file: release-please-config.json",
    );
    expect(releasePleaseWorkflow).toContain(
      "manifest-file: .release-please-manifest.json",
    );
    expect(releasePleaseWorkflow).not.toContain("release.yml");
  });

  test("ships no desktop installer pipeline", () => {
    const workflowNames = readdirSync(
      resolve(process.cwd(), ".github/workflows"),
    );
    expect(workflowNames).not.toContain("release.yml");
    for (const name of workflowNames) {
      const workflow = readRepoFile(`.github/workflows/${name}`);
      expect(workflow, name).not.toMatch(/electron/i);
    }
  });

  test("dispatches required checks for token-created release pull requests", () => {
    expect(releasePleaseWorkflow).toContain(
      "if: ${{ steps.release.outputs.prs_created == 'true' }}",
    );
    expect(releasePleaseWorkflow).toContain(
      "RELEASE_PRS: ${{ steps.release.outputs.prs }}",
    );
    expect(releasePleaseWorkflow).toContain(
      'jq -er \'length == 1 and .[0].baseBranchName == "main"',
    );
    expect(releasePleaseWorkflow).toContain(
      'git/ref/heads/$release_branch" --jq .object.sha',
    );
    expect(releasePleaseWorkflow).toContain(
      '.github/workflows/ci.yml --repo "$GITHUB_REPOSITORY" --ref "$release_branch"',
    );
    expect(releasePleaseWorkflow).toContain(
      '.github/workflows/playwright.yml --repo "$GITHUB_REPOSITORY" --ref "$release_branch"',
    );
    expect(releasePleaseWorkflow).toContain(
      '--field expected_sha="$release_sha"',
    );

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

  test("documents conventional squash subjects for release notes", () => {
    const agentInstructions = readRepoFile("AGENTS.md");

    expect(agentInstructions).toContain("Conventional Commit");
    expect(agentInstructions).toContain("fix: ");
    expect(agentInstructions).toContain("feat: ");
    expect(agentInstructions).toContain("release-please");
  });
});
