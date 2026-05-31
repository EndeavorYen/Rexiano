import { test, expect } from "./fixtures/electronApp";
import { collectViewportAudit } from "./helpers/viewportAudit";

test.describe("Viewport audit helper", () => {
  test("classifies offscreen controls inside reachable scroll containers separately", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 800, height: 600 });
    await appPage.setContent(`
      <main style="height: 600px; overflow: hidden;">
        <section
          data-testid="song-library-scroll-region"
          style="height: 220px; overflow-y: auto; border: 1px solid #999;"
        >
          <button data-testid="visible-song">Visible song</button>
          <div style="height: 720px;"></div>
          <button data-testid="scroll-contained-song">Below the fold</button>
        </section>
      </main>
    `);

    const audit = await collectViewportAudit(appPage);

    expect(audit.viewportOverflow.map((issue) => issue.testId)).not.toContain(
      "scroll-contained-song",
    );
    expect(audit.scrollContainedOffscreen).toEqual([
      expect.objectContaining({
        testId: "scroll-contained-song",
        scrollContainerTestId: "song-library-scroll-region",
      }),
    ]);
  });

  test("reports controls clipped outside the viewport without a scroll container", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 800, height: 600 });
    await appPage.setContent(`
      <button
        data-testid="clipped-settings"
        style="position: fixed; top: -24px; left: 12px; width: 120px; height: 40px;"
      >
        Settings
      </button>
    `);

    const audit = await collectViewportAudit(appPage);

    expect(audit.scrollContainedOffscreen).toEqual([]);
    expect(audit.viewportOverflow).toEqual([
      expect.objectContaining({
        testId: "clipped-settings",
        y: -24,
      }),
    ]);
  });
});
