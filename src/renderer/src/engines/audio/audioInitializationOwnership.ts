export type AudioInitializationOutcome = "committed" | "stale";

interface OwnedAudioInitializationActions {
  /** Install the new local stack and publish its loading state synchronously. */
  activate: () => void;
  /** The asynchronous initialization boundary whose completion may be stale. */
  initialize: () => Promise<void>;
  /** Bind the song and publish ready state for the still-current generation. */
  commit: () => void;
  /** Dispose only resources created by the obsolete generation. */
  cleanupStale: () => void;
}

/**
 * Monotonic ownership token for asynchronous audio-stack initialization.
 * Beginning a newer initialization or explicitly invalidating ownership makes
 * every older token permanently stale.
 */
export class AudioInitializationOwner {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }

  owns(generation: number): boolean {
    return generation === this.generation;
  }
}

export async function runOwnedAudioInitialization(
  owner: AudioInitializationOwner,
  actions: OwnedAudioInitializationActions,
): Promise<AudioInitializationOutcome> {
  const generation = owner.begin();
  actions.activate();

  try {
    await actions.initialize();
  } catch (error) {
    if (!owner.owns(generation)) {
      actions.cleanupStale();
      return "stale";
    }
    throw error;
  }

  if (!owner.owns(generation)) {
    actions.cleanupStale();
    return "stale";
  }

  actions.commit();
  return "committed";
}
