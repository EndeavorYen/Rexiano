import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import type { ParsedSong } from "@renderer/engines/midi/types";
import {
  getFileImportErrorGuidance,
  type FileImportErrorGuidance,
  type FileImportErrorInput,
  type FileImportRecoveryActionId,
} from "./fileImportErrorGuidance";
import {
  MAX_MIDI_FILE_BYTES,
  MIDI_FILE_TOO_LARGE_DIAGNOSTIC,
} from "@shared/midiFileLimits";
import { subscribeToAssociatedMidiImports } from "./associatedMidiImport";

export const MIDI_EXTENSIONS = [".mid", ".midi"] as const;

export type ImportErrorLifecycleEvent<T> =
  | "drag-enter"
  | "drag-leave"
  | "dismiss"
  | "recovery-start"
  | "import-succeeded"
  | { type: "show"; error: T };

export function reduceImportErrorForEvent<T>(
  current: T | null,
  event: ImportErrorLifecycleEvent<T>,
): T | null {
  if (typeof event !== "string") return event.error;
  return event === "drag-enter" || event === "drag-leave" ? current : null;
}

type Translate = Parameters<typeof getFileImportErrorGuidance>[1];

interface ImportErrorState {
  input: FileImportErrorInput;
  guidance: FileImportErrorGuidance;
}

interface UseMidiImportActionsOptions {
  t: Translate;
  loadSong: (song: ParsedSong) => void;
  resetPlayback: () => void;
  removeRecentFile: (filePath: string) => Promise<boolean>;
  refreshRecentFiles: () => void;
  prepareAssociatedMidiOpen: () => void;
}

export interface MidiImportActions {
  importError: ImportErrorState | null;
  isDragging: boolean;
  handleOpenFile: () => Promise<void>;
  handleLoadMidiPath: (filePath: string) => Promise<void>;
  dismissImportError: () => void;
  handleImportRecoveryAction: (
    actionId: FileImportRecoveryActionId,
    input: FileImportErrorInput,
  ) => Promise<void>;
  handleDragEnter: (event: DragEvent) => void;
  handleDragLeave: (event: DragEvent) => void;
  handleDragOver: (event: DragEvent) => void;
  handleDrop: (event: DragEvent) => void;
}

export function getMidiFileExtension(fileName: string): string {
  const extensionStart = fileName.lastIndexOf(".");
  return extensionStart === -1
    ? ""
    : fileName.slice(extensionStart).toLowerCase();
}

export function getUnsupportedMidiDropError(
  fileName: string,
): FileImportErrorInput | null {
  const ext = getMidiFileExtension(fileName);
  return MIDI_EXTENSIONS.includes(ext as (typeof MIDI_EXTENSIONS)[number])
    ? null
    : { kind: "unsupported-type", ext, fileName };
}

export function getOversizedMidiImportError(file: {
  name: string;
  size: number;
}): FileImportErrorInput | null {
  return file.size > MAX_MIDI_FILE_BYTES
    ? { kind: "oversized", fileName: file.name }
    : null;
}

function diagnosticMessage(diagnostic: unknown): string {
  return diagnostic instanceof Error
    ? diagnostic.message
    : typeof diagnostic === "string"
      ? diagnostic
      : "";
}

export function getMidiReadFailureError(
  diagnostic: unknown,
  fileName?: string,
  path?: string,
): FileImportErrorInput {
  return diagnosticMessage(diagnostic).includes(MIDI_FILE_TOO_LARGE_DIAGNOSTIC)
    ? { kind: "oversized", fileName, path, diagnostic }
    : { kind: "read-failed", fileName, path, diagnostic };
}

export function getFileNameFromPath(filePath: string): string | undefined {
  return filePath.split(/[\\/]/).pop() || undefined;
}

export type RecentRemovalRecoveryResult =
  | { ok: true }
  | { ok: false; diagnostic?: unknown };

export async function removeRecentForRecovery(
  filePath: string | undefined,
  removeRecentFile: (path: string) => Promise<boolean>,
): Promise<RecentRemovalRecoveryResult> {
  if (!filePath) return { ok: false };

  try {
    const removed = await removeRecentFile(filePath);
    return removed ? { ok: true } : { ok: false };
  } catch (diagnostic) {
    return { ok: false, diagnostic };
  }
}

export function useMidiImportActions({
  t,
  loadSong,
  resetPlayback,
  removeRecentFile,
  refreshRecentFiles,
  prepareAssociatedMidiOpen,
}: UseMidiImportActionsOptions): MidiImportActions {
  const [importError, setImportError] = useState<ImportErrorState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const showImportError = useCallback(
    (error: FileImportErrorInput): void => {
      const nextError = {
        input: error,
        guidance: getFileImportErrorGuidance(error, t),
      };
      setImportError((current) =>
        reduceImportErrorForEvent(current, {
          type: "show",
          error: nextError,
        }),
      );
    },
    [t],
  );

  const loadParsedSong = useCallback(
    (fileName: string, data: number[]): void => {
      const parsed = parseMidiFile(fileName, data);
      loadSong(parsed);
      resetPlayback();
      setImportError((current) =>
        reduceImportErrorForEvent(current, "import-succeeded"),
      );
    },
    [loadSong, resetPlayback],
  );

  const handleOpenFile = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.openMidiFile();
      if (!result) return;

      try {
        loadParsedSong(result.fileName, result.data);
      } catch (error) {
        console.error("Failed to parse MIDI file:", error);
        showImportError({
          kind: "parse-failed",
          fileName: result.fileName,
          path: result.path,
          diagnostic: error,
        });
        return;
      }

      if (result.path) {
        void window.api
          .saveRecentFile({
            path: result.path,
            name: result.fileName,
            timestamp: Date.now(),
          })
          .then(refreshRecentFiles)
          .catch((error: unknown) => {
            console.error("Failed to save recent MIDI file:", error);
          });
      }
    } catch (error) {
      console.error("Failed to read MIDI file:", error);
      showImportError(getMidiReadFailureError(error));
    }
  }, [loadParsedSong, refreshRecentFiles, showImportError]);

  const handleLoadMidiPath = useCallback(
    async (filePath: string): Promise<void> => {
      try {
        const result = await window.api.loadMidiPath(filePath);
        if (!result) {
          showImportError({
            kind: "missing-recent",
            fileName: getFileNameFromPath(filePath),
            path: filePath,
          });
          return;
        }

        try {
          loadParsedSong(result.fileName, result.data);
        } catch (error) {
          console.error("Failed to parse MIDI from path:", error);
          showImportError({
            kind: "parse-failed",
            fileName: result.fileName,
            path: filePath,
            diagnostic: error,
          });
          return;
        }

        void window.api
          .saveRecentFile({
            path: result.path ?? filePath,
            name: result.fileName,
            timestamp: Date.now(),
          })
          .then(refreshRecentFiles)
          .catch((error: unknown) => {
            console.error("Failed to save recent MIDI file:", error);
          });
      } catch (error) {
        console.error("Failed to load MIDI from path:", error);
        showImportError(
          getMidiReadFailureError(
            error,
            getFileNameFromPath(filePath),
            filePath,
          ),
        );
      }
    },
    [loadParsedSong, refreshRecentFiles, showImportError],
  );

  useEffect(() => {
    if (
      typeof window.api.takePendingAssociatedMidiFile !== "function" ||
      typeof window.api.onAssociatedMidiFilePending !== "function"
    ) {
      return;
    }

    return subscribeToAssociatedMidiImports({
      takePending: window.api.takePendingAssociatedMidiFile,
      subscribe: window.api.onAssociatedMidiFilePending,
      preparePractice: prepareAssociatedMidiOpen,
      loadMidiPath: handleLoadMidiPath,
      onError: (error) => {
        console.error("Failed to receive associated MIDI file:", error);
      },
    });
  }, [handleLoadMidiPath, prepareAssociatedMidiOpen]);

  const dismissImportError = useCallback((): void => {
    setImportError((current) => reduceImportErrorForEvent(current, "dismiss"));
  }, []);

  const handleImportRecoveryAction = useCallback(
    async (
      actionId: FileImportRecoveryActionId,
      input: FileImportErrorInput,
    ): Promise<void> => {
      if (actionId === "remove-recent") {
        const result = await removeRecentForRecovery(
          input.path,
          removeRecentFile,
        );
        if (!result.ok) {
          if (result.diagnostic) {
            console.error(
              "Failed to remove recent MIDI file:",
              result.diagnostic,
            );
          }
          return;
        }

        setImportError((current) =>
          current?.input.path === input.path
            ? reduceImportErrorForEvent(current, "recovery-start")
            : current,
        );
        return;
      }

      setImportError((current) =>
        reduceImportErrorForEvent(current, "recovery-start"),
      );

      if (actionId === "retry-read" && input.path) {
        void handleLoadMidiPath(input.path);
        return;
      }

      void handleOpenFile();
    },
    [handleLoadMidiPath, handleOpenFile, removeRecentFile],
  );

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCountRef.current += 1;
    setIsDragging(true);
    setImportError((current) =>
      reduceImportErrorForEvent(current, "drag-enter"),
    );
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragging(false);
      setImportError((current) =>
        reduceImportErrorForEvent(current, "drag-leave"),
      );
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const unsupportedError = getUnsupportedMidiDropError(file.name);
      if (unsupportedError) {
        showImportError(unsupportedError);
        return;
      }
      const oversizedError = getOversizedMidiImportError(file);
      if (oversizedError) {
        showImportError(oversizedError);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          if (arrayBuffer.byteLength > MAX_MIDI_FILE_BYTES) {
            showImportError({ kind: "oversized", fileName: file.name });
            return;
          }
          const data = Array.from(new Uint8Array(arrayBuffer));
          loadParsedSong(file.name, data);
        } catch (error) {
          console.error("Failed to parse dropped MIDI file:", error);
          showImportError({
            kind: "parse-failed",
            fileName: file.name,
            diagnostic: error,
          });
        }
      };
      reader.onerror = () => {
        showImportError({ kind: "read-failed", fileName: file.name });
      };
      reader.readAsArrayBuffer(file);
    },
    [loadParsedSong, showImportError],
  );

  return {
    importError,
    isDragging,
    handleOpenFile,
    handleLoadMidiPath,
    dismissImportError,
    handleImportRecoveryAction,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
