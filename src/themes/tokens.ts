export type ThemeId = "light" | "dark";

/** What the person picked: follow the system, or force light / dark. */
export type ThemePreference = "system" | ThemeId;

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  /** Dot color shown in theme picker */
  dot: string;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    accent: string;
    accentHover: string;
    /** Accent-colored text displayed on themed surfaces */
    accentText: string;
    /** Text and icons displayed on the primary accent gradient */
    onAccent: string;
    /** Readable positive status text on themed surfaces */
    successText: string;
    /** Readable negative status text on themed surfaces */
    dangerText: string;
    /** Visible boundary for interactive form controls */
    controlBorder: string;
    text: string;
    textMuted: string;
    border: string;
    canvasBg: string;
    gridLine: string;
    hitLine: string;
    note1: string;
    note2: string;
    note3: string;
    note4: string;
    keyActive: string;
    keyWhite: string;
    keyWhiteBottom: string;
    keyBlack: string;
    keyBlackTop: string;
    /** Practice mode — warm glow on correct hit */
    hitGlow: string;
    /** Practice mode — desaturated gray for missed notes */
    missGray: string;
    /** Practice mode — floating combo counter text */
    comboText: string;
    /** Practice mode — streak milestone accent */
    streakGold: string;
  };
}

/**
 * The colormon / sudomon family palette: light blue-grey page, white cards,
 * near-black ink, sun-yellow actions, green for "right" and red for "wrong".
 * Rexiano adds piano colors (keys, hands) in the same spirit.
 */
export const themes: Record<ThemeId, ThemeTokens> = {
  light: {
    id: "light",
    label: "Light",
    dot: "#FFC53D",
    colors: {
      bg: "#EAF1F8",
      surface: "#FFFFFF",
      surfaceAlt: "#F1F5FA",
      accent: "#FFC53D",
      accentHover: "#F5B520",
      accentText: "#1F7A45",
      onAccent: "#3A2A00",
      successText: "#1F7A45",
      dangerText: "#C0392B",
      controlBorder: "#7A879B",
      text: "#18202E",
      textMuted: "#5B6678",
      border: "#D3DDE9",
      canvasBg: "#F5F8FC",
      gridLine: "#E1E8F1",
      hitLine: "#F2A900",
      note1: "#3E8EDE",
      note2: "#F07B3F",
      note3: "#2E9E5B",
      note4: "#9B6BDF",
      keyActive: "#FFC53D",
      keyWhite: "#FFFFFF",
      keyWhiteBottom: "#E6EDF5",
      keyBlack: "#18202E",
      keyBlackTop: "#2C3647",
      hitGlow: "#FFD76A",
      missGray: "#A0AABA",
      comboText: "#D98200",
      streakGold: "#E0A100",
    },
  },
  dark: {
    id: "dark",
    label: "Dark",
    dot: "#1A2232",
    colors: {
      bg: "#111723",
      surface: "#1A2232",
      surfaceAlt: "#222B3D",
      accent: "#FFC53D",
      accentHover: "#FFD166",
      accentText: "#4CC27E",
      onAccent: "#2A1E00",
      successText: "#4CC27E",
      dangerText: "#F07A75",
      controlBorder: "#7A879D",
      text: "#EEF2F8",
      textMuted: "#9AA6BA",
      border: "#2C374B",
      canvasBg: "#0E1420",
      gridLine: "#1D2636",
      hitLine: "#FFC53D",
      note1: "#5AA8FF",
      note2: "#FF8A50",
      note3: "#4CC27E",
      note4: "#B48CF2",
      keyActive: "#FFC53D",
      keyWhite: "#DCE3ED",
      keyWhiteBottom: "#C3CDDB",
      keyBlack: "#0B0F17",
      keyBlackTop: "#1E2635",
      hitGlow: "#FFD76A",
      missGray: "#4F5B6E",
      comboText: "#FFC53D",
      streakGold: "#FFD166",
    },
  },
};

/**
 * Convert a hex color string like "#9B7FD4" to a PixiJS-compatible number 0x9B7FD4.
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
