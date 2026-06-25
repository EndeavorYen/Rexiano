# Session Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Rexiano flow: one `Start Playing` main-menu entry, song preview with `Practice` and `Play Along` CTAs, and playback behavior that skips the mode modal for play-along sessions.

**Architecture:** Keep the current `menu | library | playback` route model. Add a tiny session-intent helper in the practice feature boundary, pass intent from `SongLibrary` to `App`, and let `usePostSessionFlow` decide whether a newly loaded song needs the mode-selection modal. Reuse existing `free` practice mode for user-facing `Play Along`.

**Tech Stack:** Electron renderer, React 19, TypeScript, Zustand, Vitest.

---

## File Structure

- Create `src/renderer/src/features/practice/sessionIntent.ts`
  - Defines `PracticeSessionIntent`.
  - Maps intent to existing `PracticeMode`.
  - Decides whether the mode-selection modal is required.
- Create `src/renderer/src/features/practice/sessionIntent.test.ts`
  - Tests the helper before production code exists.
- Modify `src/renderer/src/features/practice/usePostSessionFlow.ts`
  - Accepts current session intent.
  - Suppresses mode modal for `play-along`.
  - Clears post-session UI on song change.
- Modify `src/renderer/src/features/practice/usePostSessionFlow.test.ts`
  - Adds helper-level test coverage for modal decision behavior.
- Modify `src/renderer/src/features/songLibrary/SongLibrary.tsx`
  - Adds `onSessionIntentSelected` prop.
  - Adds `Play Along` CTA next to the existing practice CTA.
  - Calls the intent callback before loading built-in or imported songs.
- Modify `src/renderer/src/features/songLibrary/songLibrarySelectors.ts`
  - Adds a tiny preview CTA model helper so labels/order are testable without React mounting.
- Modify `src/renderer/src/features/songLibrary/songLibrarySelectors.test.ts`
  - Tests Practice and Play Along CTA model.
- Modify `src/renderer/src/App.tsx`
  - Stores selected session intent.
  - Passes intent into `SongLibrary` and `usePostSessionFlow`.
  - Applies `play-along` as `free` after per-song setup loads.
  - Shows a playback chip for the user-facing session mode.
- Modify `src/renderer/src/locales/en.ts`, `src/renderer/src/locales/zh-TW.ts`, and `src/renderer/src/i18n/types.ts`
  - Adds `Start Playing`, `Play Along`, and session-mode labels.

## Task 1: Session Intent Helper

**Files:**
- Create: `src/renderer/src/features/practice/sessionIntent.ts`
- Create: `src/renderer/src/features/practice/sessionIntent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import {
  mapSessionIntentToMode,
  shouldPromptForPracticeMode,
} from "./sessionIntent";

describe("session intent", () => {
  test("practice keeps the saved mode and prompts for detailed mode choice", () => {
    expect(mapSessionIntentToMode("practice", "wait")).toBe("wait");
    expect(shouldPromptForPracticeMode("practice")).toBe(true);
  });

  test("play along maps to free mode and skips the mode prompt", () => {
    expect(mapSessionIntentToMode("play-along", "wait")).toBe("free");
    expect(shouldPromptForPracticeMode("play-along")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/practice/sessionIntent.test.ts
```

Expected: fail because `sessionIntent.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { PracticeMode } from "@shared/types";

export type PracticeSessionIntent = "practice" | "play-along";

export function mapSessionIntentToMode(
  intent: PracticeSessionIntent,
  savedMode: PracticeMode,
): PracticeMode {
  return intent === "play-along" ? "free" : savedMode;
}

export function shouldPromptForPracticeMode(
  intent: PracticeSessionIntent,
): boolean {
  return intent === "practice";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run same command. Expected: pass.

## Task 2: Post-Session Modal Decision

**Files:**
- Modify: `src/renderer/src/features/practice/usePostSessionFlow.ts`
- Modify: `src/renderer/src/features/practice/usePostSessionFlow.test.ts`

- [ ] **Step 1: Write the failing test**

Add a pure helper test:

```ts
import { shouldShowModeSelectionModal } from "./usePostSessionFlow";

describe("shouldShowModeSelectionModal", () => {
  test("shows mode selection only when a practice session loads a new song", () => {
    expect(
      shouldShowModeSelectionModal({
        previousHadSong: false,
        nextHasSong: true,
        intent: "practice",
      }),
    ).toBe(true);
    expect(
      shouldShowModeSelectionModal({
        previousHadSong: false,
        nextHasSong: true,
        intent: "play-along",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/practice/usePostSessionFlow.test.ts
```

Expected: fail because `shouldShowModeSelectionModal` is missing.

- [ ] **Step 3: Write minimal implementation**

Add the helper and pass `sessionIntent` into `usePostSessionFlow`. In the song-store subscription, call the helper before setting `showModeModal`.

- [ ] **Step 4: Run test to verify it passes**

Run same command. Expected: pass.

## Task 3: Song Preview CTA Model

**Files:**
- Modify: `src/renderer/src/features/songLibrary/songLibrarySelectors.ts`
- Modify: `src/renderer/src/features/songLibrary/songLibrarySelectors.test.ts`

- [ ] **Step 1: Write the failing test**

Add:

```ts
import { buildSongPreviewSessionActions } from "./songLibrarySelectors";

describe("buildSongPreviewSessionActions", () => {
  test("offers practice first and play along second", () => {
    expect(buildSongPreviewSessionActions("practice")).toEqual([
      {
        intent: "practice",
        labelKey: "library.recommendation.cta",
        emphasis: "primary",
      },
      {
        intent: "play-along",
        labelKey: "library.preview.playAlong",
        emphasis: "secondary",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/songLibrary/songLibrarySelectors.test.ts
```

Expected: fail because helper is missing.

- [ ] **Step 3: Write minimal implementation**

Add the helper and export it.

- [ ] **Step 4: Run test to verify it passes**

Run same command. Expected: pass.

## Task 4: Wire Preview CTAs and App Intent

**Files:**
- Modify: `src/renderer/src/features/songLibrary/SongLibrary.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/locales/en.ts`
- Modify: `src/renderer/src/locales/zh-TW.ts`
- Modify: `src/renderer/src/i18n/types.ts`

- [ ] **Step 1: Write/extend failing tests from Tasks 1-3 first**

The production wiring should only start after Tasks 1-3 are red-green. No new
React mount test is required because this repo does not use React Testing
Library; the behavior is covered through pure helpers and focused store/hook
logic.

- [ ] **Step 2: Implement minimal wiring**

- In `SongLibraryProps`, add:

```ts
onSessionIntentSelected?: (intent: PracticeSessionIntent) => void;
```

- In preview CTA handlers, call `onSessionIntentSelected(intent)` before loading
  the song.
- In `App`, keep:

```ts
const [sessionIntent, setSessionIntent] =
  useState<PracticeSessionIntent>("practice");
```

- Pass `sessionIntent` to `usePostSessionFlow`.
- Pass `setSessionIntent` to `SongLibrary`.
- After per-song setup loads, use `mapSessionIntentToMode(sessionIntent, setup.defaultMode)`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm test src/renderer/src/features/practice/sessionIntent.test.ts src/renderer/src/features/practice/usePostSessionFlow.test.ts src/renderer/src/features/songLibrary/songLibrarySelectors.test.ts
```

Expected: pass.

## Task 5: Verification

**Files:**
- All changed files.

- [ ] **Step 1: Typecheck**

Run:

```bash
env PATH=/Users/simon/.hermes/node/bin:/usr/bin:/bin:/usr/sbin:/sbin pnpm typecheck
```

Expected: pass.

- [ ] **Step 2: Focused UI smoke**

If a dev server is already open at `http://localhost:9066/`, use the in-app
browser to confirm the library preview exposes `Practice` and `Play Along`.

- [ ] **Step 3: Report exact verification**

Report focused tests, typecheck, and browser smoke status.
