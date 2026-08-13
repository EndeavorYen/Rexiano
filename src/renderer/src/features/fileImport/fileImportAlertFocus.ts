interface ImportAlertFocusRestoreState {
  alertHadFocus: boolean;
  returnTargetIsConnected: boolean;
}

export function shouldRestoreImportAlertFocus(
  state: ImportAlertFocusRestoreState,
): boolean {
  return state.alertHadFocus && state.returnTargetIsConnected;
}
