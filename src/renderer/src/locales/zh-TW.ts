import type { TranslationMap } from '@renderer/i18n/types'

export const zhTW: TranslationMap = {
  // ── App Shell ──────────────────────────────────────────────────
  'app.title': 'Rexiano',
  'app.subtitle': '\u92FC\u7434\u7DF4\u7FD2',

  // ── Song Library ───────────────────────────────────────────────
  'library.title': 'Rexiano',
  'library.subtitle': '\u9078\u4E00\u9996\u6B4C\u958B\u59CB\u7DF4\u7FD2\u5427',
  'library.searchPlaceholder': '\u641C\u5C0B\u6B4C\u66F2\u2026',
  'library.importMidi': '\u532F\u5165\u81EA\u5DF1\u7684 MIDI \u6A94\u6848',
  'library.noSongs': '\u627E\u4E0D\u5230\u5167\u5EFA\u6B4C\u66F2',
  'library.noMatch': '\u6C92\u6709\u7B26\u5408\u7BE9\u9078\u7684\u6B4C\u66F2',
  'library.importHint': '\u8A66\u8A66\u532F\u5165\u4E00\u500B MIDI \u6A94\u6848\u4F86\u958B\u59CB',
  'library.difficulty.all': '\u5168\u90E8',
  'library.difficulty.beginner': '\u521D\u7D1A',
  'library.difficulty.intermediate': '\u4E2D\u7D1A',
  'library.difficulty.advanced': '\u9AD8\u7D1A',

  // ── Transport Bar ──────────────────────────────────────────────
  'transport.play': '\u64AD\u653E (Space)',
  'transport.pause': '\u66AB\u505C (Space)',
  'transport.reset': '\u56DE\u5230\u958B\u982D (Home)',
  'transport.seekPosition': '\u64AD\u653E\u4F4D\u7F6E',
  'transport.volume': '\u97F3\u91CF',
  'transport.mute': '\u975C\u97F3',
  'transport.unmute': '\u53D6\u6D88\u975C\u97F3',

  // ── Song Header ────────────────────────────────────────────────
  'song.tracks': '\u8ECC\u9053',
  'song.track': '\u8ECC\u9053',
  'song.notes': '\u97F3\u7B26',
  'song.backToLibrary': '\u66F2\u5EAB',

  // ── MIDI Device ────────────────────────────────────────────────
  'midi.noDevices': '\u672A\u5075\u6E2C\u5230 MIDI \u88DD\u7F6E',
  'midi.inputLabel': '\u8F38\u5165',
  'midi.outputLabel': '\u8F38\u51FA',
  'midi.noneOption': '-- \u7121 --',
  'midi.disconnect': '\u4E2D\u65B7\u9023\u7DDA',
  'midi.connected': '\u5DF2\u9023\u7DDA',
  'midi.disconnected': '\u5DF2\u4E2D\u65B7',
  'midi.error': '\u9023\u7DDA\u932F\u8AA4',

  // ── Practice Mode ──────────────────────────────────────────────
  'practice.watch': '\u89C0\u770B',
  'practice.wait': '\u7B49\u5F85',
  'practice.free': '\u81EA\u7531',
  'practice.speed': '\u901F\u5EA6',
  'practice.tracks': '\u8ECC\u9053',
  'practice.trackN': '\u8ECC\u9053 {n}',
  'practice.notesCount': '{count} \u500B\u97F3\u7B26',
  'practice.accuracy': '\u6E96\u78BA\u7387',
  'practice.combo': '\u9023\u64CA',
  'practice.abLoop': 'A\u2013B \u5FAA\u74B0',
  'practice.setA': '\u5C07\u5FAA\u74B0\u8D77\u9EDE\u8A2D\u70BA\u76EE\u524D\u4F4D\u7F6E',
  'practice.setB': '\u5C07\u5FAA\u74B0\u7D42\u9EDE\u8A2D\u70BA\u76EE\u524D\u4F4D\u7F6E',
  'practice.clearLoop': '\u6E05\u9664',

  // ── Settings ───────────────────────────────────────────────────
  'settings.title': '\u8A2D\u5B9A',
  'settings.language': '\u8A9E\u8A00',
  'settings.showFingering': '\u986F\u793A\u6307\u6CD5\u6578\u5B57',
  'settings.theme': '\u4E3B\u984C',

  // ── Fingering ──────────────────────────────────────────────────
  'fingering.label': '\u6307\u6CD5',

  // ── Insights Panel ─────────────────────────────────────────────
  'insights.title': '\u7DF4\u7FD2\u6D1E\u5BDF',
  'insights.weakSpots': '\u5F31\u9EDE\u5206\u6790',
  'insights.accuracyTrend': '\u6E96\u78BA\u7387\u8DA8\u52E2',
  'insights.totalMinutes': '\u7E3D\u7DF4\u7FD2\u6642\u9593',
  'insights.sessions': '\u7DF4\u7FD2\u6B21\u6578',
  'insights.bestAccuracy': '\u6700\u4F73\u6E96\u78BA\u7387',
  'insights.recentImprovement': '\u8FD1\u671F\u9032\u6B65',
  'insights.emptyTitle': '\u5C1A\u7121\u7DF4\u7FD2\u8CC7\u6599',
  'insights.emptyMessage': '\u958B\u59CB\u7DF4\u7FD2\u5C31\u80FD\u770B\u5230\u5206\u6790\u5831\u544A\u56C9\uFF01',
  'insights.missRate': '\u5931\u8AA4\u7387',
  'insights.attempts': '\u6B21\u5617\u8A66',
  'insights.practiceNumber': '\u7B2C # \u6B21',
  'insights.accuracyPercent': '\u6E96\u78BA\u7387 %',

  // ── General ────────────────────────────────────────────────────
  'general.loading': '\u8F09\u5165\u4E2D\u2026',
  'general.error': '\u932F\u8AA4',
  'general.close': '\u95DC\u9589',
  'general.save': '\u5132\u5B58',
  'general.cancel': '\u53D6\u6D88',
}
