# Phase 1-6.5 Remaining Items — Design Document

> Date: 2026-02-28
> Scope: All unchecked ROADMAP items from Phase 1 through Phase 6.5 Sprint 4

## Decision Record

| Decision      | Choice                         | Rationale                                                |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| Sprint 5      | Deferred                       | Fingering, insights, i18n are large; focus on core first |
| SoundFont     | Salamander Grand Piano         | User preference for better piano tone                    |
| Song library  | Generate MIDI programmatically | No dependency on external file sourcing                  |
| BLE MIDI docs | Deferred to Phase 9            | Per ROADMAP                                              |

## Work Items (15 total)

### A. SoundFont Upgrade (Phase 4 deferred)

1. **Salamander Grand Piano SF2** — Download ~12MB SF2, replace `resources/piano.sf2`
2. **SoundFontLoader compatibility** — Verify sample decoding works (may need format checks)
3. **TransportBar audio loading status** — Show spinner/text during SF2 init in TransportBar

### B. MIDI Device Polish (Phase 5 deferred)

4. **Connection test button** — DeviceSelector.tsx: "Test" button sends C4 note, visual confirmation
5. **Latency compensation** — SettingsPanel + useSettingsStore: slider 0-100ms, applied as offset in WaitMode hit detection window

### C. Practice UX Polish (Phase 6 deferred + Sprint 1/3/4)

6. **A-B loop seek bar highlight** — Colored overlay on TransportBar range input showing loopRange
7. **SongCard best score badge** — Read useProgressStore.getBestScore(), display accuracy% badge
8. **SongCard difficulty tooltip** — Add title/aria-label to existing difficulty badge
9. **CelebrationOverlay "New Record!"** — Compare current score vs getBestScore(), show indicator
10. **Recent files UI section** — SongLibrary or Welcome screen: list from recentFilesHandlers
11. **Direct path loading** — Click recent file → load via IPC without file dialog
12. **Metronome visual pulse** — Metronome.tsx component: CSS pulse animation synced to MetronomeEngine beat callback
13. **TransportBar metronome toggle** — Button to enable/disable metronome (reads useSettingsStore.metronomeEnabled)

### D. Built-in Song Library Expansion (Sprint 4)

14. **MIDI generation script** — Node script using @tonejs/midi to produce 12+ songs:
    - Beginner (6): Mary Had a Little Lamb, Hot Cross Buns, Jingle Bells, Happy Birthday, London Bridge, Row Row Row Your Boat
    - Intermediate (4): Fur Elise (simplified), Minuet in G, Prelude in C, Canon in D (simplified)
    - Advanced (2): Moonlight Sonata mvt1 (simplified), Turkish March (simplified)
15. **songs.json update** — Add category field, difficulty ratings, metadata for all songs

## Architecture Notes

- All items are UI integration or asset additions; no new engine architecture needed
- useSettingsStore already exists with latencyCompensation field slot available
- MetronomeEngine already has beat callback (`onBeat`); Metronome.tsx subscribes to it
- recentFilesHandlers IPC already complete; only renderer UI needed
- useProgressStore.getBestScore() already implemented; SongCard just needs to call it

## Implementation Approach

Follow AGENT_TEAMS.md Stage 1-2-3 workflow:

- Stage 1: Lead downloads SF2, adds types for latency compensation, scaffolds
- Stage 2: Parallel agent work on categories A-D
- Stage 3: Integration test, ROADMAP checkbox updates
