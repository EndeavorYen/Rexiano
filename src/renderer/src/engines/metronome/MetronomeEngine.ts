// ─── Phase 6.5: MetronomeEngine — Web Audio API metronome ───
//
// Generates wood-block-style click sounds using white noise bursts
// shaped by a bandpass filter. Schedules clicks in advance using
// AudioContext timing (same look-ahead approach as AudioScheduler).
//
// Usage:
//   const metronome = new MetronomeEngine(audioContext);
//   metronome.start(120, 4);   // 120 BPM, 4/4 time
//   metronome.stop();

/** Duration of each click pulse in seconds (short for crisp click) */
const CLICK_DURATION = 0.03;

/** Bandpass filter cutoff for accent (strong) beats — higher = brighter */
const ACCENT_CUTOFF = 2000;

/** Bandpass filter cutoff for normal (weak) beats — lower = softer */
const NORMAL_CUTOFF = 800;

/** Gain for accent beats */
const ACCENT_GAIN = 0.7;

/** Gain for normal beats */
const NORMAL_GAIN = 0.4;

/** Bandpass Q factor (resonance) */
const BANDPASS_Q = 2.0;

/** How far ahead to schedule clicks, in seconds */
const LOOK_AHEAD = 0.1;

/** How often the scheduler runs, in milliseconds */
const SCHEDULE_INTERVAL = 25;

export class MetronomeEngine {
  private _audioContext: AudioContext;
  private _enabled = false;
  private _bpm = 120;
  private _beatsPerMeasure = 4;
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  /** AudioContext time of the next click to schedule */
  private _nextClickTime = 0;

  /** Current beat within the measure (0-based) */
  private _currentBeat = 0;

  /** Count-in state: beats remaining before song starts, -1 = not counting in */
  private _countInRemaining = -1;

  /** Callback fired when count-in finishes */
  private _onCountInComplete: (() => void) | null = null;

  /** Cached noise buffer for wood-block click generation */
  private _noiseBuffer: AudioBuffer | null = null;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
  }

  /** Current BPM */
  get bpm(): number {
    return this._bpm;
  }

  /** Whether the metronome is actively ticking */
  get isRunning(): boolean {
    return this._intervalId !== null;
  }

  /** Whether metronome is enabled */
  get enabled(): boolean {
    return this._enabled;
  }

  /** Current beat index within the measure (0-based) */
  get currentBeat(): number {
    return this._currentBeat;
  }

  /** Number of beats per measure */
  get beatsPerMeasure(): number {
    return this._beatsPerMeasure;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled && this._intervalId !== null) {
      this.stop();
    }
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(20, Math.min(300, bpm));
  }

  /**
   * Start the metronome.
   * @param bpm            Tempo in beats per minute
   * @param beatsPerMeasure Number of beats per measure (e.g. 4 for 4/4 time)
   */
  start(bpm: number, beatsPerMeasure: number): void {
    this.stop();

    this._bpm = Math.max(20, Math.min(300, bpm));
    this._beatsPerMeasure = Math.max(1, beatsPerMeasure);
    this._currentBeat = 0;
    this._nextClickTime = this._audioContext.currentTime;

    this._intervalId = setInterval(() => this._tick(), SCHEDULE_INTERVAL);
  }

  /**
   * Start a count-in sequence: play N beats before invoking the callback.
   * @param beats     Number of count-in beats
   * @param bpm       Tempo
   * @param beatsPerMeasure  Beats per measure
   * @param onComplete Callback when count-in finishes
   */
  startCountIn(
    beats: number,
    bpm: number,
    beatsPerMeasure: number,
    onComplete: () => void,
  ): void {
    this.stop();

    this._bpm = Math.max(20, Math.min(300, bpm));
    this._beatsPerMeasure = Math.max(1, beatsPerMeasure);
    this._currentBeat = 0;
    this._countInRemaining = beats;
    this._onCountInComplete = onComplete;
    this._nextClickTime = this._audioContext.currentTime;

    this._intervalId = setInterval(() => this._tick(), SCHEDULE_INTERVAL);
  }

  stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._countInRemaining = -1;
    this._onCountInComplete = null;
  }

  dispose(): void {
    this.stop();
    this._noiseBuffer = null;
  }

  // ─── Private ─────────────────────────────────────

  private _tick(): void {
    const now = this._audioContext.currentTime;
    const secondsPerBeat = 60 / this._bpm;

    while (this._nextClickTime < now + LOOK_AHEAD) {
      // Check count-in completion BEFORE scheduling next click
      if (this._countInRemaining === 0) {
        const cb = this._onCountInComplete;
        this._countInRemaining = -1;
        this._onCountInComplete = null;

        // If not enabled for regular metronome, stop after count-in
        if (!this._enabled) {
          this.stop();
        }

        cb?.();
        return;
      }

      if (this._enabled || this._countInRemaining > 0) {
        const isStrong = this._currentBeat === 0;
        this._scheduleClick(this._nextClickTime, isStrong);
      }

      // Advance to next beat
      this._nextClickTime += secondsPerBeat;
      this._currentBeat = (this._currentBeat + 1) % this._beatsPerMeasure;

      if (this._countInRemaining > 0) {
        this._countInRemaining--;
      }
    }
  }

  /**
   * Create a short mono noise buffer for wood-block-style clicks.
   * Cached per AudioContext to avoid repeated allocations.
   */
  private _getNoiseBuffer(): AudioBuffer {
    if (this._noiseBuffer) return this._noiseBuffer;

    const sampleRate = this._audioContext.sampleRate;
    const length = Math.ceil(sampleRate * CLICK_DURATION);
    const buffer = this._audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Schedule a single wood-block click at the given AudioContext time.
   * Uses a white noise burst shaped by a bandpass filter for a crisp,
   * percussive sound that cuts through piano audio.
   */
  private _scheduleClick(time: number, isStrong: boolean): void {
    const source = this._audioContext.createBufferSource();
    source.buffer = this._getNoiseBuffer();

    // Bandpass filter shapes the noise into a wood-block tone
    const filter = this._audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = isStrong ? ACCENT_CUTOFF : NORMAL_CUTOFF;
    filter.Q.value = BANDPASS_Q;

    // Gain envelope: sharp attack, quick decay
    const gain = this._audioContext.createGain();
    const peakGain = isStrong ? ACCENT_GAIN : NORMAL_GAIN;
    gain.gain.setValueAtTime(peakGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);

    // Connect: source → bandpass → gain → destination
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._audioContext.destination);

    source.start(time);
    source.stop(time + CLICK_DURATION);

    // Cleanup after the pulse finishes
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
