import { describe, expect, test, vi } from "vitest";
import {
  createKeyPointerTracker,
  type KeyPointerTracker,
} from "./keyPointerTracker";

function setup(): {
  noteOn: ReturnType<typeof vi.fn>;
  noteOff: ReturnType<typeof vi.fn>;
  tracker: KeyPointerTracker;
} {
  const noteOn = vi.fn();
  const noteOff = vi.fn();
  return {
    noteOn,
    noteOff,
    tracker: createKeyPointerTracker({ noteOn, noteOff }),
  };
}

describe("createKeyPointerTracker", () => {
  test("press and release one key sends one note-on and one note-off", () => {
    const { noteOn, noteOff, tracker } = setup();
    tracker.down(1, 64);
    tracker.up(1);
    expect(noteOn).toHaveBeenCalledOnce();
    expect(noteOn).toHaveBeenCalledWith(64);
    expect(noteOff).toHaveBeenCalledWith(64);
  });

  test("up for a pointer that pressed nothing does nothing", () => {
    const { noteOff, tracker } = setup();
    tracker.up(7);
    expect(noteOff).not.toHaveBeenCalled();
  });

  test("two fingers make a chord and release independently", () => {
    const { noteOn, noteOff, tracker } = setup();
    tracker.down(1, 60);
    tracker.down(2, 64);
    expect(noteOn.mock.calls).toEqual([[60], [64]]);
    tracker.up(1);
    expect(noteOff.mock.calls).toEqual([[60]]);
    tracker.up(2);
    expect(noteOff.mock.calls).toEqual([[60], [64]]);
  });

  test("a key held by two pointers stays down until both lift", () => {
    const { noteOn, noteOff, tracker } = setup();
    tracker.down(1, 60);
    tracker.down(2, 60);
    expect(noteOn).toHaveBeenCalledOnce();
    tracker.up(1);
    expect(noteOff).not.toHaveBeenCalled();
    tracker.up(2);
    expect(noteOff).toHaveBeenCalledWith(60);
  });

  test("a second down from the same pointer moves it to the new key", () => {
    const { noteOn, noteOff, tracker } = setup();
    tracker.down(1, 60);
    tracker.down(1, 62);
    expect(noteOff).toHaveBeenCalledWith(60);
    expect(noteOn.mock.calls).toEqual([[60], [62]]);
  });

  test("releaseAll lifts every held key once", () => {
    const { noteOff, tracker } = setup();
    tracker.down(1, 60);
    tracker.down(2, 64);
    tracker.releaseAll();
    expect(noteOff.mock.calls).toEqual([[60], [64]]);
    tracker.releaseAll();
    expect(noteOff).toHaveBeenCalledTimes(2);
  });
});
