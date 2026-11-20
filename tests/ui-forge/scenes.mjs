// ui-forge scenes: every screen and state of Rexiano, reachable from clean storage.
// Used by ui-forge's shoot-states.mjs / inventory.mjs / a11y gates. Needs the e2e build (pnpm build:e2e).
const SETTINGS = {
  language: "zh-TW",
  defaultMode: "watch",
  metronomeEnabled: false,
  countInBeats: 0,
  showNoteLabels: true,
  showFallingNoteLabels: true,
};
const base = {
  "rexiano-settings": SETTINGS,
  "rexiano-onboarding-completed": "1",
};
const ready = async (p) => {
  await p.waitForFunction(() => typeof window.api === "object");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
};
const toLibrary = async (p) => {
  await ready(p);
  await p.evaluate(() => {
    window.location.hash = "#/library";
  });
  await p
    .getByTestId("library-device-drawer-trigger")
    .waitFor({ timeout: 20000 });
  await p.waitForTimeout(500);
};
const toPreview = async (p, id = "hot-cross-buns") => {
  await toLibrary(p);
  await p.getByTestId(`song-select-${id}`).first().click();
  await p.getByTestId("song-selection-preview-practice").waitFor();
  await p.waitForTimeout(300);
};
const toModePick = async (p, id) => {
  await toPreview(p, id);
  await p.getByTestId("song-selection-preview-practice").click();
  await p.getByTestId("mode-select-wait").waitFor();
  await p.waitForTimeout(300);
};
const toPlayback = async (p, mode = "wait", id) => {
  await toModePick(p, id);
  await p.getByTestId(`mode-select-${mode}`).click();
  await p.locator(".workspace-frame").waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
};
const celebrate = async (p, score) => {
  await toPlayback(p, "wait");
  await p.evaluate(
    (s) =>
      window.__rexianoShowCelebrationFixture({
        score: s,
        mode: "wait",
        speed: 0.75,
      }),
    score,
  );
  await p.getByTestId("celebration-overlay").waitFor();
  await p.waitForTimeout(1200);
};

const FIXTURE_GOOD = {
  totalNotes: 40,
  hitNotes: 38,
  missedNotes: 2,
  accuracy: 95,
  currentStreak: 12,
  bestStreak: 26,
};
const FIXTURE_LOW = {
  totalNotes: 40,
  hitNotes: 18,
  missedNotes: 22,
  accuracy: 45,
  currentStreak: 1,
  bestStreak: 5,
};

export default [
  {
    name: "onboarding",
    url: "/",
    storage: { "rexiano-settings": SETTINGS },
    run: ready,
  },
  { name: "menu", url: "/", storage: base, run: ready },
  { name: "library", url: "/", storage: base, run: toLibrary },
  {
    name: "library-list",
    url: "/",
    storage: base,
    run: async (p) => {
      await toLibrary(p);
      await p.getByTestId("song-library-view-list").click();
      await p.waitForTimeout(300);
    },
  },
  {
    name: "library-drawer",
    url: "/",
    storage: base,
    run: async (p) => {
      await toLibrary(p);
      await p.getByTestId("library-device-drawer-trigger").click();
      await p.locator(".app-side-drawer").waitFor();
      await p.waitForTimeout(400);
    },
  },
  { name: "preview", url: "/", storage: base, run: (p) => toPreview(p) },
  { name: "mode-pick", url: "/", storage: base, run: (p) => toModePick(p) },
  {
    name: "play-wait",
    url: "/",
    storage: base,
    run: (p) => toPlayback(p, "wait"),
  },
  {
    name: "play-watch",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p, "watch");
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "play-falling",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p, "wait");
      await p.getByTestId("display-mode-falling").click();
      await p.waitForTimeout(1200);
    },
  },
  {
    name: "play-drawer",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p, "wait");
      await p.getByTestId("playback-drawer-trigger").click();
      await p.locator(".app-side-drawer").waitFor();
      await p.waitForTimeout(400);
    },
  },
  {
    name: "celebration",
    url: "/",
    storage: base,
    run: (p) => celebrate(p, FIXTURE_GOOD),
  },
  {
    name: "celebration-low",
    url: "/",
    storage: base,
    run: (p) => celebrate(p, FIXTURE_LOW),
  },
  {
    name: "settings",
    url: "/",
    storage: base,
    run: async (p) => {
      await ready(p);
      await p.getByTestId("main-menu-settings").click();
      await p.getByTestId("settings-panel").waitFor();
      await p.waitForTimeout(400);
    },
  },
  {
    name: "changelog",
    url: "/",
    storage: base,
    run: async (p) => {
      await ready(p);
      await p.getByTestId("changelog").click();
      await p.getByTestId("changelog-sheet").waitFor();
      await p.waitForTimeout(400);
    },
  },
];
