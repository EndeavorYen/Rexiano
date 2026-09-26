import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const selectorSource = readFileSync(
  resolve(
    process.cwd(),
    "src/renderer/src/features/midiDevice/DeviceSelector.tsx",
  ),
  "utf8",
);
const senderModule = resolve(
  process.cwd(),
  "src/renderer/src/engines/midi/MidiOutputSender.ts",
);

describe("live path MIDI output absence", () => {
  test("device selector does not offer output or a connection test", () => {
    expect(selectorSource).not.toContain("midi.outputLabel");
    expect(selectorSource).not.toContain("midi.outputDevice");
    expect(selectorSource).not.toContain('data-testid="midi-test-button"');
    expect(selectorSource).toContain("midi.inputDevice");
    expect(selectorSource).toContain("connectBluetooth");
    expect(selectorSource).toContain("connect();");
  });

  test("MidiOutputSender stays in the tree", () => {
    expect(existsSync(senderModule)).toBe(true);
  });
});
