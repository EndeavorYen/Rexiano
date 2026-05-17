# Curriculum Progression

Rexiano keeps free song selection available, but built-in songs can also be
arranged into a lightweight lesson path for beginner practice.

## Lesson Groups

`lessonProgression.ts` assigns built-in songs to these stages:

1. **First notes**: L0 songs and very early exercises.
2. **Right-hand melodies**: L1-L2 single-line beginner melodies.
3. **First two-hand pieces**: L3 songs tagged `two-hands`.
4. **Rhythm and expression**: L4 pieces and songs with rhythm/key variety such
   as `3-4` or `a-minor`.
5. **Intermediate classics**: L5+ repertoire and higher-grade classical pieces.

The current mastery threshold is 90% best accuracy. A group is complete only
when every song in that group reaches the threshold.

## Adding Built-In Songs

When adding a song to `resources/midi/songs.json`:

- Set `grade` from L0-L8 using `docs/midi-level-guide.md`.
- Add `two-hands` when the arrangement requires both hands.
- Add useful musical tags such as `3-4`, `a-minor`, `g-major`, `scale`, or
  `melody`.
- Keep `category` aligned with the song's role: `exercise`, `classical`,
  `popular`, or `holiday`.
- Prefer short, readable beginner pieces for L0-L2. Longer or denser pieces
  should start at L3+.

The lesson model uses only existing metadata and progress activity. It does not
block the all-songs library view or free exploration.
