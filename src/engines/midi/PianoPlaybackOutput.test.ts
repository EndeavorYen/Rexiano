import { afterEach, describe, expect, test, vi } from "vitest";
import { PianoPlaybackOutput } from "./PianoPlaybackOutput";
import type { BleMidiOutput } from "./BleMidiOutput";
import type { MidiOutputSender } from "./MidiOutputSender";

type Mocked<T> = T & Record<string, ReturnType<typeof vi.fn>>;

function fakeSender(attached = false): Mocked<MidiOutputSender> {
  return {
    isAttached: attached,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    clearScheduled: vi.fn(),
    sendRaw: vi.fn(),
  } as unknown as Mocked<MidiOutputSender>;
}

function fakeBle(): Mocked<BleMidiOutput> {
  return {
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    releaseScheduled: vi.fn(),
    clearScheduled: vi.fn(),
    setLatencyMs: vi.fn(),
    selectPianoVoice: vi.fn(),
    silenceAndClose: vi.fn(async () => {}),
    close: vi.fn(),
  } as unknown as Mocked<BleMidiOutput>;
}

describe("PianoPlaybackOutput", () => {
  test("sends nothing until enabled", () => {
    const ble = fakeBle();
    const out = new PianoPlaybackOutput(fakeSender());
    out.setBluetooth(ble);
    out.noteOn(60, 90, 1);
    expect(ble.noteOn).not.toHaveBeenCalled();
    out.setEnabled(true);
    out.noteOn(60, 90, 1);
    expect(ble.noteOn).toHaveBeenCalledWith(60, 90, 1);
  });

  test("Bluetooth wins over Web MIDI and selects the piano voice", () => {
    const web = fakeSender(true);
    const ble = fakeBle();
    const out = new PianoPlaybackOutput(web);
    out.setLatencyMs(25);
    out.setBluetooth(ble);
    out.setEnabled(true);
    out.noteOn(60, 90, 100);
    expect(ble.selectPianoVoice).toHaveBeenCalled();
    expect(ble.setLatencyMs).toHaveBeenCalledWith(25);
    expect(web.noteOn).not.toHaveBeenCalled();
  });

  test("Web MIDI port gets the same queued delivery as Bluetooth", async () => {
    vi.useFakeTimers();
    const web = fakeSender(true);
    const out = new PianoPlaybackOutput(web);
    out.onWebMidiChanged();
    out.setLatencyMs(20);
    out.setEnabled(true);
    expect(web.sendRaw).toHaveBeenCalledWith([0xc0, 0]);

    const now = performance.now();
    out.noteOn(60, 90, now - 1);
    out.noteOff(60, now + 60_000);
    await vi.advanceTimersByTimeAsync(1);
    expect(web.sendRaw).toHaveBeenCalledWith([0x90, 60, 90]);

    // Pause before the note's end: it keeps sounding until then.
    out.releaseScheduled(now);
    await vi.advanceTimersByTimeAsync(1);
    expect(web.sendRaw).not.toHaveBeenCalledWith([0x80, 60, 0x40]);
    await out.clearScheduled();
    expect(web.sendRaw).toHaveBeenCalledWith([0xb0, 123, 0]);
    expect(web.sendRaw).toHaveBeenCalledWith([0x80, 60, 0x40]);
  });

  test("disabling silences the piano; losing Bluetooth closes it", () => {
    const ble = fakeBle();
    const out = new PianoPlaybackOutput(fakeSender());
    out.setBluetooth(ble);
    out.setEnabled(true);
    out.setEnabled(false);
    expect(ble.clearScheduled).toHaveBeenCalled();
    out.setBluetooth(null);
    expect(ble.silenceAndClose).toHaveBeenCalled();
    expect(out.hasPiano).toBe(false);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
