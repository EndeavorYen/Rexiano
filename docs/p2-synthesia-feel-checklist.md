# P2 — Synthesia feel checklist

This is the repeatable open-song / Wait checklist required by ROADMAP product stage 2.
It is an acceptance list, not a claim that Rexiano already beats Synthesia.

## Open song

1. Home shows one primary path: start practice / import.
2. Library card states score vs MIDI origin.
3. Choosing a song opens preview, then one practice start action.
4. Mode pick is Watch / Wait only — no extra setup wall.

## Wait practice

1. Stage shows falling / split on the playback surface. Split is the default for score-backed songs. Drawer does not duplicate it.
2. Hit line stays readable at 50% and 100% speed.
3. Wait pauses on the target note until the correct key; next note does not jump the cursor.
4. Device connect lives in the drawer and must not cover the hit line while waiting.
5. Latency of highlight vs Bluetooth key: in-app UI hop is ≤ 1 frame (4–8ms post-delivery); BLE transport overhead documented in docs/performance-diagnostics.md.
6. Keyboard and falling-notes lane fit the song's range (whole octaves, at least 3). Notes land on their keys; labels are hidden rather than clipped (#277).
7. Switching falling ↔ split never leaves a dead band above the keyboard (#272).
8. Split shows every staff of the song with no scrollbar; dense measures pan with the cursor (#273).
9. Seek, speed and volume sliders show a track and a filled part (#274).

## Still open

- Motion / density vs Synthesia side-by-side recording
- Post-session still offers more than one next action
