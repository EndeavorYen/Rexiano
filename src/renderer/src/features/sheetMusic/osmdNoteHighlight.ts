const ACTIVE_CLASS = "osmd-note-active";

export function estimateBeatPosition(
  currentTime: number,
  bpm: number,
  numerator: number,
  denominator: number,
): { measureIndex: number; beat: number } {
  const secPerBeat = 60 / bpm;
  const beatsPerMeasure = numerator * (4 / denominator);
  const secPerMeasure = secPerBeat * beatsPerMeasure;
  if (secPerMeasure <= 0) return { measureIndex: 0, beat: 0 };
  const totalBeats = Math.max(0, currentTime) / secPerBeat;
  const measureIndex = Math.floor(totalBeats / beatsPerMeasure);
  const beat = totalBeats - measureIndex * beatsPerMeasure;
  return { measureIndex, beat };
}

export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/**
 * Get the SVG `<g>` element for a VexFlow StaveNote.
 * VexFlow stores it in `attrs.el` (minified builds) or via `getSVGElement()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStaveNoteSVG(staveNote: any): SVGElement | null {
  const el =
    staveNote?.attrs?.el ??
    staveNote?.getSVGElement?.() ??
    staveNote?.elem;
  return el instanceof SVGElement ? el : null;
}

export function highlightActiveNotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  measureIndex: number,
  beat: number,
  container: HTMLElement,
): void {
  clearHighlights(container);

  const sheet = osmd?.GraphicSheet;
  if (!sheet) return;

  const measureList = sheet.MeasureList;
  if (!measureList || measureIndex >= measureList.length) return;

  const graphicalMeasures = measureList[measureIndex];
  if (!graphicalMeasures) return;

  for (const gMeasure of graphicalMeasures) {
    if (!gMeasure?.staffEntries) continue;

    for (const entry of gMeasure.staffEntries) {
      const entryFraction = entry.relInMeasureTimestamp?.RealValue ?? 0;
      const beatsPerMeasure =
        osmd.sheet?.SourceMeasures?.[measureIndex]?.ActiveTimeSignature
          ?.Numerator ?? 4;
      const entryBeat = entryFraction * beatsPerMeasure;
      const snapThreshold = Math.min(0.5, beatsPerMeasure * 0.15);

      if (Math.abs(entryBeat - beat) <= snapThreshold) {
        for (const gve of entry.graphicalVoiceEntries ?? []) {
          const svgEl = getStaveNoteSVG(gve.mVexFlowStaveNote);
          if (svgEl) {
            const heads = svgEl.querySelectorAll(".vf-notehead path");
            if (heads.length > 0) {
              heads.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
            } else {
              const fallback = svgEl.querySelectorAll("path, ellipse");
              fallback.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
            }
          }
        }
      }
    }
  }
}
