# Synthesia-Inspired Optimization Plan

> **TL;DR** — Rexiano should borrow Synthesia's workflow strengths, not its look: faster song selection, richer song metadata, per-song setup, guided practice, and clearer progress. The next high-value slice is a Phase 7.5 "practice launcher" that turns the song library into the shortest path from opening the app to practicing the right piece.

**Date**: 2026-05-16  
**Status**: Recorded plan  
**Scope**: Product and engineering optimization plan, not a UI clone  
**Primary audience**: Rexiano maintainers

## Source Signals

Synthesia's public docs point to a mature practice workflow rather than a single feature to copy.

| Source                                                        | What to borrow as a principle                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| <https://synthesia.app/>                                      | Put practice speed, hand focus, progress, finger hints, and "play any song" near the center of the product. |
| <https://www.synthesiagame.com/support/guide/choosingSongs>   | Treat the song list as a sortable, searchable progress dashboard with preview and all-songs access.         |
| <https://www.synthesiagame.com/support/guide/addSongs>        | Support one-off file open and long-term watched song folders.                                               |
| <https://www.synthesiagame.com/support/Guide/songSetup>       | Let each song remember track role, hand assignment, color, audio mute, and instrument-like settings.        |
| <https://synthesiagame.com/support/guide/contentCreators>     | Make metadata portable: title, composer, tags, grouping, difficulty, hand data, and finger hints.           |
| <https://synthesiagame.com/support/guide/firstSong>           | Keep the in-practice controls discoverable: speed, timeline jumping, help, and keyboard zoom.               |
| <https://synthesiagame.com/support/guide/labels>              | Offer label modes for different learning stages, not just one note-name toggle.                             |
| <https://www.synthesiagame.com/support/guide/changeSoundFont> | Let advanced users manage SoundFonts without making beginners understand audio internals.                   |

## Current Rexiano Baseline

Rexiano already covers the hard foundation: falling notes, MIDI input/output, audio playback, wait mode, speed control, A-B loop, hand/track practice, progress persistence, recents, i18n, and VexFlow sheet music. The gap is now product integration: the features exist, but the user is not always led through the right path at the right moment.

The current song library is attractive but card-first. It has search, difficulty filters, grade filters, category sections, and recent files, but lacks an efficient all-songs list, sorting, favorites, preview, per-song progress rows, watched folders, and metadata editing for imported MIDI.

## Optimization Tracks

| Track                   | Target outcome                                                                                                               | Priority |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| Song selection          | Opening Rexiano should answer "what should I practice now?" within one click.                                                | P0       |
| Library and metadata    | Imported MIDI should become a real library item with title, composer, tags, grade, source, and stable identity.              | P0       |
| Song setup              | Each song should remember hand roles, visible tracks, colors, muted parts, and default practice mode.                        | P1       |
| Practice flow           | Practice should start with a clear goal and end with a useful next action.                                                   | P1       |
| Sheet music quality     | Sheet view should keep moving toward standard notation: key signatures, ties, voices, spacing, and page navigation.          | P1       |
| Progress and feedback   | Scores should roll up into mastery, weak sections, daily goals, and parent-readable summaries.                               | P1       |
| Content quality         | MIDI issues should be explained before practice: unquantized chords, missing hand split, excessive tracks, or poor metadata. | P2       |
| Audio and device polish | SoundFont, latency, MIDI routing, and device diagnostics should be visible but not noisy.                                    | P2       |
| Release and onboarding  | File associations, first-run setup, docs, and screenshots should make Rexiano trustworthy for non-developers.                | P2       |

## Phase 7.5 Proposal

Phase 7.5 should sit between sheet music display and editing. It is the smallest coherent product slice that improves daily use without waiting for a full editor.

### 1. Practice Launcher

- Add a top "Continue Practice" area using the most recent valid song.
- Add "Recommended Next" based on grade, recent score, and unfinished practice.
- Keep "Import MIDI" visible, but make built-in and recent songs equally fast.
- Preserve the current visual style; shift hierarchy from showcase to action.

### 2. Compact All-Songs View

- Add a dense list/table mode as the default for larger libraries.
- Sort by recent, title, grade, difficulty, best score, play count, and duration.
- Search title, composer, tags, category, and hidden metadata.
- Add favorites/pinned songs.

### 3. Preview Before Load

- Let a selected row preview title, composer, duration, grade, best score, and available tracks.
- Add lightweight MIDI audio preview if the audio engine can do it without loading the full practice view.
- Keep single-click "Practice" as the main action.

### 4. Song Library Persistence

- Add watched folders for user MIDI files.
- Give each imported song a stable ID derived from file identity and metadata.
- Store editable Rexiano metadata in a sidecar such as `.rexiano-song.json` or app data, not Synthesia's `.synthesia` format.

### 5. Per-Song Setup

- Save default active tracks, hand assignment, colors, mute/background choices, speed, and mode.
- Auto-detect simple left/right hand cases, but allow correction.
- Offer a "fix this song" path when MIDI tracks are not practice-ready.

## Broader Backlog

### Practice

- Add daily 5-10 minute practice plans.
- Add a post-session screen with "repeat loop", "slow down", "try other hand", and "next song".
- Roll up weak notes and weak measures into visible practice suggestions.

### Notation

- Finish key signatures, dotted durations, tuplets, better voice splitting, and spacing stress tests.
- Add notation-specific visual regression tests with dense MIDI fixtures.
- Keep sheet and falling-note cursors aligned in split mode.

### Content

- Add a MIDI diagnostics panel: quantization quality, chord timing spread, track count, missing tempo, and missing hand metadata.
- Build a small content-authoring guide for contributors adding built-in songs.
- Add bulk metadata editing for built-in song curation.

### Audio and Devices

- Add SoundFont selection and "load on demand" only after the main practice path is stable.
- Add MIDI latency calibration and connection health checks.
- Keep advanced MIDI routing in settings, not on the main practice path.

### Release

- Finish auto-update and macOS DMG polish.
- Add Windows BLE MIDI bridge documentation.
- Add README screenshots/GIFs once the practice launcher is in place.

## Recommended Execution Order

1. **Phase 7.5A — Practice launcher and compact list**: continue card, favorites, all-songs list, sort, richer search.
2. **Phase 7.5B — Metadata and folders**: watched folders, stable imported-song records, tags, editable metadata.
3. **Phase 7.5C — Song setup**: hand/track roles, per-song defaults, colors, muted/background tracks.
4. **Phase 7.5D — Guided practice loop**: daily goal, post-session next action, weak-section CTA.
5. **Phase 8+ — Editor/content tools**: piano-roll editor, MusicXML, bulk authoring, sidecar export.

## First Implementation Slice

Build Phase 7.5A first.

Acceptance criteria:

- User sees a single clear "Continue Practice" action when recents exist.
- User can switch to an all-songs list and sort without losing existing filters.
- User can favorite/unfavorite a built-in song.
- Search matches title, composer, and tags.
- Existing category cards remain available or are replaced only after visual verification.
- Existing e2e helpers can still load the first built-in song.

Verification:

- Add unit tests for sort, search, favorite persistence, and recommendation ordering.
- Add Playwright coverage for continue practice, list sorting, and favorite toggle.
- Run `pnpm lint && pnpm typecheck && pnpm test`.
- Run focused Playwright tests for library routing and UI polish.
