import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const selectorSource = readFileSync(
  resolve(process.cwd(), "src/features/midiDevice/DeviceSelector.tsx"),
  "utf8",
);

describe("piano connection surface", () => {
  test("Bluetooth comes first; Web MIDI ports sit under other connections", () => {
    expect(selectorSource).toContain("connectBluetooth");
    expect(selectorSource).toContain("piano-other-connections");
    expect(selectorSource).toContain("midi.inputDevice");
    expect(selectorSource).toContain("midi.outputDevice");
    // Web MIDI is only touched once the section is opened.
    expect(selectorSource).toContain("void connect();");
    expect(selectorSource).not.toContain('data-testid="midi-test-button"');
  });

  test("MidiOutputSender stays in the tree", () => {
    expect(
      existsSync(
        resolve(process.cwd(), "src/engines/midi/MidiOutputSender.ts"),
      ),
    ).toBe(true);
  });
});
