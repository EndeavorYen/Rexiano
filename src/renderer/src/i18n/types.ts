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
  "app.insightsTitle": string;
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
  "practice.tracks": string;
  "practice.trackN": string;
  "practice.notesCount": string;
  "practice.muteAll": string;
  "practice.muteAllDisabledWait": string;
  "practice.resetTracks": string;
  "practice.solo": string;
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
  "practice.mode.watchDesc": string;
  "practice.mode.waitDesc": string;
  "practice.mode.freeDesc": string;
  "practice.step": string;
  "practice.mode.stepDesc": string;
  "practice.autoSpeedUp": string;
  "practice.speedBumped": string;
  "practice.handSeparation.hint": string;
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
  "settings.tab.keys": string;
  "settings.tab.lang": string;
  "settings.tab.about": string;
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
  "settings.keyboardShortcuts": string;
  "settings.langDesc": string;
  "settings.shortcut.playPause": string;
  "settings.shortcut.restart": string;
  "settings.shortcut.speedDown": string;
  "settings.shortcut.speedUp": string;
  "settings.shortcut.loopA": string;
  "settings.shortcut.loopB": string;
  "settings.shortcut.closeBack": string;
  "settings.basicMode": string;
  "settings.advancedMode": string;
  "settings.searchTabs": string;
  "settings.searchTabsAria": string;
  "settings.noMatchingTab": string;
  "settings.common": string;
  "settings.compactKeyLabels": string;
  "settings.compactKeyLabelsDesc": string;
  "settings.uiScale": string;
  "settings.uiScaleDesc": string;
  "settings.noteRelease": string;
  "settings.noteReleaseMs": string;
  "settings.uiScale.normal": string;
  "settings.uiScale.large": string;
  "settings.uiScale.xlarge": string;

  // ── Fingering ──────────────────────────────────────────────────
  "fingering.label": string;

  // ── Insights Panel ─────────────────────────────────────────────
  "insights.title": string;
  "insights.weakSpots": string;
  "insights.accuracyTrend": string;
  "insights.totalMinutes": string;
  "insights.sessions": string;
  "insights.bestAccuracy": string;
  "insights.recentImprovement": string;
  "insights.emptyTitle": string;
  "insights.emptyMessage": string;
  "insights.missRate": string;
  "insights.attempts": string;
  "insights.practiceNumber": string;
  "insights.accuracyPercent": string;
  "insights.practiceTime": string;

  // ── Celebration ────────────────────────────────────────────────
  "celebration.amazing.title": string;
  "celebration.amazing.subtitle": string;
  "celebration.great.title": string;
  "celebration.great.subtitle": string;
  "celebration.encourage.title": string;
  "celebration.encourage.subtitle": string;
  "celebration.newRecord": string;
  "celebration.playAgain": string;
  "celebration.oneMoreTime": string;
  "celebration.tryAgain": string;
  "celebration.pickSong": string;
  "celebration.accuracy": string;
  "celebration.hits": string;
  "celebration.missed": string;
  "celebration.bestStreak": string;
  "celebration.starRating": string;
  "celebration.tapToContinue": string;

  // ── Sheet Music ────────────────────────────────────────────────
  "sheetMusic.loadSong": string;
  "sheetMusic.vexflowError": string;
  "sheetMusic.vexflowErrorHint": string;
  "sheetMusic.modeFalling": string;
  "sheetMusic.modeSheet": string;
  "sheetMusic.modeSplit": string;
  "sheetMusic.displayMode": string;
  "sheetMusic.zoomIn": string;
  "sheetMusic.zoomOut": string;

  // ── Mode Selection ─────────────────────────────────────────────
  "modeSelect.title": string;
  "modeSelect.subtitle": string;
  "modeSelect.watchDesc": string;
  "modeSelect.waitDesc": string;
  "modeSelect.freeDesc": string;
  "modeSelect.escToSkip": string;
  "modeSelect.mustChoose": string;

  // ── Statistics ─────────────────────────────────────────────────
  "stats.title": string;
  "stats.accuracy": string;
  "stats.notesHit": string;
  "stats.notesMissed": string;
  "stats.streak": string;
  "stats.totalNotes": string;
  "stats.hitRate": string;
  "stats.hitFraction": string;
  "stats.consistency": string;
  "stats.mode": string;
  "stats.speed": string;
  "stats.duration": string;
  "stats.nextFocus": string;
  "stats.missRateSummary": string;
  "stats.reward": string;
  "stats.rewardLegend": string;
  "stats.rewardGold": string;
  "stats.rewardSilver": string;
  "stats.rewardBronze": string;
  "stats.modeWait": string;
  "stats.modeFree": string;
  "stats.modeWatch": string;
  "stats.modeStep": string;
  "stats.weakSpotHint": string;
  "stats.tipSlowDown": string;
  "stats.tipUseWaitMode": string;
  "stats.tipTrainStreak": string;
  "stats.tipRaiseSpeed": string;
  "stats.tipKeepGoing": string;
  "stats.tipLoopFocus": string;
  "stats.tipShortSession": string;
  "stats.playAgain": string;
  "stats.backToLibrary": string;

  // ── Audio ──────────────────────────────────────────────────────
  "audio.mute": string;
  "audio.unmute": string;
  "audio.recovering": string;
  "audio.restored": string;
  "audio.recoveryFailed": string;
  "audio.retry": string;

  // ── Onboarding ──────────────────────────────────────────────────
  "onboarding.step1.title": string;
  "onboarding.step1.desc": string;
  "onboarding.step2.title": string;
  "onboarding.step2.desc": string;
  "onboarding.step3.title": string;
  "onboarding.step3.desc": string;
  "onboarding.step4.title": string;
  "onboarding.step4.desc": string;
  "onboarding.skip": string;
  "onboarding.next": string;
  "onboarding.getStarted": string;
  "onboarding.ariaLabel": string;

  // ── Count-in ─────────────────────────────────────────────────
  "countIn.go": string;

  // ── Song Library Tags ─────────────────────────────────────────
  "library.filterByTag": string;
  "library.clearTagFilter": string;
  "library.demo": string;
  "library.demoTitle": string;

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

  // ── Help / Shortcuts ─────────────────────────────────────────
  "help.seekShort": string;
  "help.seekLong": string;
  "help.openFile": string;
  "help.toggleHelp": string;
  "help.closeHint": string;

  // ── Song Card ───────────────────────────────────────────────
  "songCard.stopPreview": string;
  "songCard.previewSong": string;
  "songCard.practiced": string;
  "songCard.bestScore": string;
  "songCard.difficulty": string;

  // ── General ────────────────────────────────────────────────────
  "general.loading": string;
  "general.error": string;
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
