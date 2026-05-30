import { describe, expect, test } from "vitest";
import { normalizeExternalUrl } from "./externalUrlPolicy";

describe("externalUrlPolicy", () => {
  test("allows https URLs", () => {
    expect(normalizeExternalUrl("https://github.com/EndeavorYen/Rexiano")).toBe(
      "https://github.com/EndeavorYen/Rexiano",
    );
  });

  test("rejects non-https protocols", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("file:///Users/simon/secrets.txt")).toBeNull();
    expect(normalizeExternalUrl("http://example.com")).toBeNull();
  });

  test("rejects malformed URLs", () => {
    expect(normalizeExternalUrl("not a url")).toBeNull();
  });
});
