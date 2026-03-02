import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";

/** Visual state of the MIDI test button */
export type TestButtonState = "idle" | "playing" | "ok";

/**
 * Send a short C4 test note to the selected MIDI output device.
 * Returns a Promise that resolves when the full cycle (noteOn -> wait -> noteOff) completes.
 *
 * Pure logic, extracted for testability.
 */
export async function sendTestNote(
  sender: MidiOutputSender,
  output: MIDIOutput,
): Promise<void> {
  sender.attach(output);
  sender.noteOn(60, 100);
  await new Promise((r) => setTimeout(r, 300));
  sender.noteOff(60);
  sender.detach();
}
