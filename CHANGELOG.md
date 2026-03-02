# Changelog

## 1.0.0 (2026-03-02)


### Features

* add FallingNotesCanvas, playback/song stores, and fix test mock ([c5a478f](https://github.com/EndeavorYen/Rexiano/commit/c5a478f0cf41947903237a92306b3354835659ca))
* add font imports, Tailwind v4 theme, and slider styling ([ec9f4ea](https://github.com/EndeavorYen/Rexiano/commit/ec9f4eaab50f77f1047f48cddc01eaa9e0768a70))
* add MIDI-note-to-pixel position mapping utility ([7b371b2](https://github.com/EndeavorYen/Rexiano/commit/7b371b2615bffbf09f7ba06a2493bcce2a6f9ef7))
* add NoteRenderer with sprite-based object pool ([a4c32be](https://github.com/EndeavorYen/Rexiano/commit/a4c32bef8104d238d4cdbb848f50d7ffe6ca3132))
* add Nunito, DM Sans, JetBrains Mono font packages ([175c924](https://github.com/EndeavorYen/Rexiano/commit/175c924d9d2a5d91cdede1339e1e69c6a346aca6))
* add pixi.js and zustand dependencies for Phase 3 ([ac2fc8b](https://github.com/EndeavorYen/Rexiano/commit/ac2fc8ba00b6fff15d82ae420c71b1bd15309cb6))
* add theme tokens and useThemeStore with localStorage persistence ([cefc373](https://github.com/EndeavorYen/Rexiano/commit/cefc3733f05b687c2bfd91d4612c7c14671c7dea))
* add ThemePicker component with three-dot popover ([7d87301](https://github.com/EndeavorYen/Rexiano/commit/7d873013176435c3fb666a16cfe42a15e3ece936))
* add track color palette for falling notes ([0616542](https://github.com/EndeavorYen/Rexiano/commit/0616542af4aad869b008b39494f3e9c84910d393))
* add ViewportManager for time-to-pixel coordinate mapping ([8389a5d](https://github.com/EndeavorYen/Rexiano/commit/8389a5dedc25219559dc89d1125772236ffc84ac))
* add vitest configuration with path aliases ([d5a57f5](https://github.com/EndeavorYen/Rexiano/commit/d5a57f50932d82ce1aa953d1e05decc7e53e557c))
* initialize theme store early in app bootstrap ([9682510](https://github.com/EndeavorYen/Rexiano/commit/96825101f04ee78b3ab2e5cc723332058dcc114e))
* integrate falling notes engine with code review fixes ([ff97e76](https://github.com/EndeavorYen/Rexiano/commit/ff97e765b1831f2b3b670dce25c9642c965d4628))
* make noteColors theme-aware via useThemeStore ([01a1d23](https://github.com/EndeavorYen/Rexiano/commit/01a1d237663fdee0baf0e5f8a64c7067a10bdc75))
* Phase 5 MIDI device connection + built-in song library ([0651e43](https://github.com/EndeavorYen/Rexiano/commit/0651e43adc99a5eac479794e5369a7f13aef53a1))
* Phase 6 practice mode — engines, store, UI components, visual feedback ([9d6b026](https://github.com/EndeavorYen/Rexiano/commit/9d6b026a89d811a30a528d3c3878eafeb0cff867))
* restyle PianoKeyboard with micro-3D gradients and theme colors ([b6a54da](https://github.com/EndeavorYen/Rexiano/commit/b6a54dad6bec653d8c19766b93ddfc2bd1d11ead))
* restyle welcome screen and song header with theme system ([6ec1673](https://github.com/EndeavorYen/Rexiano/commit/6ec167332e02d8c27c07411b424834940f98e8ab))
* TDD rewrite of Tasks 4-6 with 35 tests ([05bd066](https://github.com/EndeavorYen/Rexiano/commit/05bd06605aa321a30a1ec8a52e3d6b9c234fa826))


### Bug Fixes

* address code review — auto-derive CSS vars, cache track palette ([e026527](https://github.com/EndeavorYen/Rexiano/commit/e02652779131a1f7214e03bcaa236f340da1209c))
* comprehensive UI/UX overhaul — icons, contrast, animations, layout ([47440bd](https://github.com/EndeavorYen/Rexiano/commit/47440bd37b31f9bb9841745fd0ca635bdde6290e))
* cross-platform dev script and conditional WSL2 DPI scaling ([32cee8c](https://github.com/EndeavorYen/Rexiano/commit/32cee8c688928c145a9344edcda7acf2b613e90b))
* render loop GC optimizations and duplicate note sprite leak ([f60f22d](https://github.com/EndeavorYen/Rexiano/commit/f60f22d57d18f3c1f6c9ae6ed1c822da533e9698))
* theme-aware canvas bg, error handling, and BPM rounding ([c67254c](https://github.com/EndeavorYen/Rexiano/commit/c67254c627c90439de99ba507fd99642ecea9d66))

## Changelog

All notable changes to Rexiano are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
