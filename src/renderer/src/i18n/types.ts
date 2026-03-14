/**
 * All translation keys used throughout the application.
 * Adding a new key here will enforce translations in all locale files.
 */
export interface TranslationMap {
  // ── App Shell ──────────────────────────────────────────────────
  "app.title": string;
  "app.subtitle": string;
  "app.dropMidi": string;
  "app.supportedFormats": string;
  "app.invalidFileType": string;
  "app.failedParse": string;
  "app.failedRead": string;
  "app.startPractice": string;
  "app.openSettings": string;
  "app.menuGreeting": string;

  // ── Song Library ───────────────────────────────────────────────
  "library.title": string;
  "library.subtitle": string;
  "library.searchPlaceholder": string;
  "library.importMidi": string;
  "library.noSongs": string;
  "library.noMatch": string;
  "library.importHint": string;
  "library.difficulty.all": string;
  "library.difficulty.beginner": string;
  "library.difficulty.intermediate": string;
  "library.difficulty.advanced": string;
  "library.grade.all": string;
  "library.grade.0": string;
  "library.grade.1": string;
  "library.grade.2": string;
  "library.grade.3": string;
  "library.grade.4": string;
  "library.grade.5": string;
  "library.grade.6": string;
  "library.grade.7": string;
  "library.grade.8": string;
  "library.greeting.morning": string;
  "library.greeting.afternoon": string;
  "library.greeting.evening": string;
  "library.songPracticed": string;
  "library.songsPracticed": string;
  "library.session": string;
  "library.sessions": string;
  "library.bestScore": string;
  "library.recentlyPlayed": string;
  "library.noSongsYet": string;
  "library.noSongsHint": string;
  "library.noMatchSearch": string;
  "library.noMatchHint": string;
  "library.emptyTitle": string;
  "library.emptyHint": string;
  "library.noMatchTitle": string;
  "library.noMatchAction": string;
  "library.category.exercise": string;
  "library.category.popular": string;
  "library.category.holiday": string;
  "library.category.classical": string;
  "library.category.all": string;

  // ── Transport Bar ──────────────────────────────────────────────
  "transport.play": string;
  "transport.pause": string;
  "transport.reset": string;
  "transport.resetLabel": string;
  "transport.seekPosition": string;
  "transport.volume": string;
  "transport.mute": string;
  "transport.unmute": string;
  "transport.enableMetronome": string;
  "transport.disableMetronome": string;

  // ── Song Header ────────────────────────────────────────────────
  "song.tracks": string;
  "song.track": string;
  "song.notes": string;
  "song.backToLibrary": string;

  // ── MIDI Device ────────────────────────────────────────────────
  "midi.noDevices": string;
  "midi.inputLabel": string;
  "midi.outputLabel": string;
  "midi.noneOption": string;
  "midi.disconnect": string;
  "midi.connected": string;
  "midi.disconnected": string;
  "midi.error": string;
  "midi.testTitle": string;
  "midi.testLabel": string;
  "midi.testPlaying": string;
  "midi.testOk": string;
  "midi.disconnectTitle": string;
  "midi.bleConnect": string;
  "midi.bleScanning": string;
  "midi.bleConnecting": string;
  "midi.bluetooth": string;
  "midi.bleDisconnect": string;
  "midi.bleDeviceTitle": string;
  "midi.testKeyboard": string;
  "midi.pressAKey": string;

  // ── Practice Mode ──────────────────────────────────────────────
  "practice.watch": string;
  "practice.wait": string;
  "practice.free": string;
  "practice.speed": string;
  "practice.accuracy": string;
  "practice.combo": string;
  "practice.abLoop": string;
  "practice.setA": string;
  "practice.setB": string;
  "practice.clearLoop": string;
  "practice.more": string;
  "practice.showAdvanced": string;
  "practice.hideAdvanced": string;
  "practice.loopSection": string;
  "practice.setALabel": string;
  "practice.setBLabel": string;
  "practice.clearLoopLabel": string;
  "practice.encourageOnFire": string;
  "practice.encourageStreak": string;
  "practice.encouragePerfect": string;
  "practice.encourageGreat": string;
  "practice.encourageKeepGoing": string;
  "practice.encourageGettingThere": string;
  "practice.encourageYouCanDoIt": string;
  "practice.scoreLabel": string;
  "practice.timingEarly": string;
  "practice.timingLate": string;
  "practice.timingOnTime": string;
  "practice.waiting": string;
  "practice.songComplete": string;
  "practice.watchComplete": string;
  "practice.finalAccuracy": string;
  "practice.bestStreak": string;
  "practice.complete.amazing": string;
  "practice.complete.great": string;
  "practice.complete.good": string;
  "practice.complete.tryAgain": string;
  "practice.complete.niceListening": string;
  "practice.playAgain": string;
  "practice.backToLibrary": string;
  "practice.mode.watchDesc": string;
  "practice.mode.waitDesc": string;
  "practice.mode.freeDesc": string;
  "practice.step": string;
  "practice.mode.stepDesc": string;
  "practice.speedBumped": string;
  "practice.loop.byMeasure": string;
  "practice.loop.measure": string;

  // ── Settings ───────────────────────────────────────────────────
  "settings.title": string;
  "settings.close": string;
  "settings.language": string;
  "settings.showFingering": string;
  "settings.theme": string;
  "settings.tab.theme": string;
  "settings.tab.display": string;
  "settings.tab.audio": string;
  "settings.tab.practice": string;
  "settings.tab.lang": string;
  "settings.tab.appearance": string;
  "settings.tab.sound": string;
  "about.version": string;
  "about.changelog": string;
  "about.noChangelog": string;
  "settings.chooseTheme": string;
  "settings.themeDesc": string;
  "settings.displayOptions": string;
  "settings.showNoteLabels": string;
  "settings.showNoteLabelsDesc": string;
  "settings.showFallingLabels": string;
  "settings.showFallingLabelsDesc": string;
  "settings.showFingeringDesc": string;
  "settings.audioSettings": string;
  "settings.volume": string;
  "settings.muted": string;
  "settings.muteAudio": string;
  "settings.audioCompatibilityMode": string;
  "settings.audioCompatibilityModeDesc": string;
  "settings.practiceDefaults": string;
  "settings.defaultMode": string;
  "settings.defaultSpeed": string;
  "settings.metronome": string;
  "settings.metronomeDesc": string;
  "settings.countInBeats": string;
  "settings.countInOff": string;
  "settings.latencyComp": string;
  "settings.latencyDesc": string;
  "settings.midiChannel": string;
  "settings.midiChannelAll": string;
  "settings.langDesc": string;
  "settings.compactKeyLabels": string;
  "settings.compactKeyLabelsDesc": string;
  "settings.uiScale": string;
  "settings.uiScaleDesc": string;
  "settings.noteRelease": string;
  "settings.noteReleaseMs": string;
  "settings.uiScale.normal": string;
  "settings.uiScale.large": string;
  "settings.uiScale.xlarge": string;
  "settings.kidMode": string;
  "settings.kidModeDesc": string;

  // ── Fingering ──────────────────────────────────────────────────
  "fingering.label": string;

  // ── Sheet Music ────────────────────────────────────────────────
  "sheetMusic.loadSong": string;
  "sheetMusic.vexflowError": string;
  "sheetMusic.vexflowErrorHint": string;
  "sheetMusic.modeFalling": string;
  "sheetMusic.modeSplit": string;
  "sheetMusic.modeSheet": string;
  "sheetMusic.displayMode": string;
  "sheetMusic.zoomIn": string;
  "sheetMusic.zoomOut": string;

  // ── Audio ──────────────────────────────────────────────────────
  "audio.mute": string;
  "audio.unmute": string;
  "audio.recovering": string;
  "audio.restored": string;
  "audio.recoveryFailed": string;
  "audio.retry": string;

  // ── Progress / Daily Goal ───────────────────────────────────
  "progress.dailyGoal": string;
  "progress.min": string;
  "progress.goalReached": string;
  "settings.dailyGoal": string;
  "settings.dailyGoalDesc": string;

  // ── Difficulty Heatmap ────────────────────────────────────────
  "heatmap.ariaLabel": string;
  "heatmap.easy": string;
  "heatmap.medium": string;
  "heatmap.hard": string;
  "heatmap.veryHard": string;

  // ── Song Card ───────────────────────────────────────────────
  "songCard.practiced": string;
  "songCard.bestScore": string;
  "songCard.difficulty": string;

  // ── General ────────────────────────────────────────────────────
  "general.loading": string;
  "general.error": string;
  "general.retry": string;
  "general.close": string;
  "general.save": string;
  "general.cancel": string;
}

/**
 * A valid translation key from our TranslationMap.
 * Used for type-safe t() calls.
 */
export type TranslationKey = keyof TranslationMap;

/**
 * Interpolation parameters for translation strings.
 * Example: t('welcome', { name: 'Rex' }) where the string is "Hi {name}!"
 */
export type InterpolationParams = Record<string, string | number>;
