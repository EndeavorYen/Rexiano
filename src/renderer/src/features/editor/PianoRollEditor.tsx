import { useCallback, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import {
  createAddNoteCommand,
  createDeleteNotesCommand,
  createEditorHistory,
  createMoveNotesCommand,
  createUpdateNotesCommand,
  executeEditorCommand,
  redoEditorCommand,
  resolveEditorCommandShortcut,
  undoEditorCommand,
  type EditorCommand,
  type EditorHistory,
} from "./editorCommands";
import {
  applyEditorModeAction,
  createInitialEditorModeState,
  resolveEditorModeShortcut,
  type EditorModeAction,
  type EditorModeState,
} from "./editorMode";
import { EditorToolbar } from "./EditorToolbar";
import type { EditableSong } from "./editorTypes";
import {
  createEditableSongFromParsedSong,
  createNoteFromGridPoint,
  getDefaultPianoRollGrid,
  pitchToY,
  snapDeltaToGrid,
  timeToX,
  yToPitch,
} from "./pianoRollModel";

interface PianoRollEditorProps {
  parsedSong: ParsedSong;
  onClose: () => void;
}

interface DragState {
  noteId: string;
  kind: "move" | "resize";
  startX: number;
  startY: number;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function PianoRollEditor({
  parsedSong,
  onClose,
}: PianoRollEditorProps): React.JSX.Element {
  const grid = useMemo(() => getDefaultPianoRollGrid(), []);
  const [editableSong, setEditableSong] = useState<EditableSong>(() =>
    createEditableSongFromParsedSong(parsedSong),
  );
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(editableSong.id),
  );
  const [modeState, setModeState] = useState<EditorModeState>(() =>
    createInitialEditorModeState(),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const runCommand = useCallback(
    (command: EditorCommand) => {
      const result = executeEditorCommand(history, editableSong, command);
      setEditableSong(result.song);
      setHistory(result.history);
    },
    [editableSong, history],
  );

  const applyModeAction = useCallback((action: EditorModeAction) => {
    setModeState((current) => applyEditorModeAction(current, action));
  }, []);

  const getRelativePoint = useCallback(
    (event: React.PointerEvent<SVGSVGElement | SVGRectElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const deleteSelectedNotes = useCallback(
    (noteIds: string[]) => {
      if (noteIds.length === 0) return;
      runCommand(createDeleteNotesCommand(editableSong, noteIds));
      setModeState((current) => ({
        ...current,
        selectedNoteIds: current.selectedNoteIds.filter(
          (id) => !noteIds.includes(id),
        ),
        pendingPaste: false,
      }));
    },
    [editableSong, runCommand],
  );

  const handleGridClick = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      rootRef.current?.focus();
      if (modeState.tool !== "draw" || editableSong.tracks.length === 0) return;
      const point = getRelativePoint(event);
      const note = createNoteFromGridPoint({
        id: `editor-note-${Date.now()}`,
        trackId: editableSong.tracks[0].id,
        x: point.x,
        y: point.y,
        grid,
      });
      runCommand(createAddNoteCommand(note));
      setModeState((current) => ({
        ...current,
        selectedNoteIds: [note.id],
        pendingPaste: false,
      }));
    },
    [editableSong.tracks, getRelativePoint, grid, modeState.tool, runCommand],
  );

  const handleNotePointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>, noteId: string) => {
      event.preventDefault();
      event.stopPropagation();
      rootRef.current?.focus();

      if (event.button === 2 || modeState.tool === "erase") {
        deleteSelectedNotes([noteId]);
        return;
      }

      const point = getRelativePoint(event);
      const note = editableSong.notes.find(
        (candidate) => candidate.id === noteId,
      );
      const noteRightEdge = note
        ? timeToX(note.start + note.duration, grid)
        : point.x;
      setModeState((current) => ({
        ...current,
        selectedNoteIds: [noteId],
        pendingPaste: false,
      }));
      setDragState({
        noteId,
        kind: noteRightEdge - point.x <= 8 ? "resize" : "move",
        startX: point.x,
        startY: point.y,
      });
    },
    [
      deleteSelectedNotes,
      editableSong.notes,
      getRelativePoint,
      grid,
      modeState.tool,
    ],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!dragState) return;
      const point = getRelativePoint(event);
      const startDelta = snapDeltaToGrid(
        (point.x - dragState.startX) / grid.pixelsPerSecond,
        grid.snapSeconds,
      );
      const pitchDelta =
        yToPitch(dragState.startY, grid) - yToPitch(point.y, grid);
      const note = editableSong.notes.find(
        (candidate) => candidate.id === dragState.noteId,
      );

      if (note && dragState.kind === "resize" && Math.abs(startDelta) > 0) {
        runCommand(
          createUpdateNotesCommand(editableSong, [note.id], {
            duration: Math.max(grid.snapSeconds, note.duration + startDelta),
          }),
        );
      } else if (
        note &&
        dragState.kind === "move" &&
        (Math.abs(startDelta) > 0 || pitchDelta !== 0)
      ) {
        runCommand(
          createMoveNotesCommand(editableSong, [note.id], {
            startDelta,
            pitchDelta,
          }),
        );
      }

      setDragState(null);
    },
    [dragState, editableSong, getRelativePoint, grid, runCommand],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const shortcutInput = {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isTypingTarget: isTypingTarget(event.target),
      };
      const commandShortcut = resolveEditorCommandShortcut(shortcutInput);
      if (commandShortcut === "undo") {
        event.preventDefault();
        const result = undoEditorCommand(history, editableSong);
        setEditableSong(result.song);
        setHistory(result.history);
        return;
      }
      if (commandShortcut === "redo") {
        event.preventDefault();
        const result = redoEditorCommand(history, editableSong);
        setEditableSong(result.song);
        setHistory(result.history);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedNotes(modeState.selectedNoteIds);
        return;
      }

      const modeAction = resolveEditorModeShortcut(shortcutInput);
      if (modeAction.type !== "none") {
        event.preventDefault();
        applyModeAction(modeAction);
      }
    },
    [
      applyModeAction,
      deleteSelectedNotes,
      editableSong,
      history,
      modeState.selectedNoteIds,
    ],
  );

  const maxNoteEnd = Math.max(
    parsedSong.duration,
    ...editableSong.notes.map((note) => note.start + note.duration),
  );
  const canvasWidth = Math.max(640, timeToX(maxNoteEnd + 1, grid));
  const canvasHeight = (grid.maxPitch - grid.minPitch + 1) * grid.rowHeight;
  const selectedIds = new Set(modeState.selectedNoteIds);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="flex h-full min-h-0 flex-col outline-none"
      onKeyDown={handleKeyDown}
      data-testid="piano-roll-editor"
    >
      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background:
            "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        }}
      >
        <EditorToolbar state={modeState} onAction={applyModeAction} />
        <div className="min-w-0 flex-1 text-center">
          <p
            className="truncate text-xs font-body font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            {editableSong.title}
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
          title="Close editor"
          aria-label="Close editor"
          onClick={onClose}
          data-testid="close-editor"
        >
          <X size={15} />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto"
        data-testid="piano-roll-scroll"
      >
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={canvasHeight}
          className="block"
          style={{ background: "var(--color-surface)" }}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDragState(null)}
          onPointerLeave={() => setDragState(null)}
          onPointerDown={handleGridClick}
          onContextMenu={(event) => event.preventDefault()}
          data-testid="piano-roll-grid"
        >
          {Array.from({ length: grid.maxPitch - grid.minPitch + 2 }).map(
            (_, index) => (
              <line
                key={`row-${index}`}
                x1={0}
                x2={canvasWidth}
                y1={index * grid.rowHeight}
                y2={index * grid.rowHeight}
                stroke="var(--color-border)"
                strokeOpacity={index % 12 === 0 ? 0.55 : 0.24}
              />
            ),
          )}
          {Array.from({ length: Math.ceil(maxNoteEnd + 2) }).map((_, index) => (
            <line
              key={`beat-${index}`}
              x1={timeToX(index, grid)}
              x2={timeToX(index, grid)}
              y1={0}
              y2={canvasHeight}
              stroke="var(--color-border)"
              strokeOpacity={0.5}
            />
          ))}
          {editableSong.notes.map((note) => {
            const isSelected = selectedIds.has(note.id);
            return (
              <rect
                key={note.id}
                x={timeToX(note.start, grid)}
                y={pitchToY(note.pitch, grid) + 1}
                width={Math.max(8, note.duration * grid.pixelsPerSecond)}
                height={grid.rowHeight - 2}
                rx={3}
                fill={
                  isSelected ? "var(--color-accent)" : "var(--color-note-blue)"
                }
                stroke={
                  isSelected ? "var(--color-text)" : "var(--color-border)"
                }
                strokeWidth={isSelected ? 1.5 : 1}
                opacity={0.92}
                onPointerDown={(event) => handleNotePointerDown(event, note.id)}
                data-testid="piano-roll-note"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
