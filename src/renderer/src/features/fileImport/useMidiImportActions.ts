import { useCallback, useRef, useState, type DragEvent } from "react";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import type { ParsedSong } from "@renderer/engines/midi/types";
import {
  getFileImportErrorGuidance,
  type FileImportErrorGuidance,
  type FileImportErrorInput,
  type FileImportRecoveryActionId,
} from "./fileImportErrorGuidance";

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
  ) => void;
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

export function getFileNameFromPath(filePath: string): string | undefined {
  return filePath.split(/[\\/]/).pop() || undefined;
}

export function useMidiImportActions({
  t,
  loadSong,
  resetPlayback,
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
        void window.api.saveRecentFile({
          path: result.path,
          name: result.fileName,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("Failed to read MIDI file:", error);
      showImportError({ kind: "read-failed", diagnostic: error });
    }
  }, [loadParsedSong, showImportError]);

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
        }
      } catch (error) {
        console.error("Failed to load MIDI from path:", error);
        showImportError({
          kind: "read-failed",
          fileName: getFileNameFromPath(filePath),
          path: filePath,
          diagnostic: error,
        });
      }
    },
    [loadParsedSong, showImportError],
  );

  const dismissImportError = useCallback((): void => {
    setImportError((current) => reduceImportErrorForEvent(current, "dismiss"));
  }, []);

  const handleImportRecoveryAction = useCallback(
    (actionId: FileImportRecoveryActionId, input: FileImportErrorInput) => {
      setImportError((current) =>
        reduceImportErrorForEvent(current, "recovery-start"),
      );

      if (actionId === "remove-recent") {
        if (input.path) void window.api.removeRecentFile(input.path);
        return;
      }

      if (actionId === "retry-read" && input.path) {
        void handleLoadMidiPath(input.path);
        return;
      }

      void handleOpenFile();
    },
    [handleLoadMidiPath, handleOpenFile],
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

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
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
