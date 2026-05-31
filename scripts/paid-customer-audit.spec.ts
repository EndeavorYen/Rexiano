import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { test, expect, waitForUiSettled } from "../e2e/fixtures/electronApp";
import {
  collectViewportAudit,
  type ViewportAuditIssue,
} from "../e2e/helpers/viewportAudit";

const outDir =
  process.env.REXIANO_PAID_AUDIT_OUT_DIR ?? "/private/tmp/rexiano-paid-qa";
const screens = join(outDir, "screens");
mkdirSync(screens, { recursive: true });

test.setTimeout(90_000);

test("paid customer refund-hunt audit", async ({ electronApp }) => {
  const appPage = await electronApp.firstWindow();
  await appPage.waitForLoadState("domcontentloaded");

  const logs: Array<{ type: string; text: string }> = [];
  const findings: unknown[] = [];
  const observations: unknown[] = [];
  const snapshots: Array<{ name: string; path: string; url: string }> = [];

  appPage.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });
  appPage.on("pageerror", (error) => {
    logs.push({ type: "pageerror", text: String(error.stack ?? error) });
  });

  async function shot(name: string): Promise<void> {
    const path = join(screens, `${name}.png`);
    await appPage.screenshot({ path, fullPage: false });
    snapshots.push({ name, path, url: appPage.url() });
  }

  async function auditSettled(): Promise<void> {
    await waitForUiSettled(appPage);
    await appPage.waitForTimeout(700);
  }

  async function domText(selector: string): Promise<string> {
    return appPage
      .locator(selector)
      .evaluate((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .catch(() => "");
  }

  async function viewportIssues(label: string): Promise<ViewportAuditIssue[]> {
    const audit = await collectViewportAudit(appPage);
    if (audit.viewportOverflow.length > 0) {
      findings.push({
        label,
        kind: "viewport-overflow",
        issues: audit.viewportOverflow,
      });
    }
    if (audit.scrollContainedOffscreen.length > 0) {
      observations.push({
        label,
        kind: "scroll-contained-offscreen",
        issues: audit.scrollContainedOffscreen,
      });
    }
    return audit.viewportOverflow;
  }

  async function safeFlow(
    label: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      findings.push({
        label,
        kind: "flow-error",
        message: String(error instanceof Error ? error.stack : error),
      });
      await shot(`error-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
    }
  }

  await safeFlow("first launch and onboarding", async () => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await auditSettled();
    await shot("01-first-launch");
    await viewportIssues("first launch desktop");

    await expect(appPage.getByTestId("onboarding-card")).toBeVisible();
    for (const name of ["02-onboarding-step-2", "03-onboarding-step-3"]) {
      await appPage.getByTestId("onboarding-next").click();
      await auditSettled();
      await shot(name);
    }
    await appPage.getByTestId("onboarding-skip").click();
    await auditSettled();
  });

  await safeFlow("library to practice", async () => {
    await appPage
      .getByRole("button", { name: /Start|Practice|開始|練習/i })
      .first()
      .click();
    await auditSettled();
    await shot("04-library");
    await viewportIssues("library desktop");

    await appPage.getByTestId("song-select-hot-cross-buns").click();
    await auditSettled();
    await shot("05-song-preview");
    await appPage.getByTestId("song-selection-preview-practice").click();
    await auditSettled();
    await shot("06-mode-choice");
    await appPage.getByTestId("mode-select-wait").click();
    await auditSettled();
    await shot("07-practice-start");
  });

  await safeFlow("practice and sheet mode", async () => {
    await viewportIssues("practice desktop");
    const headerText = await domText("[data-testid='playback-header-panel']");
    const diagnostic = await domText("[data-testid='midi-diagnostic-notice']");
    if (
      /MIDI quality warning|MIDI 品質|Review MIDI quality/i.test(diagnostic)
    ) {
      findings.push({
        label: "practice start",
        kind: "trust-warning",
        message:
          "A bundled starter song opens with a MIDI quality warning, so paid content feels unvetted.",
        headerText,
        diagnostic,
      });
    }

    await appPage.getByTestId("playback-drawer-trigger").click();
    await auditSettled();
    await shot("08-playback-settings");
    await viewportIssues("playback drawer desktop");
    await appPage.getByTestId("display-mode-sheet").click();
    await auditSettled();
    await appPage.keyboard.press("Escape");
    await auditSettled();
    await shot("09-sheet-mode");

    const sheetStats = await appPage.evaluate(() => {
      const host = document.querySelector(
        "[data-testid='sheet-music-svg-host']",
      );
      const svg = host?.querySelector("svg");
      const glyphs = svg?.querySelectorAll(
        "path,rect,ellipse,circle,line,polygon,polyline,text",
      );
      return {
        hasSvg: !!svg,
        glyphCount: glyphs?.length ?? 0,
        hostText:
          host?.textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "",
      };
    });
    if (!sheetStats.hasSvg || sheetStats.glyphCount < 20) {
      findings.push({
        label: "sheet mode",
        kind: "blank-or-weak-sheet",
        message:
          "Sheet mode did not render enough notation to satisfy a paying user.",
        sheetStats,
      });
    }
  });

  await safeFlow("narrow viewport practice", async () => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await auditSettled();
    await shot("10-mobile-practice");
    await viewportIssues("practice narrow");
    await appPage.getByTestId("playback-drawer-trigger").click();
    await auditSettled();
    await shot("11-mobile-drawer");
    await viewportIssues("drawer narrow");
    await appPage.getByTestId("open-editor").scrollIntoViewIfNeeded();
    await appPage.getByTestId("open-editor").click();
    await auditSettled();
    await shot("12-mobile-editor");
    await viewportIssues("editor narrow");
    const scrollStats = await appPage
      .getByTestId("piano-roll-scroll")
      .evaluate((el) => ({
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
      }));
    if (scrollStats.clientWidth < 180 || scrollStats.clientHeight < 160) {
      findings.push({
        label: "mobile editor",
        kind: "too-small-editor",
        message: "Piano roll editor canvas is too small for practical editing.",
        scrollStats,
      });
    }
  });

  await safeFlow("settings in playback", async () => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await auditSettled();
    const closeEditor = appPage.getByTestId("close-editor");
    if ((await closeEditor.count()) > 0 && (await closeEditor.isVisible())) {
      await closeEditor.click();
      await auditSettled();
    }
    await appPage.getByTestId("playback-drawer-trigger").click();
    await auditSettled();
    await appPage.getByTestId("settings-trigger").click();
    await auditSettled();
    await shot("13-settings-in-playback");
    await viewportIssues("settings in playback");
    if ((await appPage.getByTestId("settings-tab-about").count()) === 0) {
      await appPage.getByTestId("settings-mode-toggle").click();
    }
    await appPage.getByTestId("settings-tab-about").click();
    await auditSettled();
    await shot("14-about-update");
  });

  const report = {
    generatedAt: new Date().toISOString(),
    title: await appPage.title(),
    url: appPage.url(),
    logs,
    findings,
    observations,
    snapshots,
  };
  writeFileSync(
    join(outDir, "paid-customer-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
});
