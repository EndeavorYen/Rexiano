# Piano SoundFont Provenance

Rexiano currently bundles `resources/piano.sf2` as the default offline piano
SoundFont. The file is the TimGM6mb SF2 already used by the audio engine and
packaged through `electron-builder.yml`.

## Current Decision

- Keep TimGM6mb bundled for now. The current file is 5,969,788 bytes
  (`sha256:c5378b62028c920cb11e4803327983fee2f2cdff5dc89c708e39da417e51c854`)
  and is already covered by the existing `SoundFontLoader` fallback path.
- Use FreePats Upright Piano KW small SF2 as the first replacement candidate for
  a future `resources/piano.sf2` swap. It is redistributable under CC0, stays
  close to the current packaging budget, and parses through the current
  `soundfont2` loader path.
- Do not bundle Salamander Grand Piano yet. Its provenance and CC BY 3.0 license
  are clear, but the redistributable SF2 package is much larger than the current
  release budget and the upstream SFZ version is not directly supported by the
  current SF2-only loader.
- Preserve the sine-wave synth fallback when the SF2 cannot be loaded.

## 2026-05-31 Candidate Validation

### Selected Candidate For Replacement Work

FreePats Upright Piano KW small SF2 is the selected candidate for issue #132
compatibility work.

- Source page:
  [FreePats Acoustic Grand Piano](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html#UprightKW)
- Download URL:
  `https://freepats.zenvoid.org/Piano/UprightPianoKW/UprightPianoKW-small-SF2-20190703.7z`
- Upstream name/version: `UprightPianoKW-small-SF2-20190703`
- Extracted SF2 file: `UprightPianoKW-small-20190703.sf2`
- Provenance: Kawai upright piano recorded by Gonzalo and Roberto for FreePats;
  the included `readme.txt` also credits Inma Martinez de Miguel for recording
  access and Claudia Marin Martinez for recording-day support.
- License: [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Required attribution: none. Recommended courtesy text for release notes:
  "Upright Piano KW by Gonzalo and Roberto for FreePats, dedicated under CC0
  1.0."
- Archive size: 6,093,984 bytes (5.81 MiB)
- Archive SHA-256:
  `3bd025e7c2ffa9e6f3f99215ce383c9cebbac991cfbf9be1453cdb4328ec3492`
- Extracted SF2 size: 9,456,310 bytes (9.02 MiB)
- Extracted SF2 SHA-256:
  `cf2a98eb38a32c4954b4b6e2caae4112d62dd8e892eceefdd7942b0e7d01ac2f`
- Packaging impact if the extracted SF2 replaces `resources/piano.sf2`:
  +3,486,522 bytes (+3.32 MiB) before installer compression.
- Loader smoke: `new SoundFont2(new Uint8Array(data))` succeeded locally.
  `getKeyData(midi, 0, 0)` returned usable samples for all 88 piano keys from
  A0 (21) through C8 (108). The first preset reports bank 0, preset 0, name
  `Upright piano KW`.
- Decision: acceptable as a redistributable, loader-compatible replacement
  candidate. Do not replace the bundled file until #132 adds the binary swap,
  focused audio tests, and an offline playback smoke run.

### Reviewed But Not Selected

Salamander Grand Piano remains a high-quality reference candidate, but not the
default bundled replacement for the next release.

- Primary source:
  [sfzinstruments/SalamanderGrandPiano](https://github.com/sfzinstruments/SalamanderGrandPiano)
- FreePats package page:
  [FreePats Acoustic Grand Piano](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html#SalamanderGrandPiano)
- Author: Alexander Holm
- License: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)
- Required attribution if bundled later: "Salamander Grand Piano V3 by Alexander
  Holm, licensed under CC BY 3.0. Source:
  https://archive.org/details/SalamanderGrandPianoV3."
- Size and packaging impact: FreePats lists the Salamander SF2 package at
  296 MiB. The upstream SFZ options are listed as 707 MiB FLAC, 1.18 GiB WAV,
  and 394 MiB downsampled WAV.
- Loader fit: the upstream GitHub package is SFZ, not SF2, and documents
  SFZ/ARIA-extension compatibility requirements. Rexiano's current loader only
  parses SF2 through `soundfont2`.
- Integrity: checksum not recorded because this candidate was not selected for
  bundling. If the product later accepts the package-size trade-off, recompute
  both archive and extracted SF2 SHA-256 before replacing `resources/piano.sf2`.
- Decision: license is compatible with redistribution if attribution is kept,
  but the current package size and loader path make it a poor default bundle
  candidate.

The older phase plan entry that mentioned an approximately 12 MiB Salamander
SF2 is superseded by this validation record. Use the FreePats or upstream source
pages above instead of raw GitHub paths unless the exact artifact, license, size,
and checksum are revalidated.

## Upgrade Path

Before replacing `resources/piano.sf2`, verify and commit all of the following:

- Source URL and license for the replacement SF2.
- Included attribution text if the license requires it.
- Expected file size, checksum, and release artifact impact.
- Focused `SoundFontLoader` and `AudioEngine` tests.
- A local smoke run that confirms first playback still loads the bundled piano
  sound without network access.

Advanced user-managed SoundFont selection can be added later without changing
the bundled default; that should use a user-approved file picker path rather
than accepting arbitrary renderer-provided paths.
