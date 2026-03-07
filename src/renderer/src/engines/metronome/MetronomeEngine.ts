// ─── Phase 6.5: MetronomeEngine — Web Audio API metronome ───
//
// Generates click sounds using short sine wave pulses.
// Schedules clicks in advance using AudioContext timing
// (same look-ahead approach as AudioScheduler).
//
// Usage:
//   const metronome = new MetronomeEngine(audioContext);
//   metronome.start(120, 4);   // 120 BPM, 4/4 time
//   metronome.stop();

/** Frequency for normal (weak) beats */
const NORMAL_FREQ = 1000;

/** Frequency for the strong (first) beat of a measure */
const STRONG_FREQ = 1500;

/** Duration of each click pulse in seconds */
const CLICK_DURATION = 0.05;

/** How far ahead to schedule clicks, in seconds */
const LOOK_AHEAD = 0.1;

/** How often the scheduler runs, in milliseconds */
const SCHEDULE_INTERVAL = 25;

export class MetronomeEngine {
  private _audioContext: AudioContext;
  private _destination: AudioNode;
  private _enabled = false;
  private _bpm = 120;
  private _beatsPerMeasure = 4;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  /** Master gain for metronome volume (0.0–1.0) */
  private _volume = 0.5;

  /** AudioContext time of the next click to schedule */
  private _nextClickTime = 0;

  /** Current beat within the measure (0-based) */
  private _currentBeat = 0;

  /** Count-in state: beats remaining before song starts, -1 = not counting in */
  private _countInRemaining = -1;

  /** Callback fired when count-in finishes */
  private _onCountInComplete: (() => void) | null = null;

  /**
   * @param audioContext The AudioContext to use for scheduling
   * @param destination  Audio node to connect clicks to (e.g. master GainNode).
   *                     Defaults to audioContext.destination if not provided.
   */
  constructor(audioContext: AudioContext, destination?: AudioNode) {
    this._audioContext = audioContext;
    this._destination = destination ?? audioContext.destination;
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

  /** Master volume (0.0–1.0) for metronome click sounds */
  get volume(): number {
    return this._volume;
  }

  /** Set the metronome click volume (0.0–1.0, clamped) */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled && this._intervalId !== null) {
      this.stop();
    }
  }

  setBpm(bpm: number): void {
    const oldBpm = this._bpm;
    this._bpm = Math.max(20, Math.min(300, bpm));
    // R2-005: Recalculate _nextClickTime to avoid drift when BPM changes mid-run
    if (this._intervalId !== null && oldBpm !== this._bpm) {
      const now = this._audioContext.currentTime;
      if (this._nextClickTime > now) {
        const remaining = this._nextClickTime - now;
        const ratio = oldBpm / this._bpm;
        this._nextClickTime = now + remaining * ratio;
      }
    }
  }

  /** Update beats per measure (e.g. when time signature changes) */
  setBeatsPerMeasure(beatsPerMeasure: number): void {
    this._beatsPerMeasure = Math.max(1, beatsPerMeasure);
    if (this._currentBeat >= this._beatsPerMeasure) {
      this._currentBeat = 0;
    }
  }

  /**
   * R2-009: Reset beat position after a seek operation.
   * Resets currentBeat to 0 and recalculates nextClickTime from the given time.
   * @param seekTime The AudioContext time at which playback will resume.
   */
  resetBeat(seekTime?: number): void {
    this._currentBeat = 0;
    this._nextClickTime = seekTime ?? this._audioContext.currentTime;
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
   * Schedule a single click at the given AudioContext time.
   */
  private _scheduleClick(time: number, isStrong: boolean): void {
    const osc = this._audioContext.createOscillator();
    const gain = this._audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = isStrong ? STRONG_FREQ : NORMAL_FREQ;

    // Sharp attack, quick decay — scaled by _volume
    // Metronome routes through master GainNode, so no extra attenuation needed
    const peakGain = this._volume;
    gain.gain.setValueAtTime(Math.max(peakGain, 0.001), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);

    osc.connect(gain);
    gain.connect(this._destination);

    osc.start(time);
    osc.stop(time + CLICK_DURATION);

    // Cleanup after the pulse finishes
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
