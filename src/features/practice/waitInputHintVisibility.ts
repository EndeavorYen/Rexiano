import type { PracticeMode } from "@shared/types";
import type { BleMidiStatus } from "../../engines/midi/BleMidiManager";

interface WaitInputHintState {
  mode: PracticeMode;
  isConnected: boolean;
  bleStatus: BleMidiStatus;
}

/**
 * Wait mode stops until the right key is played. Without a keyboard the
 * stage would look frozen, so say what to do (#305).
 */
export function shouldShowWaitInputHint({
  mode,
  isConnected,
  bleStatus,
}: WaitInputHintState): boolean {
  return mode === "wait" && !isConnected && bleStatus !== "connected";
}
