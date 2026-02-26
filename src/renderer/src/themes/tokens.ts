export type ThemeId = 'lavender' | 'ocean' | 'peach'

export interface ThemeTokens {
  id: ThemeId
  label: string
  /** Dot color shown in theme picker */
  dot: string
  colors: {
    bg: string
    surface: string
    surfaceAlt: string
    accent: string
    accentHover: string
    text: string
    textMuted: string
    border: string
    canvasBg: string
    gridLine: string
    hitLine: string
    note1: string
    note2: string
    note3: string
    note4: string
    keyActive: string
    keyWhite: string
    keyWhiteBottom: string
    keyBlack: string
    keyBlackTop: string
    /** Practice mode — warm glow on correct hit */
    hitGlow: string
    /** Practice mode — desaturated gray for missed notes */
    missGray: string
    /** Practice mode — floating combo counter text */
    comboText: string
    /** Practice mode — streak milestone accent */
    streakGold: string
  }
}

export const themes: Record<ThemeId, ThemeTokens> = {
  lavender: {
    id: 'lavender',
    label: 'Lavender',
    dot: '#8B6CC1',
    colors: {
      bg: '#F8F6FC',
      surface: '#EEEBF5',
      surfaceAlt: '#E4E0F0',
      accent: '#8B6CC1',
      accentHover: '#7B5CB1',
      text: '#2D2640',
      textMuted: '#635C7A',
      border: '#D8D3E8',
      canvasBg: '#F3F0FA',
      gridLine: '#E8E4F2',
      hitLine: '#8B6CC1',
      note1: '#9B7FD4',
      note2: '#C084CF',
      note3: '#7BA4D9',
      note4: '#A8D4A0',
      keyActive: '#B49AE0',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#F0EDF5',
      keyBlack: '#3D3556',
      keyBlackTop: '#4D4566',
      hitGlow: '#E8C547',
      missGray: '#8A8A9E',
      comboText: '#B47AED',
      streakGold: '#D4A038',
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    dot: '#4A9EAD',
    colors: {
      bg: '#F5F9FA',
      surface: '#E8F0F2',
      surfaceAlt: '#DCE8EC',
      accent: '#4A9EAD',
      accentHover: '#3A8E9D',
      text: '#1D2F36',
      textMuted: '#52737D',
      border: '#C8DAE0',
      canvasBg: '#EFF5F7',
      gridLine: '#E0ECF0',
      hitLine: '#4A9EAD',
      note1: '#5BB5C5',
      note2: '#7EC8A0',
      note3: '#5A9ED6',
      note4: '#D4A05A',
      keyActive: '#7DD4E0',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#EDF3F5',
      keyBlack: '#2A3D44',
      keyBlackTop: '#3A4D54',
      hitGlow: '#3DE8E0',
      missGray: '#5A6268',
      comboText: '#4DD8A0',
      streakGold: '#D4B86A',
    },
  },
  peach: {
    id: 'peach',
    label: 'Peach',
    dot: '#D4845C',
    colors: {
      bg: '#FDF8F4',
      surface: '#F6EDE4',
      surfaceAlt: '#EEE2D6',
      accent: '#D4845C',
      accentHover: '#C4744C',
      text: '#3B2F2F',
      textMuted: '#7D6A5F',
      border: '#E4D4C6',
      canvasBg: '#FAF4EF',
      gridLine: '#F0E8E0',
      hitLine: '#D4845C',
      note1: '#E8845C',
      note2: '#D4A574',
      note3: '#C07878',
      note4: '#8DB88A',
      keyActive: '#F0A880',
      keyWhite: '#FFFFFF',
      keyWhiteBottom: '#F5EDE6',
      keyBlack: '#3B2F2F',
      keyBlackTop: '#4B3F3F',
      hitGlow: '#F0C8A0',
      missGray: '#A89090',
      comboText: '#E07058',
      streakGold: '#DAA850',
    },
  },
}

/**
 * Convert a hex color string like "#9B7FD4" to a PixiJS-compatible number 0x9B7FD4.
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}
