import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearPendingRecent,
  flushPendingRecent,
  queueRecentFile,
} from "./pendingRecent";

beforeEach(() => clearPendingRecent());

describe("pendingRecent", () => {
  test("nothing is saved until playback starts", async () => {
    const save = vi.fn(async () => {});
    queueRecentFile({ path: "builtin:song", name: "Song" });
    expect(save).not.toHaveBeenCalled();
    await expect(flushPendingRecent(save, 1234)).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith({
      path: "builtin:song",
      name: "Song",
      timestamp: 1234,
    });
  });

  test("a second start of the same song does not save twice", async () => {
    const save = vi.fn(async () => {});
    queueRecentFile({ path: "builtin:song", name: "Song" });
    await flushPendingRecent(save, 1);
    await expect(flushPendingRecent(save, 2)).resolves.toBe(false);
    expect(save).toHaveBeenCalledOnce();
  });

  test("opening another song before playing replaces the pending one", async () => {
    const save = vi.fn(async () => {});
    queueRecentFile({ path: "builtin:a", name: "A" });
    queueRecentFile({ path: "builtin:b", name: "B" });
    await flushPendingRecent(save, 1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ path: "builtin:b" }),
    );
  });

  test("a failed save is reported, not thrown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queueRecentFile({ path: "builtin:a", name: "A" });
    await expect(
      flushPendingRecent(async () => {
        throw new Error("disk full");
      }, 1),
    ).resolves.toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  test("a song loaded without queueing (e.g. a dropped file) cannot inherit a stale entry", async () => {
    const save = vi.fn(async () => {});
    queueRecentFile({ path: "builtin:a", name: "A" });
    // App clears the pending entry whenever the loaded song changes.
    clearPendingRecent();
    await expect(flushPendingRecent(save, 1)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
