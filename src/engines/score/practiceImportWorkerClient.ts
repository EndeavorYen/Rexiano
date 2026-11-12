/**
 * Parses and notates imported practice files off the main thread.
 *
 * Opening a large import costs about 0.6 s of `@tonejs/midi` work for 20,000
 * notes, plus most of a second again for the quantization and voice splitting in
 * `MidiToNotation`. On the main thread that is one unresponsive tap on the way
 * into a song, so both pure steps move into a worker.
 *
 * The two results arrive separately: the song as soon as it is parsed, so the
 * practice view can open and start making sound, and its notation when the
 * conversion finishes.
 *
 * The worker is a singleton reused across imports, and every path that cannot
 * use one (no `Worker`, worker creation failure, worker crash) hands back the
 * song parsed on the main thread with no notation, which is what the app did
 * before: an import must never hang because a worker is missing.
 */

import { parseImportedPracticeFile } from "./decodeImportedPracticeFile";
import type { ParsedSong } from "../midi/types";
import type { NotationData } from "@renderer/features/sheetMusic/types";

export interface PracticeImportParseRequest {
  /** Routes the reply back to the caller that asked for it. */
  id: number;
  fileName: string;
  data: Uint8Array;
}

export type PracticeImportParseResponse =
  | { id: number; kind: "song"; song: ParsedSong }
  | { id: number; kind: "notation"; notation: NotationData | null }
  | { id: number; kind: "error"; error: string };

/** A conversion that arrived off-thread, paired with the song it belongs to. */
export type ImportedNotation = {
  song: ParsedSong;
  notation: NotationData;
} | null;

/** One import in flight: the song first, its notation when it is ready. */
export interface OffThreadImport {
  song: Promise<ParsedSong>;
  /** Resolves `null` when nothing was converted off-thread. */
  notation: Promise<ImportedNotation>;
}

/** The slice of `Worker` this client needs, so tests can fake it. */
export interface PracticeImportWorker {
  postMessage: (message: PracticeImportParseRequest) => void;
  terminate: () => void;
  addEventListener: (
    type: "message" | "error",
    listener: (event: unknown) => void,
  ) => void;
}

export type PracticeImportWorkerFactory = () => PracticeImportWorker | null;

export interface PracticeImportParseRunner {
  start: (fileName: string, data: Uint8Array) => OffThreadImport;
}

interface PendingImport {
  fileName: string;
  data: Uint8Array;
  song?: ParsedSong;
  resolveSong: (song: ParsedSong) => void;
  resolveNotation: (result: ImportedNotation) => void;
  reject: (error: unknown) => void;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function parseOnMainThread(
  fileName: string,
  data: Uint8Array,
): OffThreadImport {
  const song = deferred<ParsedSong>();
  const notation = deferred<ImportedNotation>();
  try {
    const parsed = parseImportedPracticeFile(fileName, Array.from(data));
    song.resolve(parsed);
    notation.resolve(null);
  } catch (error) {
    song.reject(error);
    notation.reject(error);
  }
  return { song: song.promise, notation: notation.promise };
}

export function createPracticeImportParseRunner(
  createWorker: PracticeImportWorkerFactory,
): PracticeImportParseRunner {
  let worker: PracticeImportWorker | null = null;
  let nextId = 1;
  const pending = new Map<number, PendingImport>();

  const attach = (created: PracticeImportWorker): void => {
    created.addEventListener("message", (event) => {
      const response = (event as { data: PracticeImportParseResponse }).data;
      const request = pending.get(response?.id);
      if (!request) return;
      if (response.kind === "song") {
        request.song = response.song;
        request.resolveSong(response.song);
        return;
      }
      pending.delete(response.id);
      if (response.kind === "error") {
        request.reject(new Error(response.error));
        return;
      }
      request.resolveNotation(
        request.song && response.notation
          ? { song: request.song, notation: response.notation }
          : null,
      );
    });

    created.addEventListener("error", () => {
      // A dead worker must not lose an import: finish what is in flight here and
      // let the next import build a fresh worker.
      const waiting = [...pending.values()];
      pending.clear();
      worker = null;
      created.terminate();
      for (const request of waiting) {
        try {
          const parsed = parseImportedPracticeFile(
            request.fileName,
            Array.from(request.data),
          );
          request.resolveSong(parsed);
          request.resolveNotation(null);
        } catch (error) {
          request.reject(error);
        }
      }
    });
  };

  return {
    start(fileName, data) {
      if (!worker) {
        const created = createWorker();
        if (!created) return parseOnMainThread(fileName, data);
        worker = created;
        attach(created);
      }

      const id = nextId++;
      const song = deferred<ParsedSong>();
      const notation = deferred<ImportedNotation>();

      pending.set(id, {
        fileName,
        data,
        resolveSong: song.resolve,
        resolveNotation: notation.resolve,
        reject: (error) => {
          song.reject(error);
          notation.reject(error);
        },
      });
      worker?.postMessage({ id, fileName, data });

      return { song: song.promise, notation: notation.promise };
    },
  };
}

function createDefaultWorker(): PracticeImportWorker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(
      new URL("./practiceImportParseWorker.ts", import.meta.url),
      { type: "module" },
    ) as unknown as PracticeImportWorker;
  } catch (error) {
    console.warn(
      "Practice import worker unavailable; parsing on the main thread",
      error,
    );
    return null;
  }
}

let defaultRunner: PracticeImportParseRunner | null = null;

export function startImportedPracticeFileOffMainThread(
  fileName: string,
  data: Uint8Array,
  options: { createWorker?: PracticeImportWorkerFactory } = {},
): OffThreadImport {
  if (!defaultRunner) {
    defaultRunner = createPracticeImportParseRunner(
      options.createWorker ?? createDefaultWorker,
    );
  }
  return defaultRunner.start(fileName, data);
}
