import { type Dispatch, type SetStateAction, useState } from "react";

export type SheetMusicRenderer = "vexflow" | "osmd";

interface UseSheetMusicRendererResult {
  readonly renderer: SheetMusicRenderer;
  readonly setRenderer: Dispatch<SetStateAction<SheetMusicRenderer>>;
}

export function useSheetMusicRenderer(): UseSheetMusicRendererResult {
  const [renderer, setRenderer] = useState<SheetMusicRenderer>("osmd");
  return { renderer, setRenderer } as const;
}
