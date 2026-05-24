import { describe, expect, test } from "vitest";
import { describeFallingNotesInitFailure } from "./fallingNotesInitFailure";

describe("fallingNotesInitFailure", () => {
  test("keeps a safe detail from Error instances", () => {
    expect(
      describeFallingNotesInitFailure(new Error("WebGL unavailable")),
    ).toEqual({
      titleKey: "fallingNotes.renderFailureTitle",
      guidanceKey: "fallingNotes.renderFailureGuidance",
      detail: "WebGL unavailable",
    });
  });

  test("uses a stable fallback detail for unknown failures", () => {
    expect(describeFallingNotesInitFailure(null).detail).toBe(
      "Renderer initialization failed.",
    );
  });
});
