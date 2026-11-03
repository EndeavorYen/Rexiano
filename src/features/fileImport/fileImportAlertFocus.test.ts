import { describe, expect, test } from "vitest";
import { shouldRestoreImportAlertFocus } from "./fileImportAlertFocus";

describe("shouldRestoreImportAlertFocus", () => {
  test("restores only after focus was inside the dismissed alert", () => {
    expect(
      shouldRestoreImportAlertFocus({
        alertHadFocus: true,
        returnTargetIsConnected: true,
      }),
    ).toBe(true);
    expect(
      shouldRestoreImportAlertFocus({
        alertHadFocus: false,
        returnTargetIsConnected: true,
      }),
    ).toBe(false);
  });

  test("does not restore a target that has left the document", () => {
    expect(
      shouldRestoreImportAlertFocus({
        alertHadFocus: true,
        returnTargetIsConnected: false,
      }),
    ).toBe(false);
  });
});
