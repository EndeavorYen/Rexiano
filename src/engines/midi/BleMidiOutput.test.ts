import { describe, expect, test, vi } from "vitest";
import { BleMidiOutput } from "./BleMidiOutput";
import { encodeBleMidiPackets } from "./bleMidiPacket";

interface Harness {
  output: BleMidiOutput;
  advance: (ms: number) => Promise<void>;
  messages: () => number[][];
  packets: number[][];
}

/** Manual clock + timer queue so tests control exactly when things fire. */
function harness(): Harness {
  let now = 1000;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const packets: number[][] = [];
  const output = new BleMidiOutput({
    write: async (packet) => {
      packets.push(Array.from(packet));
    },
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const advance = async (ms: number): Promise<void> => {
    now += ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const due = timers[0];
      if (!due || due.at > now) break;
      timers.shift();
      due.fn();
      await Promise.resolve();
      await Promise.resolve();
    }
    await Promise.resolve();
  };
  /** MIDI messages written so far, BLE header/timestamp bytes removed. */
  const messages = (): number[][] =>
    packets.flatMap((p) => {
      const out: number[][] = [];
      for (let i = 1; i < p.length; ) {
        const len = (p[i + 1] & 0xf0) === 0xc0 ? 2 : 3;
        out.push(p.slice(i + 1, i + 1 + len));
        i += 1 + len;
      }
      return out;
    });
  return { output, advance, messages, packets };
}

describe("encodeBleMidiPackets", () => {
  test("wraps messages with header and 13-bit timestamp", () => {
    const [packet] = encodeBleMidiPackets([[0x90, 60, 100]], 0x1abc);
    expect(Array.from(packet)).toEqual([
      0x80 | ((0x1abc >> 7) & 0x3f),
      0x80 | (0x1abc & 0x7f),
      0x90,
      60,
      100,
    ]);
  });

  test("splits into 20-byte packets", () => {
    const chord = Array.from({ length: 6 }, (_, i) => [0x90, 60 + i, 90]);
    const packets = encodeBleMidiPackets(chord, 5);
    expect(packets.map((p) => p.length)).toEqual([17, 9]);
    expect(packets.every((p) => p.length <= 20)).toBe(true);
  });
});

describe("BleMidiOutput", () => {
  test("plays a note at its time and releases it at its end", async () => {
    const h = harness();
    h.output.noteOn(60, 100, 1050);
    h.output.noteOff(60, 1300);

    await h.advance(40);
    expect(h.messages()).toEqual([]);
    await h.advance(10);
    expect(h.messages()).toEqual([[0x90, 60, 100]]);
    await h.advance(250);
    expect(h.messages()).toEqual([
      [0x90, 60, 100],
      [0x80, 60, 0x40],
    ]);
    expect(h.output.pendingCount).toBe(0);
  });

  test("sends a chord in one write", async () => {
    const h = harness();
    for (const midi of [60, 64, 67]) {
      h.output.noteOn(midi, 90, 1020);
      h.output.noteOff(midi, 1500);
    }
    await h.advance(20);
    expect(h.packets).toHaveLength(1);
    expect(h.messages()).toHaveLength(3);
  });

  test("output latency sends notes early", async () => {
    const h = harness();
    h.output.setLatencyMs(30);
    h.output.noteOn(60, 100, 1100);
    h.output.noteOff(60, 1200);
    await h.advance(70);
    expect(h.messages()).toEqual([[0x90, 60, 100]]);
  });

  test("pause drops unstarted notes but lets sounding ones end on time", async () => {
    const h = harness();
    h.output.noteOn(48, 80, 1000);
    h.output.noteOff(48, 1400);
    h.output.noteOn(60, 80, 1200);
    h.output.noteOff(60, 1300);
    await h.advance(0);

    h.output.releaseScheduled();
    await h.advance(500);
    expect(h.messages()).toEqual([
      [0x90, 48, 80],
      [0x80, 48, 0x40],
    ]);
  });

  test("stop silences sounding keys, sustain and all notes", async () => {
    const h = harness();
    h.output.noteOn(48, 80, 1000);
    h.output.noteOff(48, 5000);
    await h.advance(0);
    h.output.clearScheduled();
    await h.advance(0);
    // Pedal up and All Notes Off first, so they make the first packet.
    expect(h.messages()).toEqual([
      [0x90, 48, 80],
      [0xb0, 64, 0],
      [0xb0, 123, 0],
      [0x80, 48, 0x40],
    ]);
    await h.advance(5000);
    expect(h.messages()).toHaveLength(4);
  });

  test("pause releases notes played early so resume does not strike them twice", async () => {
    const h = harness();
    h.output.setLatencyMs(40);
    // Real time 1030, sent 40 ms early at 990… i.e. right now.
    h.output.noteOn(60, 90, 1030);
    h.output.noteOff(60, 1500);
    await h.advance(0);
    expect(h.messages()).toEqual([[0x90, 60, 90]]);

    // Pause at 1000: the scheduler will send this note again on resume.
    h.output.releaseScheduled(1000);
    await h.advance(0);
    expect(h.messages()).toEqual([
      [0x90, 60, 90],
      [0x80, 60, 0x40],
    ]);
    expect(h.output.pendingCount).toBe(0);
  });

  test("a failed write asks the piano to release every key", async () => {
    let failNext = true;
    const sent: number[][] = [];
    const output = new BleMidiOutput({
      write: async (packet) => {
        if (failNext) {
          failNext = false;
          throw new Error("GATT busy");
        }
        sent.push(Array.from(packet));
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    output.selectPianoVoice();
    await output.whenIdle();
    expect(sent.flatMap((p) => p.slice(2))).toEqual(
      expect.arrayContaining([0xb0, 123, 0]),
    );
    warn.mockRestore();
  });

  test("silenceAndClose sends all-notes-off before closing", async () => {
    const h = harness();
    h.output.noteOn(48, 80, 1000);
    h.output.noteOff(48, 5000);
    await h.advance(0);
    const closing = h.output.silenceAndClose();
    await h.advance(0);
    await closing;
    expect(h.messages()).toContainEqual([0xb0, 123, 0]);
    h.output.noteOn(60, 80, 1000);
    await h.advance(10);
    expect(h.messages().filter((m) => m[1] === 60)).toHaveLength(0);
  });

  test("a plain send sink delivers raw messages (Web MIDI port)", async () => {
    const sent: number[][] = [];
    const output = new BleMidiOutput({ send: (m) => sent.push(m) });
    output.selectPianoVoice();
    await output.whenIdle();
    expect(sent).toEqual([[0xc0, 0]]);
  });

  test("overlapping copies of a key release only after the last ends", async () => {
    const h = harness();
    h.output.noteOn(60, 90, 1000);
    h.output.noteOff(60, 1200);
    h.output.noteOn(60, 90, 1100);
    h.output.noteOff(60, 1400);
    await h.advance(250);
    expect(h.messages().filter((m) => m[0] === 0x80)).toHaveLength(0);
    await h.advance(200);
    expect(h.messages().filter((m) => m[0] === 0x80)).toEqual([
      [0x80, 60, 0x40],
    ]);
  });

  test("selects the piano voice and sends nothing after close", async () => {
    const h = harness();
    h.output.selectPianoVoice();
    await h.advance(0);
    expect(h.messages()).toEqual([[0xc0, 0]]);
    h.output.close();
    h.output.noteOn(60, 90, 1000);
    h.output.noteOff(60, 1100);
    await h.advance(500);
    expect(h.messages()).toEqual([[0xc0, 0]]);
  });
});
