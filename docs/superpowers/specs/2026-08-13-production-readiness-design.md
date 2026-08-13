# Production Readiness Hardening Design

## Goal

Close the confirmed player-facing and release-gate gaps found in the 2026-08-13 audit without redesigning Rexiano or broadening the dependency surface.

## Scope

This design covers GitHub issues #180 through #187:

- keep the transport continuous when practice speed changes during playback;
- replace BLE MIDI product-name authorization with explicit discovered-device selection and a recoverable cancel path;
- make Watch, retry, and back/cancel behavior match the player's practice intent;
- make Insights and import-error recovery accessible to keyboard and assistive-technology users;
- guarantee WCAG AA foreground contrast through semantic theme tokens;
- make public release publication depend on static, unit, player-flow, build, signing, and notarization gates.

Issue #187 has an external acceptance condition: repository code can fail closed and verify signatures, but only real Windows/macOS credentials can produce certified artifacts. Missing credentials must block a production release rather than silently downgrade it.

## Architecture

### Playback continuity

`AudioScheduler.setSpeed()` will treat a live speed change as an atomic rebase. It captures the current song time with the old speed, releases unheard scheduled audio, installs the new speed, anchors the scheduler at the current audio clock, resets cursors to the preserved song time, and leaves paused/not-started schedulers free of audio side effects.

### BLE MIDI selection

Bluetooth discovery remains in Electron's main process, but selection policy becomes pure and testable. Main forwards the complete discovered-device list to the renderer through a narrow preload API. The renderer displays a labelled, keyboard-modal device picker and sends an explicit device ID or cancellation back. Main resolves every chooser callback exactly once and clears stale selection state on cancellation, window teardown, or a replacement request. Device names are display metadata only, never an authorization filter.

### Practice intent

The mode dialog will present Watch, Wait, and Free consistently, mark the saved/default mode, and provide Back to library plus Escape. Retry is defined as a fresh run in the current selected mode: position and score reset, result overlays close, scheduler state resets, and playback starts from zero.

### Accessible feedback and theme semantics

All overlays use the existing `useDialogFocus` lifecycle. Insights receives dialog semantics, focus trapping, Escape/backdrop dismissal, and exact trigger focus restoration. Import failures use a live alert plus a labelled recovery action group without stealing focus. Theme tokens gain semantic `onAccent`, `successText`, and `dangerText` roles; primary actions and Insights consume them. Unit tests calculate WCAG relative luminance from literal theme values and enforce 4.5:1 for normal text.

### Release gates

The release workflow resolves the requested tag once and runs a required preflight on that exact ref. Preflight performs frozen install, lint, typecheck, and Vitest. Windows E2E is a required dependency before publication. Every package job uses the checked build path. Production Windows and macOS jobs require signing credentials and verify the resulting signatures/notarization; no unsigned production fallback is published. `create-release` depends on all gates and packages. Workflow contract tests enforce these relationships.

## Error Handling

- Live speed rebase is a no-op when the value is unchanged; invalid speed remains clamped upstream.
- BLE requests always end in one of select, cancel, replacement, or teardown; no callback remains indefinitely pending.
- Back/cancel from mode setup returns to the library without starting an accidental practice session.
- Import alerts preserve keyboard focus while exposing recovery controls.
- Release jobs fail with an actionable message when credentials or verification evidence are missing.

## Verification

- Focused Vitest red/green tests for each pure behavior.
- Electron E2E for practice intent, retry, BLE-picker UI contract, Insights focus lifecycle, import announcement, and light/dark theme rendering.
- `pnpm lint && pnpm typecheck && pnpm test`.
- `pnpm test:e2e` and `pnpm test:visual`.
- Release workflow contract tests and a local production build/package smoke appropriate to macOS.

## Non-goals

- No new dependencies or broad visual redesign.
- No changes to scoring math, notation conversion, MIDI parsing, or the release cadence.
- No claim that public artifacts are certified until real signed artifacts pass platform verification.
