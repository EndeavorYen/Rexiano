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
  "app.importErrorUnsupportedTitle": string;
  "app.importErrorUnsupportedGuidance": string;
  "app.importErrorParseTitle": string;
  "app.importErrorParseGuidance": string;
  "app.importErrorMissingTitle": string;
  "app.importErrorMissingGuidance": string;
  "app.importErrorReadTitle": string;
  "app.importErrorReadGuidance": string;
  "app.importErrorUnknownFile": string;
  "app.importActionChooseMidi": string;
  "app.importActionRetry": string;
  "app.importActionReimport": string;
  "app.importActionOpenPermissions": string;
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
  "library.addFolder": string;
  "library.importedSongs": string;
  "library.watchedFolderCount": string;
  "library.importedMissing": string;
  "library.importedMissingBadge": string;
  "library.importedAvailable": string;
  "library.importedUnknownComposer": string;
  "library.editImportedMetadata": string;
  "library.importedMetadataTitle": string;
  "library.importedMetadataComposer": string;
  "library.importedMetadataTags": string;
  "library.importedMetadataGrade": string;
  "library.importedMetadataCategory": string;
  "library.saveImportedMetadata": string;
  "library.cancelImportedMetadata": string;
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
  "library.continuePractice": string;
  "library.continueHint": string;
  "library.recommendation.title": string;
  "library.recommendation.cta": string;
  "library.recommendation.reason.newSong": string;
  "library.recommendation.reason.improveScore": string;
  "library.recommendation.reason.continueProgress": string;
  "library.preview.title": string;
  "library.preview.length": string;
  "library.preview.grade": string;
  "library.preview.category": string;
  "library.preview.bestScore": string;
  "library.preview.tracks": string;
  "library.preview.tracksAfterPractice": string;
  "library.preview.audioPreview": string;
  "library.preview.audioPreviewLoading": string;
  "library.preview.audioPreviewStop": string;
  "library.preview.audioPreviewError": string;
  "library.lessonPath.title": string;
  "library.lessonPath.free": string;
  "library.lessonPath.next": string;
  "library.lessonPath.completed": string;
  "library.lessonPath.mastery": string;
  "library.dailyGoal.label": string;
  "library.dailyGoal.minutes": string;
  "library.dailyGoal.remaining": string;
  "library.dailyGoal.complete": string;
  "library.removeRecent": string;
  "library.allSongs": string;
  "library.sort.label": string;
  "library.sort.recent": string;
  "library.sort.title": string;
  "library.sort.grade": string;
  "library.sort.difficulty": string;
  "library.sort.bestScore": string;
  "library.sort.playCount": string;
  "library.sort.duration": string;
  "library.view.list": string;
  "library.view.cards": string;
  "library.favorite": string;
  "library.unfavorite": string;
  "library.practicedTimes": string;
  "library.neverPracticed": string;
  "library.noSongsYet": string;
  "library.noSongsHint": string;
  "library.noMatchSearch": string;
  "library.noMatchHint": string;

  // ── Parent Practice Report ────────────────────────────────────
  "parentReport.title": string;
  "parentReport.week": string;
  "parentReport.month": string;
  "parentReport.minutes": string;
  "parentReport.activeDays": string;
  "parentReport.activeDaysValue": string;
  "parentReport.consistency": string;
  "parentReport.consistency.empty": string;
  "parentReport.consistency.light": string;
  "parentReport.consistency.steady": string;
  "parentReport.consistency.strong": string;
  "parentReport.accuracy": string;
  "parentReport.accuracy.empty": string;
  "parentReport.accuracy.needsSupport": string;
  "parentReport.accuracy.building": string;
  "parentReport.accuracy.confident": string;
  "parentReport.nextFocusValue": string;
  "parentReport.noFocus": string;
  "parentReport.bestImprovementValue": string;
  "parentReport.empty": string;

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

  // ── Falling Notes ──────────────────────────────────────────────
  "fallingNotes.renderFailureTitle": string;
  "fallingNotes.renderFailureGuidance": string;

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
  "midi.errorUnsupported": string;
  "midi.errorUnsupportedGuidance": string;
  "midi.errorDenied": string;
  "midi.errorDeniedGuidance": string;
  "midi.errorUnavailable": string;
  "midi.errorUnavailableGuidance": string;
  "midi.errorInput": string;
  "midi.errorInputGuidance": string;
  "midi.errorOutput": string;
  "midi.errorOutputGuidance": string;
  "midi.errorBluetoothUnsupported": string;
  "midi.errorBluetoothUnsupportedGuidance": string;
  "midi.errorGeneric": string;
  "midi.errorGenericGuidance": string;
  "midi.openSettings": string;
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

  // ── Practice Mode ──────────────────────────────────────────────
  "practice.watch": string;
  "practice.wait": string;
  "practice.free": string;
  "practice.speed": string;
  "practice.tracks": string;
  "practice.trackN": string;
  "practice.notesCount": string;
  "practice.muteAll": string;
  "practice.resetTracks": string;
  "practice.solo": string;
  "practice.trackHand": string;
  "practice.handRight": string;
  "practice.handLeft": string;
  "practice.handBoth": string;
  "practice.handBackground": string;
  "practice.trackSound": string;
  "practice.trackVisible": string;
  "practice.trackColor": string;
  "practice.sound": string;
  "practice.visible": string;
  "practice.fixSong": string;
  "practice.confirmExitPlaying": string;
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
  "settings.tab.backup": string;
  "settings.tab.about": string;
  "about.version": string;
  "about.changelog": string;
  "about.noChangelog": string;
  "about.updateTitle": string;
  "about.updateIntro": string;
  "about.updateFocusModeNote": string;
  "about.updateCheck": string;
  "about.updateChecking": string;
  "about.updateDownload": string;
  "about.updateOpenInstaller": string;
  "about.updateReleaseNotes": string;
  "about.updateIdle": string;
  "about.updateDisabledDev": string;
  "about.updateCurrent": string;
  "about.updateNotAvailable": string;
  "about.updateAvailable": string;
  "about.updateDownloading": string;
  "about.updateReady": string;
  "about.updateFailed": string;
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
  "settings.childFocusMode": string;
  "settings.childFocusModeDesc": string;
  "settings.practiceDefaults": string;
  "settings.defaultMode": string;
  "settings.defaultSpeed": string;
  "settings.metronome": string;
  "settings.metronomeDesc": string;
  "settings.countInBeats": string;
  "settings.countInOff": string;
  "settings.latencyComp": string;
  "settings.latencyDesc": string;
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
  "settings.backupTitle": string;
  "settings.backupDesc": string;
  "settings.backupExport": string;
  "settings.backupExportDesc": string;
  "settings.backupImport": string;
  "settings.backupImportDesc": string;
  "settings.backupReset": string;
  "settings.backupResetDesc": string;
  "settings.backupResetSettings": string;
  "settings.backupResetSettingsDesc": string;
  "settings.backupResetProgress": string;
  "settings.backupResetProgressDesc": string;
  "settings.backupResetRecents": string;
  "settings.backupResetRecentsDesc": string;
  "settings.backupExportSuccess": string;
  "settings.backupImportSuccess": string;
  "settings.backupResetSuccess": string;
  "settings.backupResetConfirm": string;
  "settings.backupResetConfirmGeneric": string;
  "settings.backupUnknownError": string;

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
  "celebration.nextAction.label": string;
  "celebration.nextAction.slowDown.title": string;
  "celebration.nextAction.slowDown.body": string;
  "celebration.nextAction.raiseSpeed.title": string;
  "celebration.nextAction.raiseSpeed.body": string;
  "celebration.nextAction.repeatOnce.title": string;
  "celebration.nextAction.repeatOnce.body": string;
  "celebration.nextAction.tryOtherHand.title": string;
  "celebration.nextAction.tryOtherHand.body": string;
  "celebration.nextAction.practiceWeakNote.title": string;
  "celebration.nextAction.practiceWeakNote.body": string;
  "celebration.nextAction.practiceWeakSection.title": string;
  "celebration.nextAction.practiceWeakSection.body": string;
  "celebration.nextAction.nextSong.title": string;
  "celebration.nextAction.nextSong.body": string;

  // ── Sheet Music ────────────────────────────────────────────────
  "sheetMusic.loadSong": string;
  "sheetMusic.modeFalling": string;
  "sheetMusic.modeSheet": string;
  "sheetMusic.modeSplit": string;
  "sheetMusic.displayMode": string;

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
  "audio.loadingTitle": string;
  "audio.loadingGuidance": string;
  "audio.recovering": string;
  "audio.recoveringGuidance": string;
  "audio.restored": string;
  "audio.restoredGuidance": string;
  "audio.recoveryFailed": string;
  "audio.recoveryFailedGuidance": string;
  "audio.errorTitle": string;
  "audio.errorGuidance": string;
  "audio.retry": string;
  "audio.reloadSoundFont": string;
  "audio.useSynthFallback": string;

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
