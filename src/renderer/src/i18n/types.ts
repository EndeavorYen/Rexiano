/**
 * All translation keys used throughout the application.
 * Adding a new key here will enforce translations in all locale files.
 */
export interface TranslationMap {
  // ── App Shell ──────────────────────────────────────────────────
  'app.title': string
  'app.subtitle': string

  // ── Song Library ───────────────────────────────────────────────
  'library.title': string
  'library.subtitle': string
  'library.searchPlaceholder': string
  'library.importMidi': string
  'library.noSongs': string
  'library.noMatch': string
  'library.importHint': string
  'library.difficulty.all': string
  'library.difficulty.beginner': string
  'library.difficulty.intermediate': string
  'library.difficulty.advanced': string

  // ── Transport Bar ──────────────────────────────────────────────
  'transport.play': string
  'transport.pause': string
  'transport.reset': string
  'transport.seekPosition': string
  'transport.volume': string
  'transport.mute': string
  'transport.unmute': string

  // ── Song Header ────────────────────────────────────────────────
  'song.tracks': string
  'song.track': string
  'song.notes': string
  'song.backToLibrary': string

  // ── MIDI Device ────────────────────────────────────────────────
  'midi.noDevices': string
  'midi.inputLabel': string
  'midi.outputLabel': string
  'midi.noneOption': string
  'midi.disconnect': string
  'midi.connected': string
  'midi.disconnected': string
  'midi.error': string

  // ── Practice Mode ──────────────────────────────────────────────
  'practice.watch': string
  'practice.wait': string
  'practice.free': string
  'practice.speed': string
  'practice.tracks': string
  'practice.trackN': string
  'practice.notesCount': string
  'practice.accuracy': string
  'practice.combo': string
  'practice.abLoop': string
  'practice.setA': string
  'practice.setB': string
  'practice.clearLoop': string

  // ── Settings ───────────────────────────────────────────────────
  'settings.title': string
  'settings.language': string
  'settings.showFingering': string
  'settings.theme': string

  // ── Fingering ──────────────────────────────────────────────────
  'fingering.label': string

  // ── Insights Panel ─────────────────────────────────────────────
  'insights.title': string
  'insights.weakSpots': string
  'insights.accuracyTrend': string
  'insights.totalMinutes': string
  'insights.sessions': string
  'insights.bestAccuracy': string
  'insights.recentImprovement': string
  'insights.emptyTitle': string
  'insights.emptyMessage': string
  'insights.missRate': string
  'insights.attempts': string
  'insights.practiceNumber': string
  'insights.accuracyPercent': string

  // ── General ────────────────────────────────────────────────────
  'general.loading': string
  'general.error': string
  'general.close': string
  'general.save': string
  'general.cancel': string
}

/**
 * A valid translation key from our TranslationMap.
 * Used for type-safe t() calls.
 */
export type TranslationKey = keyof TranslationMap

/**
 * Interpolation parameters for translation strings.
 * Example: t('welcome', { name: 'Rex' }) where the string is "Hi {name}!"
 */
export type InterpolationParams = Record<string, string | number>
