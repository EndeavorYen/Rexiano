/**
 * VexFlow type definitions for the dynamically imported VexFlow module.
 *
 * VexFlow 5 ships TypeScript declarations, but the combination of pnpm
 * (isolated node_modules) + `moduleResolution: "bundler"` prevents
 * TypeScript from resolving the re-exported classes through
 * `export * from './stave'` etc. in the vexflow package.
 *
 * Rather than using `any` throughout, we define structural interfaces
 * that mirror the subset of VexFlow's API actually used by SheetMusicPanel.
 * This gives us compile-time safety and editor autocompletion.
 *
 * These interfaces are intentionally minimal — they declare only the methods
 * and properties SheetMusicPanel calls. If new VexFlow features are needed,
 * extend the relevant interface here.
 */

/* ------------------------------------------------------------------ */
/*  Structural types mirroring VexFlow 5 API                          */
/* ------------------------------------------------------------------ */

/** A VexFlow Element that can be drawn to a context */
export interface VFElement {
  setContext(ctx: VFRenderContext): this;
  draw(): void;
}

/**
 * SVG-backed render context (VexFlow SVGContext / RenderContext).
 *
 * R2-06 FIX: `svg` is typed as optional because VexFlow's RenderContext
 * interface does not guarantee SVG mode — when using Canvas backend,
 * `svg` would be undefined. Code that accesses `context.svg` already
 * guards with `if (!svg) return;`.
 */
export interface VFRenderContext {
  svg?: SVGSVGElement;
}

/** VexFlow Stave */
export interface VFStave extends VFElement {
  addClef(clef: string): this;
  addKeySignature(key: string, cancelKey?: string, position?: number): this;
  addTimeSignature(timeSig: string): this;
  getNoteStartX(): number;
  getNoteEndX(): number;
  setNoteStartX(x: number): this;
}

/** VexFlow StaveNote */
export interface VFStaveNote extends VFElement {
  addModifier(modifier: VFElement, index?: number): this;
  getAbsoluteX(): number;
  getGlyphWidth(): number;
  getYs(): number[];
}

/** VexFlow StaveNote constructor options */
export interface VFStaveNoteStruct {
  keys: string[];
  duration: string;
  clef?: string;
}

/** VexFlow Voice */
export interface VFVoice {
  setContext(ctx: VFRenderContext): this;
  setStrict(strict: boolean): this;
  addTickables(tickables: VFStaveNote[]): this;
  draw(ctx?: VFRenderContext, stave?: VFStave): void;
}

/** VexFlow Formatter */
export interface VFFormatter {
  joinVoices(voices: VFVoice[]): this;
  formatToStave(voices: VFVoice[], stave: VFStave): this;
}

/** VexFlow Beam */
export interface VFBeam extends VFElement {}

/** VexFlow Fraction */
export interface VFFraction {
  numerator: number;
  denominator: number;
}

/** VexFlow StaveConnector */
export interface VFStaveConnector extends VFElement {
  setType(
    type:
      | "singleRight"
      | "singleLeft"
      | "single"
      | "double"
      | "brace"
      | "bracket"
      | number,
  ): this;
}

/** VexFlow StaveTie */
export interface VFStaveTie extends VFElement {}

/** Configuration for Beam.generateBeams */
export interface BeamConfig {
  groups?: VFFraction[];
  maintainStemDirections?: boolean;
  beamRests?: boolean;
  beamMiddleOnly?: boolean;
  showStemlets?: boolean;
  flatBeams?: boolean;
  flatBeamOffset?: number;
  secondaryBreaks?: string;
  stemDirection?: number;
}

/** Options for StaveTie constructor */
export interface TieNotesConfig {
  firstNote: VFStaveNote | null;
  lastNote: VFStaveNote | null;
  firstIndexes: number[];
  lastIndexes: number[];
}

/**
 * Interface describing the shape of `import("vexflow")`.
 *
 * Replaces the pervasive `any` type previously used for the VexFlow module.
 */
export interface VexFlowModule {
  Renderer: {
    new (
      container: HTMLElement,
      backend: number,
    ): {
      resize(width: number, height: number): void;
      getContext(): VFRenderContext;
    };
    Backends: { SVG: number; CANVAS: number };
  };
  Stave: new (x: number, y: number, width: number) => VFStave;
  StaveNote: new (opts: VFStaveNoteStruct) => VFStaveNote;
  Voice: new (time: { numBeats: number; beatValue: number }) => VFVoice;
  Formatter: new (opts?: { softmaxFactor?: number }) => VFFormatter;
  StaveConnector: new (top: VFStave, bottom: VFStave) => VFStaveConnector;
  StaveTie: new (notes: TieNotesConfig, text?: string) => VFStaveTie;
  Beam: {
    getDefaultBeamGroups(timeSig: string): VFFraction[];
    generateBeams(notes: VFStaveNote[], config?: BeamConfig): VFBeam[];
  };
  Fraction: new (numerator: number, denominator: number) => VFFraction;
  Accidental: new (type: string) => VFElement;
  Dot: {
    buildAndAttach(
      notes: VFStaveNote[],
      options?: { index?: number; all?: boolean },
    ): void;
  };
  Articulation: new (type: string) => VFElement;
}
