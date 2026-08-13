# Production Readiness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed runtime, practice-flow, accessibility, contrast, BLE MIDI, and release-gate defects tracked in #180–#187.

**Architecture:** Preserve existing engine/store/feature boundaries. Add pure policy/state helpers where Electron or React lifecycle behavior needs deterministic tests, wire them through existing callback/contextBridge patterns, and keep release acceptance fail-closed.

**Tech Stack:** Electron 39, React 19, TypeScript 5.9, Zustand 5, Vitest 4, Playwright, GitHub Actions, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-13-production-readiness-design.md`

## Global Constraints

- Do not add dependencies.
- Every behavior change follows Red -> Green -> Refactor and records the focused failing command.
- Preserve `number[]` across Electron binary IPC, callback-based engines, named exports, semantic theme tokens, and colocated `*.test.ts` conventions.
- Do not publish unsigned artifacts as production releases.
- Do not close #187 until real Windows and macOS signature evidence exists.

---

### Task 1: Live playback speed continuity (#180)

**Files:**
- Modify: `src/renderer/src/engines/audio/AudioScheduler.test.ts`
- Modify: `src/renderer/src/engines/audio/AudioScheduler.ts`

**Interfaces:**
- Consumes: `IAudioEngine.releaseScheduledAfter(audioTime)` and `AudioContext.currentTime`.
- Produces: `setSpeed(speed)` that preserves running song time and reschedules only future notes.

- [ ] Add focused tests for 1.0x -> 0.5x, 1.0x -> 2.0x, future-schedule release, cursor reset, paused behavior, and unchanged speed.
- [ ] Run `pnpm test -- src/renderer/src/engines/audio/AudioScheduler.test.ts` and capture the expected continuity failure.
- [ ] Implement the smallest atomic rebase in `setSpeed()`.
- [ ] Rerun the focused test to green, then the audio/transport test group.

### Task 2: Explicit BLE MIDI device selection (#181)

**Files:**
- Create/modify pure selection policy and colocated tests under `src/main/ipc/`.
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/shared/types.ts`.
- Add the smallest renderer picker component/tests and wire it in `src/renderer/src/App.tsx`.
- Add Electron E2E coverage under `e2e/` when the selection event can be deterministically injected.

**Interfaces:**
- Produces: discovered device snapshots `{ deviceId, deviceName }`, explicit select/cancel commands, and exactly-once callback resolution.

- [ ] Add failing policy/lifecycle tests for arbitrary vendor names, unnamed devices, duplicate discovery, cancellation, replacement, and teardown.
- [ ] Add a failing renderer interaction test for keyboard selection/cancel.
- [ ] Implement a narrow callback-based IPC bridge and modal picker without product-name filtering.
- [ ] Run focused main/preload/renderer tests and the relevant Electron E2E.

### Task 3: Practice entry, back, and retry intent (#182)

**Files:**
- Modify: `src/renderer/src/features/practice/ModeSelectionModal.tsx` and tests.
- Modify: `src/renderer/src/features/practice/usePostSessionFlow.ts` and tests.
- Modify: `src/renderer/src/App.tsx` only for lifecycle wiring.
- Modify/add: `e2e/per-song-setup.spec.ts`, `e2e/practice-next-action.spec.ts`.

**Interfaces:**
- Produces: Watch/Wait/Free selection, default-mode indication, `onDismiss`, and retry that begins at zero in the existing mode.

- [ ] Add failing unit/component tests for Watch availability, saved default, Back/Escape, and retry playback state.
- [ ] Implement the minimal state transitions and focus-safe dismissal.
- [ ] Add player-visible E2E for Watch entry, cancel/back, and retry.
- [ ] Run focused tests and E2E to green.

### Task 4: Accessible Insights and import recovery (#183, #184)

**Files:**
- Modify: `src/renderer/src/App.tsx`.
- Modify components/tests only where an accessible label/ID belongs locally.
- Modify: `e2e/accessibility-core.spec.ts`, `e2e/error-recovery.spec.ts`.

**Interfaces:**
- Consumes: `useDialogFocus`.
- Produces: keyboard-modal Insights lifecycle and an announced, labelled import recovery region.

- [ ] Add failing E2E assertions for Insights dialog semantics, focus trap, Escape, and trigger restoration.
- [ ] Add failing E2E/unit assertions for import alert and recovery group semantics.
- [ ] Wire existing dialog focus handling and semantic attributes with no visual redesign.
- [ ] Run focused E2E to green.

### Task 5: Semantic theme contrast (#185)

**Files:**
- Modify: `src/renderer/src/themes/tokens.ts`, `tokens.test.ts`.
- Modify: `src/renderer/src/assets/main.css`.
- Modify: `src/renderer/src/features/insights/InsightsPanel.tsx`.
- Modify: `e2e/ui-polish.spec.ts` and snapshots if rendered output intentionally changes.

**Interfaces:**
- Produces: `onAccent`, `successText`, and `dangerText` semantic colors applied as CSS variables.

- [ ] Add failing WCAG contrast tests against hand-derived primary-gradient endpoints and status surfaces for all themes.
- [ ] Add semantic token values that meet >= 4.5:1 and expose them through the existing theme application path.
- [ ] Replace raw UI status hex values with semantic variables.
- [ ] Run theme tests and light/Midnight visual checks to green.

### Task 6: Fail-closed release acceptance and certification (#186, #187)

**Files:**
- Modify: `.github/workflows/release.yml`.
- Modify: `package.json` only if a shared checked packaging script is necessary.
- Modify: `scripts/releaseWorkflow.test.ts`.
- Modify: `docs/release-signing.md`.

**Interfaces:**
- Produces: exact-tag preflight, required Windows E2E, checked packaging paths, signing/notarization verification, and publication dependencies.

- [ ] Add failing workflow contract tests for tag resolution, preflight commands, E2E dependency, checked builds, fail-closed credentials, signature verification, and `create-release.needs`.
- [ ] Implement the minimum workflow wiring and operator documentation.
- [ ] Run the focused workflow test and all script contract tests.
- [ ] Keep #187 open unless real artifacts pass Windows and macOS verification.

### Task 7: Integrated verification, review, and tracking

**Files:**
- Modify: `docs/ROADMAP.md` with a dated production-readiness audit section and issue status.

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] Run `pnpm test:e2e` and `pnpm test:visual`.
- [ ] Capture representative menu, practice, Insights, error recovery, and light/dark screenshots.
- [ ] Run an independent whole-branch code review; fix every Critical/Important finding and re-review.
- [ ] Commit small issue-linked changes, push one branch, create one ready PR, wait for all CI, squash merge to `main`, synchronize local `main`, and rerun post-merge smoke.
- [ ] Close #180–#186 only when their acceptance evidence is present; report #187's external certification state honestly.
