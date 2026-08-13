export async function drainPendingAssociatedMidiFile(
  takePending: () => Promise<string | null>,
  preparePractice: () => void,
  loadMidiPath: (path: string) => Promise<void>,
): Promise<boolean> {
  const pendingPath = await takePending();
  if (!pendingPath) return false;
  preparePractice();
  await loadMidiPath(pendingPath);
  return true;
}

interface AssociatedMidiImportSubscription {
  takePending: () => Promise<string | null>;
  subscribe: (callback: () => void) => () => void;
  preparePractice: () => void;
  loadMidiPath: (path: string) => Promise<void>;
  onError: (error: unknown) => void;
}

/**
 * Subscribe before the initial pull so an OS event cannot be lost while the
 * renderer is mounting. A signal received during an active pull schedules one
 * more drain after that pull completes.
 */
export function subscribeToAssociatedMidiImports({
  takePending,
  subscribe,
  preparePractice,
  loadMidiPath,
  onError,
}: AssociatedMidiImportSubscription): () => void {
  let disposed = false;
  let draining = false;
  let drainRequested = false;

  const drain = async (): Promise<void> => {
    if (draining || disposed) return;
    draining = true;
    try {
      do {
        drainRequested = false;
        await drainPendingAssociatedMidiFile(
          takePending,
          preparePractice,
          loadMidiPath,
        );
      } while (drainRequested && !disposed);
    } catch (error) {
      onError(error);
    } finally {
      draining = false;
    }
  };

  const requestDrain = (): void => {
    if (disposed) return;
    drainRequested = true;
    void drain();
  };

  const unsubscribe = subscribe(requestDrain);
  requestDrain();

  return () => {
    disposed = true;
    unsubscribe();
  };
}
