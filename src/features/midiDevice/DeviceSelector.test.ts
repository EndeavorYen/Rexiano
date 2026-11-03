import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendTestNote, type TestButtonState } from "./midiTestUtils";
import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";

describe("sendTestNote", () => {
  let sender: MidiOutputSender;
  let mockOutput: MIDIOutput;

  beforeEach(() => {
    vi.useFakeTimers();
    sender = new MidiOutputSender();

    // Spy on sender methods
    vi.spyOn(sender, "attach");
    vi.spyOn(sender, "noteOn");
    vi.spyOn(sender, "noteOff");
    vi.spyOn(sender, "detach");

    // Create a minimal mock MIDIOutput
    mockOutput = {
      id: "test-output",
      name: "Test Output",
      manufacturer: "Test",
      type: "output",
      state: "connected",
      connection: "open",
      send: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
      onstatechange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      version: "",
      clear: vi.fn(),
    } as unknown as MIDIOutput;
  });

  it("attaches sender to the output port", async () => {
    const promise = sendTestNote(sender, mockOutput);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(sender.attach).toHaveBeenCalledWith(mockOutput);
  });

  it("sends noteOn with C4 (midi 60) at velocity 100", async () => {
    const promise = sendTestNote(sender, mockOutput);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(sender.noteOn).toHaveBeenCalledWith(60, 100);
  });

  it("sends noteOff after 300ms delay", async () => {
    const promise = sendTestNote(sender, mockOutput);

    // Before 300ms: noteOff should not have been called
    expect(sender.noteOff).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(sender.noteOff).toHaveBeenCalledWith(60);
  });

  it("detaches sender after completion", async () => {
    const promise = sendTestNote(sender, mockOutput);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(sender.detach).toHaveBeenCalled();
  });

  it("calls methods in correct order: attach → noteOn → wait → noteOff → detach", async () => {
    const callOrder: string[] = [];
    vi.spyOn(sender, "attach").mockImplementation(() => {
      callOrder.push("attach");
    });
    vi.spyOn(sender, "noteOn").mockImplementation(() => {
      callOrder.push("noteOn");
    });
    vi.spyOn(sender, "noteOff").mockImplementation(() => {
      callOrder.push("noteOff");
    });
    vi.spyOn(sender, "detach").mockImplementation(() => {
      callOrder.push("detach");
    });

    const promise = sendTestNote(sender, mockOutput);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(callOrder).toEqual(["attach", "noteOn", "noteOff", "detach"]);
  });
});

describe("TestButtonState type", () => {
  it("accepts valid states", () => {
    const states: TestButtonState[] = ["idle", "playing", "ok"];
    expect(states).toHaveLength(3);
  });
});
