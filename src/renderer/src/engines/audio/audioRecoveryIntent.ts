export type AudioRecoveryIntentOutcome = "applied" | "stale";

export interface PlaybackIntent {
  isPlaying: boolean;
  currentTime: number;
}

export interface AudioRecoveryRuntime {
  engine: {
    resume(): Promise<void>;
  };
  scheduler: {
    start(songTime: number): void;
    stop(): void;
    seek(songTime: number): void;
  };
}

interface RecoverLatestPlaybackIntentOptions<TSong> {
  targetSong: TSong;
  rebuild: (targetSong: TSong) => Promise<"committed" | "stale">;
  getCurrentSong: () => TSong | null;
  getPlaybackIntent: () => PlaybackIntent;
  getRuntime: () => AudioRecoveryRuntime | null;
}

function normalizedTime(currentTime: number): number {
  return Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
}

/**
 * Rebuild recovery uses the latest live transport intent as its authority.
 * No pre-await snapshot is replayed: pause, seek, and song changes made while
 * initialization is pending always win at commit time.
 */
export async function recoverLatestPlaybackIntent<TSong>({
  targetSong,
  rebuild,
  getCurrentSong,
  getPlaybackIntent,
  getRuntime,
}: RecoverLatestPlaybackIntentOptions<TSong>): Promise<AudioRecoveryIntentOutcome> {
  const outcome = await rebuild(targetSong);
  if (outcome === "stale") return "stale";

  const runtime = getRuntime();
  if (!runtime) {
    throw new Error("Recovered audio runtime is unavailable");
  }

  if (getCurrentSong() !== targetSong) {
    runtime.scheduler.stop();
    return "stale";
  }

  let intent = getPlaybackIntent();
  if (!intent.isPlaying) {
    runtime.scheduler.seek(normalizedTime(intent.currentTime));
    return "applied";
  }

  runtime.scheduler.start(normalizedTime(intent.currentTime));
  try {
    await runtime.engine.resume();
  } catch (error) {
    runtime.scheduler.stop();
    throw error;
  }

  if (getCurrentSong() !== targetSong) {
    runtime.scheduler.stop();
    return "stale";
  }

  intent = getPlaybackIntent();
  if (!intent.isPlaying) {
    runtime.scheduler.stop();
  }
  runtime.scheduler.seek(normalizedTime(intent.currentTime));
  return "applied";
}
