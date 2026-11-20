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

const DAY = 86_400_000;
const session = (songId, accuracy, daysAgo) => ({
  id: `s-${songId}-${daysAgo}`,
  songId,
  songTitle: songId,
  timestamp: Date.now() - daysAgo * DAY - 3_600_000,
  mode: "wait",
  speed: 1,
  score: {
    totalNotes: 40,
    hitNotes: Math.round(accuracy * 0.4),
    missedNotes: 40 - Math.round(accuracy * 0.4),
    accuracy,
    currentStreak: 5,
    bestStreak: 9,
  },
  durationSeconds: 150,
  tracksPlayed: [0],
});
// "A week in": three songs at three stars, one at two, one at one.
const WEEK = [
  session("au-clair-de-la-lune", 95, 0),
  session("hot-cross-buns", 92, 1),
  session("c-major-scale", 91, 2),
  session("lightly-row", 75, 3),
  session("mary-had-a-little-lamb", 50, 4),
];

const ready = async (p) => {
  await p.waitForFunction(() => typeof window.api === "object");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
};
const seedWeek = async (p) => {
  await ready(p);
  await p.evaluate(
    (sessions) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("rexiano", 1);
        open.onupgradeneeded = () => {
          for (const name of ["records", "files"]) {
            if (!open.result.objectStoreNames.contains(name)) {
              open.result.createObjectStore(name);
            }
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("records", "readwrite");
          tx.objectStore("records").put(sessions, "progress");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    WEEK,
  );
  await p.reload();
  await ready(p);
};
const toMap = async (p) => {
  await ready(p);
  await p.getByTestId("adventure-map").waitFor({ timeout: 20000 });
  await p.getByTestId("map-start").waitFor({ timeout: 20000 });
  await p.waitForTimeout(700);
};
const toLibrary = async (p) => {
  await ready(p);
  await p.evaluate(() => {
    window.location.hash = "#/library";
  });
  await p
    .getByTestId("library-device-drawer-trigger")
    .waitFor({ timeout: 20000 });
  await p.getByTestId("song-select-hot-cross-buns").first().waitFor();
  await p.waitForTimeout(600);
};
const toPreview = async (p, id = "hot-cross-buns") => {
  await toLibrary(p);
  await p.getByTestId(`song-select-${id}`).first().click();
  await p.getByTestId("song-selection-preview-practice").waitFor();
  await p.waitForTimeout(400);
};
const toModePick = async (p, id) => {
  await toPreview(p, id);
  await p.getByTestId("song-selection-preview-practice").click();
  await p.getByTestId("mode-select-wait").waitFor();
  await p.waitForTimeout(400);
};
const toPlayback = async (p, mode = "wait", id) => {
  await toModePick(p, id);
  await p.getByTestId(`mode-select-${mode}`).click();
  await p.locator(".workspace-frame").waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
};
const playCorrectNotes = async (p, count) => {
  await p.evaluate(() => window.__rexianoPrepareWaitTargetFixture());
  for (let i = 0; i < count; i += 1) {
    let snapshot = null;
    for (let tries = 0; tries < 80; tries += 1) {
      snapshot = await p.evaluate(() =>
        window.__rexianoGetPracticeSessionFixtureSnapshot(),
      );
      if (snapshot?.waitState === "waiting" && snapshot.waitTargets.length) {
        break;
      }
      await p.waitForTimeout(50);
    }
    await p.evaluate(
      (midi) => window.__rexianoSendMidiNoteFixture(midi),
      snapshot.waitTargets[0],
    );
    await p.waitForTimeout(i === count - 1 ? 110 : 60);
  }
};
const celebrate = async (p, score, mode = "wait") => {
  await toPlayback(p, "wait");
  await p.evaluate(
    ({ score, mode }) =>
      window.__rexianoShowCelebrationFixture({ score, mode, speed: 1 }),
    { score, mode },
  );
  await p.getByTestId("celebration-overlay").waitFor();
  await p.waitForTimeout(2600);
};
const score = (hitNotes, accuracy) => ({
  totalNotes: 40,
  hitNotes,
  missedNotes: 40 - hitNotes,
  accuracy,
  currentStreak: 3,
  bestStreak: 21,
});

export default [
  {
    name: "onboarding",
    url: "/",
    storage: { "rexiano-settings": SETTINGS },
    run: ready,
  },
  { name: "map-new", url: "/", storage: base, run: toMap },
  {
    name: "map-week",
    url: "/",
    storage: base,
    run: async (p) => {
      await seedWeek(p);
      await toMap(p);
    },
  },
  {
    name: "map-picked",
    url: "/",
    storage: base,
    run: async (p) => {
      await seedWeek(p);
      await toMap(p);
      await p.getByTestId("map-station-hot-cross-buns").click();
      await p.waitForTimeout(600);
    },
  },
  { name: "shelf-new", url: "/", storage: base, run: toLibrary },
  {
    name: "shelf-week",
    url: "/",
    storage: base,
    run: async (p) => {
      await seedWeek(p);
      await toLibrary(p);
    },
  },
  {
    name: "shelf-search",
    url: "/",
    storage: base,
    run: async (p) => {
      await toLibrary(p);
      await p.getByTestId("song-library-search").fill("小");
      await p.waitForTimeout(500);
    },
  },
  {
    name: "shelf-empty",
    url: "/",
    storage: base,
    run: async (p) => {
      await toLibrary(p);
      await p.getByTestId("song-library-search").fill("zzzz");
      await p.getByTestId("song-library-empty").waitFor();
      await p.waitForTimeout(300);
    },
  },
  {
    name: "shelf-drawer",
    url: "/",
    storage: base,
    run: async (p) => {
      await toLibrary(p);
      await p.getByTestId("library-device-drawer-trigger").click();
      await p.locator(".app-side-drawer").waitFor();
      await p.waitForTimeout(400);
    },
  },
  {
    name: "preview",
    url: "/",
    storage: base,
    run: async (p) => {
      await seedWeek(p);
      await toPreview(p, "lightly-row");
    },
  },
  { name: "mode-pick", url: "/", storage: base, run: (p) => toModePick(p) },
  { name: "play-wait", url: "/", storage: base, run: (p) => toPlayback(p) },
  {
    name: "play-hit",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p);
      await playCorrectNotes(p, 7);
    },
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
      await toPlayback(p);
      await p.getByTestId("display-mode-falling").click();
      await p.waitForTimeout(1200);
    },
  },
  {
    name: "play-drawer",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p);
      await p.getByTestId("playback-drawer-trigger").click();
      await p.locator(".app-side-drawer").waitFor();
      await p.waitForTimeout(400);
    },
  },
  {
    name: "result-3star",
    url: "/",
    storage: base,
    run: async (p) => {
      await toPlayback(p);
      await playCorrectNotes(p, 17);
      await p.getByTestId("celebration-overlay").waitFor({ timeout: 20000 });
      await p.waitForTimeout(2600);
    },
  },
  {
    name: "result-2star",
    url: "/",
    storage: base,
    run: (p) => celebrate(p, score(30, 75)),
  },
  {
    name: "result-1star",
    url: "/",
    storage: base,
    run: (p) => celebrate(p, score(18, 45)),
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
