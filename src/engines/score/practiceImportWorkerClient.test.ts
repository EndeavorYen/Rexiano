import { describe, expect, it, vi } from "vitest";
import { Midi } from "@tonejs/midi";
import {
  createPracticeImportParseRunner,
  startImportedPracticeFileOffMainThread,
  type PracticeImportParseRequest,
  type PracticeImportParseResponse,
  type PracticeImportWorker,
} from "./practiceImportWorkerClient";
import type { NotationData } from "@renderer/features/sheetMusic/types";
import type { ParsedSong } from "../midi/types";

function songFixture(fileName: string): ParsedSong {
  return {
    fileName,
    duration: 30,
    tracks: [
      {
        name: "Piano",
        instrument: "acoustic_grand_piano",
        channel: 0,
        notes: [],
      },
    ],
    tempos: [{ time: 0, ticks: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
    noteCount: 0,
  };
}

function tinyMidiBytes(): Uint8Array {
  const midi = new Midi();
  midi.addTrack().addNote({ midi: 60, ticks: 0, duration: 1 });
  return new Uint8Array(midi.toArray());
}

const notationFixture: NotationData = {
  measures: [],
  bpm: 120,
  ticksPerQuarter: 480,
};

interface FakeWorker extends PracticeImportWorker {
  posts: PracticeImportParseRequest[];
  reply: (response: PracticeImportParseResponse) => void;
  crash: () => void;
}

function fakeWorker(): FakeWorker {
  const posts: PracticeImportParseRequest[] = [];
  const listeners: Record<"message" | "error", ((event: unknown) => void)[]> = {
    message: [],
    error: [],
  };
  return {
    posts,
    postMessage: vi.fn((message: PracticeImportParseRequest) => {
      posts.push(message);
    }),
    terminate: vi.fn(),
    addEventListener: vi.fn(
      (type: "message" | "error", listener: (event: unknown) => void) => {
        listeners[type].push(listener);
      },
    ),
    reply: (response) => {
      for (const listener of listeners.message) listener({ data: response });
    },
    crash: () => {
      for (const listener of listeners.error) listener({});
    },
  };
}

describe("createPracticeImportParseRunner", () => {
  it("hands back the song as soon as the worker has parsed it", async () => {
    const worker = fakeWorker();
    const createWorker = vi.fn(() => worker as PracticeImportWorker);
    const runner = createPracticeImportParseRunner(createWorker);

    const job = runner.start("nocturne.mid", tinyMidiBytes());
    const posted = worker.posts[0];
    worker.reply({
      id: posted.id,
      kind: "song",
      song: songFixture(posted.fileName),
    });

    const song = await job.song;
    expect(song.fileName).toBe("nocturne.mid");
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(worker.posts).toHaveLength(1);

    worker.reply({
      id: posted.id,
      kind: "notation",
      notation: notationFixture,
    });
    const result = await job.notation;
    expect(result?.song).toBe(song);
    expect(result?.notation).toBe(notationFixture);
  });

  it("resolves no notation when the worker could not convert it", async () => {
    const worker = fakeWorker();
    const runner = createPracticeImportParseRunner(() => worker);

    const job = runner.start("ballade.mid", tinyMidiBytes());
    const posted = worker.posts[0];
    worker.reply({
      id: posted.id,
      kind: "song",
      song: songFixture(posted.fileName),
    });
    worker.reply({ id: posted.id, kind: "notation", notation: null });

    expect((await job.song).fileName).toBe("ballade.mid");
    expect(await job.notation).toBeNull();
  });

  it("parses on the main thread when no worker can be created", async () => {
    const createWorker = vi.fn(() => null);
    const runner = createPracticeImportParseRunner(createWorker);

    const job = runner.start("twinkle.mid", tinyMidiBytes());

    expect(createWorker).toHaveBeenCalledTimes(1);
    const song = await job.song;
    expect(song.fileName).toBe("twinkle.mid");
    expect(song.noteCount).toBe(1);
    expect(await job.notation).toBeNull();
  });

  it("passes the worker's reason back to the caller", async () => {
    const worker = fakeWorker();
    const runner = createPracticeImportParseRunner(() => worker);

    const job = runner.start("empty.mid", tinyMidiBytes());
    worker.reply({
      id: worker.posts[0].id,
      kind: "error",
      error: "MIDI file has no notes.",
    });

    await expect(job.song).rejects.toThrow("MIDI file has no notes.");
    await expect(job.notation).rejects.toThrow("MIDI file has no notes.");
  });

  it("finishes the import on the main thread when the worker dies", async () => {
    const worker = fakeWorker();
    const runner = createPracticeImportParseRunner(() => worker);

    const job = runner.start("crash-song.mid", tinyMidiBytes());
    worker.crash();

    const song = await job.song;
    expect(song.fileName).toBe("crash-song.mid");
    expect(song.noteCount).toBe(1);
    expect(await job.notation).toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("builds a fresh worker for the next import after a crash", async () => {
    const workers: FakeWorker[] = [];
    const createWorker = vi.fn(() => {
      const worker = fakeWorker();
      workers.push(worker);
      return worker;
    });
    const runner = createPracticeImportParseRunner(createWorker);

    const first = runner.start("first.mid", tinyMidiBytes());
    workers[0].crash();
    await first.song;
    runner.start("second.mid", tinyMidiBytes());

    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("reuses one worker across imports", async () => {
    const worker = fakeWorker();
    const createWorker = vi.fn(() => worker);
    const runner = createPracticeImportParseRunner(createWorker);

    const first = runner.start("a.mid", tinyMidiBytes());
    const second = runner.start("b.mid", tinyMidiBytes());
    for (const post of worker.posts) {
      worker.reply({
        id: post.id,
        kind: "song",
        song: songFixture(post.fileName),
      });
    }

    expect((await first.song).fileName).toBe("a.mid");
    expect((await second.song).fileName).toBe("b.mid");
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(worker.posts).toHaveLength(2);
  });
});

describe("startImportedPracticeFileOffMainThread", () => {
  it("parses here when the page offers no worker", async () => {
    const job = startImportedPracticeFileOffMainThread(
      "no-worker.mid",
      tinyMidiBytes(),
      { createWorker: () => null },
    );
    expect((await job.song).fileName).toBe("no-worker.mid");
  });
});
