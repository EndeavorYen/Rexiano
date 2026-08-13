# Rexiano Production Readiness Round 2 Design

**Status:** Accepted for autonomous execution on 2026-08-13  
**Baseline:** `main@fc8d221`  
**Goal:** Close every reproducible P1/P2 found by the second independent audit,
while leaving hardware credentials and physical-device certification fail closed.

## Evidence boundary

The audit ran the full local baseline (`1239` Vitest tests and `77` Electron
flows), then added real filesystem, Electron IPC, timing, accessibility-tree,
GitHub Actions, and public-deployment probes. Issues #190–#214 contain the
individual reproductions and acceptance criteria. Issue #197 was closed only
after Pages was enabled, deployment run `31692361003` succeeded, and the live
site plus its primary assets returned HTTP 200.

## Architecture decisions

### 1. Playback owns discontinuities

Seek, reset, speed, recovery, practice mode, and active-track transitions must
not compete through independent store subscriptions. A user discontinuity is a
single command that updates the AudioScheduler/TransportClock authority first,
then publishes the resulting playback state. Wait pause preserves its target;
manual reset deliberately clears the whole practice session. Chord grouping is
based on musical onset, never the input timing tolerance.

### 2. Persistent JSON is a main-owned transaction

Every writer of `progress.json` and `recents.json` uses the same per-path queue.
Writes stage in the same directory and atomically replace the target. Backup
import/reset adds a transaction coordinator above the atomic writer so a later
scope or renderer-storage failure cannot leave mixed old/new state. Corrupt
data is preserved for recovery instead of silently overwritten as an empty
profile.

### 3. Filesystem authority is canonical and non-transferable

Native file/folder selection and OS file-open events are the only ways to grant
authority. Main records canonical paths; every scan/load rechecks the canonical
regular target and containment. Restored metadata never grants new filesystem
authority. MIDI size is bounded before bytes are read and expanded for IPC.

### 4. Update and Electron privileges remain in main

Renderer code never selects an arbitrary update URL or executable path. Main
owns release metadata, exact platform artifact selection, streaming download,
size/digest verification, atomic promotion, and the one verified path that may
be opened. Every privileged IPC validates the trusted top-level renderer frame;
the renderer is sandboxed and navigation is pinned to its configured entry.

### 5. Desktop and release entry points are real workflows

OS `.mid/.midi` opens are queued across cold start and routed to the existing
import/recovery UI; warm opens reuse and focus the single instance. Release
Please preserves the existing unprefixed `vMAJOR.MINOR.PATCH` series. Automated
release PRs must run required CI/E2E, and one explicit immutable-SHA dispatch is
the sole artifact workflow trigger. External signing/notarization remains
tracked by #187 until real credentials and platform smoke evidence exist.

### 6. UI semantics come from shared roles and intent

Keyboard song selection advances focus to the Practice action. ThemePicker is
a real keyboard/ARIA popup. Player-facing strings use i18n keys. Selected and
danger states use theme semantic foregrounds. Base form-control styling is
layered so component typography utilities remain authoritative.

## Delivery waves

1. **Gameplay core:** #198–#206.
2. **Data/filesystem:** #191–#194 and #212.
3. **Platform/security/release:** #192, #195, #196, #213, #214; #190 is already
   implemented, and #197 is externally closed.
4. **UI/UX:** #207–#211.

Each wave follows Red → Green → Refactor, uses issue-scoped conventional
commits, and receives an independent read-only review. The branch is not
mergeable until all blocking/important review findings are fixed and the full
Electron suite is green.

## Release certification boundary

The branch may merge with #187 open only if official release publication stays
fail closed when signing/notarization secrets are absent. No unsigned build is
described as production-ready. Physical USB/BLE MIDI, OS sleep/wake, and signed
Windows/macOS installation remain explicit external smoke gates.
