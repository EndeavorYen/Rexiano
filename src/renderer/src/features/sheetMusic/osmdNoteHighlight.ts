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
      // relInMeasureTimestamp is a Fraction — .RealValue gives 0-1 range within measure
      const entryFraction = entry.relInMeasureTimestamp?.RealValue ?? 0;
      // Convert to beat position
      const beatsPerMeasure =
        osmd.sheet?.SourceMeasures?.[measureIndex]?.ActiveTimeSignature
          ?.Numerator ?? 4;
      const entryBeat = entryFraction * beatsPerMeasure;

      const snapThreshold = Math.min(0.5, beatsPerMeasure * 0.15);

      if (Math.abs(entryBeat - beat) <= snapThreshold) {
        // Walk graphicalNotes to find SVG elements
        for (const noteGroup of entry.graphicalNotes ?? []) {
          const notes = Array.isArray(noteGroup) ? noteGroup : [noteGroup];
          for (const gNote of notes) {
            const svgEl = gNote?.getSVGGElement?.();
            if (svgEl instanceof SVGElement) {
              // Try to target just note-heads
              const heads = svgEl.querySelectorAll("ellipse, path");
              if (heads.length > 0) {
                heads.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
              } else {
                svgEl.classList.add(ACTIVE_CLASS);
              }
            }
          }
        }
      }
    }
  }
}
