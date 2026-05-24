# Piano SoundFont Provenance

Rexiano currently bundles `resources/piano.sf2` as the default offline piano
SoundFont. The file is the TimGM6mb SF2 already used by the audio engine and
packaged through `electron-builder.yml`.

## Current Decision

- Keep TimGM6mb bundled for now because it is small enough for desktop release
  artifacts and already covered by the existing `SoundFontLoader` fallback path.
- Do not mark the Salamander Grand Piano upgrade complete. It remains a future
  quality upgrade until the exact redistributable SF2 source, license text, file
  size, and loader compatibility are verified.
- Preserve the sine-wave synth fallback when the SF2 cannot be loaded.

## Upgrade Path

Before replacing `resources/piano.sf2`, verify and commit all of the following:

- Source URL and license for the replacement SF2.
- Included attribution text if the license requires it.
- Expected file size and release artifact impact.
- Focused `SoundFontLoader` and `AudioEngine` tests.
- A local smoke run that confirms first playback still loads the bundled piano
  sound without network access.

Advanced user-managed SoundFont selection can be added later without changing
the bundled default; that should use a user-approved file picker path rather
than accepting arbitrary renderer-provided paths.
