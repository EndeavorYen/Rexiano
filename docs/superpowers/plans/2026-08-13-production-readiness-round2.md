# Production Readiness Round 2 Implementation Plan

> Execute in the isolated `feature/production-readiness-round2-20260813`
> worktree. Do not weaken tests, trust boundaries, or the fail-closed release
> policy to make a gate pass.

## Wave A — Gameplay core

- [ ] #198: RED Electron + integration tests for live forward/back/reset/slider
      seek; implement one scheduler/transport discontinuity command.
- [ ] #199: RED Wait pause/reset/mode/track lifecycle matrix; implement explicit
      preserve-vs-reset transitions.
- [ ] #200: RED fast-sequence and cross-track chord tests; split onset grouping
      from hit tolerance.
- [ ] #201: RED wrong-only/extra/chord/sustain tests; implement one-shot wrong
      input feedback and scoring.
- [ ] #202: RED deferred audio-rebuild tests; commit latest playback intent.
- [ ] #203: RED multi-pause session tests; persist one terminal session record.
- [ ] #204: RED controlled AudioContext + Electron oscillator tests; wire
      metronome/count-in through playback lifecycle.
- [ ] #205: RED scheduler→MIDI output tests; mirror notes and clear them across
      every discontinuity/device loss.
- [ ] #206: RED successful BLE→unexpected disconnect tests; propagate status and
      clear held notes.

## Wave B — Data and filesystem

- [ ] #191: RED delayed-filesystem interleaving and failure injection; add one
      per-path serialized atomic JSON writer used by every progress/recent
      writer.
- [ ] #212: RED multi-scope/main+renderer rollback tests; add deterministic
      backup transaction and restart recovery.
- [ ] #193: RED real symlink/unapproved folder tests; canonicalize authority and
      require reauthorization after restore.
- [ ] #194: RED byte-boundary/import recovery tests; reject non-regular and
      oversized MIDI before read/IPC expansion.

## Wave C — Platform, security, and release

- [x] #190: Preserve unprefixed tags with a failing then passing workflow
      contract test; stale PR #189 closed.
- [ ] #192: RED argv/open-file/second-instance queue tests; implement
      single-instance OS file-open routing through the import UI.
- [ ] #195: RED hostile update descriptor/redirect/digest/path tests; move
      artifact identity, streaming verification, and open authority into main.
- [ ] #196: Configure a least-privilege release automation token, one release
      trigger, and required CI/E2E checks; prove on a regenerated release PR.
- [ ] #213: RED untrusted-frame/navigation tests; sandbox renderer and apply a
      shared privileged IPC trust guard.
- [ ] #214: Pin every external action to an official immutable commit, add a
      contract test, and enable repository SHA policy when supported.
- [x] #197: Enable Pages, deploy successfully, smoke live assets, set homepage,
      and close with evidence.

## Wave D — UI/UX

- [ ] #207: RED keyboard selection flow; advance focus to the Practice CTA.
- [ ] #208: RED ThemePicker ARIA/Escape/restore tests; implement one coherent
      popup selection model.
- [ ] #209: RED zh-TW AX/raw-English allowlist; move core player strings to i18n.
- [ ] #210: RED rendered contrast matrix; replace literal foregrounds with
      semantic theme roles.
- [ ] #211: RED computed typography; move form reset into the correct CSS layer.

## Independent acceptance

- [ ] Review each completed wave from its issue contracts and exact diff.
- [ ] Fix every P1/P2 reviewer finding; re-review until APPROVED.
- [ ] Run lint, typecheck, all Vitest, production build, full Electron E2E,
      visual/contrast flows, dependency audit, diff check, and packaged smoke.
- [ ] Run a whole-branch review and a final player playtest.
- [ ] Push one reviewable branch, open a conventional-title PR, wait for all
      checks, squash merge to main, rerun post-merge smoke, close resolved
      issues, and remove the worktree/branch.

## Honest external gaps

- [ ] #187 remains open until real Windows Authenticode and macOS Developer ID
      notarization/stapling evidence plus cross-platform installation smoke.
- [ ] Physical USB/BLE MIDI input/output, sustain, OS sleep/wake, and a 30–60
      minute resource soak must be recorded before calling the signed release
      fully hardware-certified.
