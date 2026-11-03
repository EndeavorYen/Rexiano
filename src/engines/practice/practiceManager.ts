// practiceManager.ts — Module-level singleton manager for practice engines
import { WaitMode } from "./WaitMode";
import { SpeedController } from "./SpeedController";
import { LoopController } from "./LoopController";
import { ScoreCalculator } from "./ScoreCalculator";

export interface PracticeEngines {
  waitMode: WaitMode | null;
  speedController: SpeedController | null;
  loopController: LoopController | null;
  scoreCalculator: ScoreCalculator | null;
}

/**
 * Stable singleton — mutated in place by init/dispose.
 * Avoids allocating a new object per `getPracticeEngines()` call
 * (critical since tickerLoop calls it ~60 times/sec).
 */
const _engines: PracticeEngines = {
  waitMode: null,
  speedController: null,
  loopController: null,
  scoreCalculator: null,
};

/**
 * Initialize all four practice engines (idempotent — safe to call multiple times).
 * Must be called before `getPracticeEngines()` returns useful values.
 */
export function initPracticeEngines(): void {
  if (_engines.waitMode) return; // already initialized
  _engines.waitMode = new WaitMode();
  _engines.speedController = new SpeedController();
  _engines.loopController = new LoopController();
  _engines.scoreCalculator = new ScoreCalculator();
}

/** Returns the stable singleton object (same reference every call). */
export function getPracticeEngines(): PracticeEngines {
  return _engines;
}

/**
 * Dispose all practice engines: clear callbacks, stop WaitMode, and null all fields.
 * Call when a song is unloaded or the practice view unmounts.
 */
export function disposePracticeEngines(): void {
  _engines.waitMode?.clearCallbacks();
  _engines.waitMode?.stop();
  _engines.waitMode = null;
  _engines.speedController = null;
  _engines.loopController?.clear();
  _engines.loopController = null;
  _engines.scoreCalculator?.reset();
  _engines.scoreCalculator = null;
}
