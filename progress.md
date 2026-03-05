Original prompt: 目前這個專案的樂譜顯示，是最大的弱點。完全跟真實樂譜顯示的方式、呈現內容皆不符合規範。現在你被聘僱來解決這個問題，必須要解決完才算完成任務拿到薪水。請利用各種你想的到的辦法，分析問題並解決。不斷迭代甚至組建團隊執行都可以

## 2026-03-05 Iteration Notes
- Rebuilt sheet-notation conversion to use full tempo map and optional time-signature events.
- Added absolute measure start ticks + tempo map into notation output for cursor sync.
- Updated App integration to pass real song tempos/time signatures and per-note track indices.
- Improved accidental rendering logic in SheetMusicPanel to follow key signature + measure-local accidental state.
- Fixed chord duration inconsistency (same-start notes now keep longest duration in rendered chord).
- Improved tie index mapping across measure boundaries for chords.
- Added regression tests:
  - Multi-tempo absolute tick mapping
  - Per-note track index clef assignment
  - Time-signature-map measure boundaries
  - Cursor sync with tempoMap + measureStartTicks
- Verification executed:
  - vitest: sheetMusic MidiToNotation + CursorSync test suites (pass)
  - typecheck:web (pass)
  - eslint targeted changed files (pass)
  - playwright e2e: display mode coherence scenario (pass)

## Suggested Next Iteration
- Add explicit unit tests for accidental display edge cases (natural cancellation and re-accidentalization in same measure).
- Add visual regression snapshots dedicated to sheet-music notation correctness (key signatures, ties, rests, accidentals).
