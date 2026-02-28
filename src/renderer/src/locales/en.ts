import type { TranslationMap } from '@renderer/i18n/types'

export const en: TranslationMap = {
  // ── App Shell ──────────────────────────────────────────────────
  'app.title': 'Rexiano',
  'app.subtitle': 'Piano Practice',

  // ── Song Library ───────────────────────────────────────────────
  'library.title': 'Rexiano',
  'library.subtitle': 'Pick a song to start practicing',
  'library.searchPlaceholder': 'Search songs...',
  'library.importMidi': 'Import your own MIDI file',
  'library.noSongs': 'No built-in songs found',
  'library.noMatch': 'No songs match your filter',
  'library.importHint': 'Try importing a MIDI file to get started',
  'library.difficulty.all': 'All',
  'library.difficulty.beginner': 'Beginner',
  'library.difficulty.intermediate': 'Intermediate',
  'library.difficulty.advanced': 'Advanced',

  // ── Transport Bar ──────────────────────────────────────────────
  'transport.play': 'Play (Space)',
  'transport.pause': 'Pause (Space)',
  'transport.reset': 'Back to start (Home)',
  'transport.seekPosition': 'Seek position',
  'transport.volume': 'Volume',
  'transport.mute': 'Mute',
  'transport.unmute': 'Unmute',

  // ── Song Header ────────────────────────────────────────────────
  'song.tracks': 'tracks',
  'song.track': 'track',
  'song.notes': 'notes',
  'song.backToLibrary': 'Library',

  // ── MIDI Device ────────────────────────────────────────────────
  'midi.noDevices': 'No MIDI devices detected',
  'midi.inputLabel': 'In',
  'midi.outputLabel': 'Out',
  'midi.noneOption': '-- None --',
  'midi.disconnect': 'Disconnect',
  'midi.connected': 'Connected',
  'midi.disconnected': 'Disconnected',
  'midi.error': 'Connection error',

  // ── Practice Mode ──────────────────────────────────────────────
  'practice.watch': 'Watch',
  'practice.wait': 'Wait',
  'practice.free': 'Free',
  'practice.speed': 'Speed',
  'practice.tracks': 'Tracks',
  'practice.trackN': 'Track {n}',
  'practice.notesCount': '{count} notes',
  'practice.accuracy': 'Acc',
  'practice.combo': 'combo',
  'practice.abLoop': 'A\u2013B Loop',
  'practice.setA': 'Set loop start to current position',
  'practice.setB': 'Set loop end to current position',
  'practice.clearLoop': 'Clear',

  // ── Settings ───────────────────────────────────────────────────
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.showFingering': 'Show fingering numbers',
  'settings.theme': 'Theme',

  // ── Fingering ──────────────────────────────────────────────────
  'fingering.label': 'Fingering',

  // ── Insights Panel ─────────────────────────────────────────────
  'insights.title': 'Practice Insights',
  'insights.weakSpots': 'Weak Spots',
  'insights.accuracyTrend': 'Accuracy Trend',
  'insights.totalMinutes': 'Total practice time',
  'insights.sessions': 'Sessions',
  'insights.bestAccuracy': 'Best accuracy',
  'insights.recentImprovement': 'Recent improvement',
  'insights.emptyTitle': 'No practice data yet',
  'insights.emptyMessage': 'Start practicing to see your insights here!',
  'insights.missRate': 'Miss rate',
  'insights.attempts': 'attempts',
  'insights.practiceNumber': 'Practice #',
  'insights.accuracyPercent': 'Accuracy %',

  // ── General ────────────────────────────────────────────────────
  'general.loading': 'Loading...',
  'general.error': 'Error',
  'general.close': 'Close',
  'general.save': 'Save',
  'general.cancel': 'Cancel',
}
