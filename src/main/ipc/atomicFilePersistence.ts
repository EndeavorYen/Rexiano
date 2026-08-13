import { randomUUID } from "crypto";
import {
  mkdir as mkdirFileSystem,
  rename as renameFileSystem,
  unlink as unlinkFileSystem,
  writeFile as writeFileSystem,
} from "fs/promises";
import { basename, dirname, resolve } from "path";

type WriteData = Parameters<typeof writeFileSystem>[1];

interface AtomicFileOperations {
  mkdir: typeof mkdirFileSystem;
  rename: typeof renameFileSystem;
  unlink: typeof unlinkFileSystem;
  writeFile: typeof writeFileSystem;
}

const defaultOperations: AtomicFileOperations = {
  mkdir: mkdirFileSystem,
  rename: renameFileSystem,
  unlink: unlinkFileSystem,
  writeFile: writeFileSystem,
};

const mutationQueues = new Map<string, Promise<void>>();

/**
 * Serialize every mutation touching the same absolute path. The queue is kept
 * in main-process memory so all IPC handlers share one ordering authority.
 */
export async function withFileMutationLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = resolve(filePath);
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const queued = previous.catch(() => undefined).then(() => gate);
  mutationQueues.set(key, queued);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (mutationQueues.get(key) === queued) {
      mutationQueues.delete(key);
    }
  }
}

/** Acquire several per-path queues in a stable order to avoid deadlocks. */
export async function withFileMutationLocks<T>(
  filePaths: readonly string[],
  operation: () => Promise<T>,
): Promise<T> {
  const paths = [
    ...new Set(filePaths.map((filePath) => resolve(filePath))),
  ].sort((a, b) => a.localeCompare(b));

  const acquire = async (index: number): Promise<T> => {
    if (index >= paths.length) return operation();
    return withFileMutationLock(paths[index], () => acquire(index + 1));
  };

  return acquire(0);
}

/**
 * Write beside the target, then atomically promote the complete file. A failed
 * stage or promotion removes only the temporary file and leaves the prior
 * target untouched.
 */
export async function writeFileAtomically(
  filePath: string,
  data: WriteData,
  operationOverrides: Partial<AtomicFileOperations> = {},
): Promise<void> {
  const operations = { ...defaultOperations, ...operationOverrides };
  const directory = dirname(filePath);
  const temporaryPath = resolve(
    directory,
    `.${basename(filePath)}.${randomUUID()}.tmp`,
  );

  await operations.mkdir(directory, { recursive: true });
  try {
    await operations.writeFile(temporaryPath, data, "utf-8");
    await operations.rename(temporaryPath, filePath);
  } catch (error) {
    await operations.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
