import { useState } from "react";

export type SheetMusicRenderer = "vexflow" | "osmd";

export function useSheetMusicRenderer() {
  const [renderer, setRenderer] = useState<SheetMusicRenderer>("vexflow");
  return { renderer, setRenderer } as const;
}
