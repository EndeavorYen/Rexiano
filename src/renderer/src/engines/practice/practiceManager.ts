// practiceManager.ts
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

let _waitMode: WaitMode | null = null;
let _speedController: SpeedController | null = null;
let _loopController: LoopController | null = null;
let _scoreCalculator: ScoreCalculator | null = null;

export function initPracticeEngines(): void {
  if (_waitMode) return; // already initialized
  _waitMode = new WaitMode();
  _speedController = new SpeedController();
  _loopController = new LoopController();
  _scoreCalculator = new ScoreCalculator();
}

export function getPracticeEngines(): PracticeEngines {
  return {
    waitMode: _waitMode,
    speedController: _speedController,
    loopController: _loopController,
    scoreCalculator: _scoreCalculator,
  };
}

export function disposePracticeEngines(): void {
  _waitMode?.stop();
  _waitMode = null;
  _speedController = null;
  _loopController?.clear();
  _loopController = null;
  _scoreCalculator?.reset();
  _scoreCalculator = null;
}
