import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { resolve } from "path";
import {
  withFileMutationLocks,
  writeFileAtomically,
} from "./atomicFilePersistence";

export type UserDataRendererSnapshot = Record<string, string | null>;

export interface UserDataFileTransactionChange {
  filePath: string;
  data: Buffer;
}

export interface UserDataFileTransactionOperations {
  readFile(path: string): Promise<Buffer>;
  unlink(path: string): Promise<void>;
  writeAtomically(path: string, data: Buffer | string): Promise<void>;
}

interface JournalTarget {
  filePath: string;
  existed: boolean;
  beforeBase64: string;
}

interface UserDataFileTransactionJournal {
  version: 1;
  transactionId: string;
  phase: "prepared" | "files-rolled-back" | "committed";
  rendererSnapshot: UserDataRendererSnapshot;
  targets: JournalTarget[];
}

export interface UserDataFileTransactionRecovery {
  transactionId: string;
  rendererSnapshot: UserDataRendererSnapshot;
}

const defaultOperations: UserDataFileTransactionOperations = {
  readFile: async (path) => readFile(path),
  unlink,
  writeAtomically: writeFileAtomically,
};

function operationsWith(
  overrides: Partial<UserDataFileTransactionOperations>,
): UserDataFileTransactionOperations {
  return { ...defaultOperations, ...overrides };
}

function isMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function validateRendererSnapshot(
  snapshot: UserDataRendererSnapshot,
): UserDataRendererSnapshot {
  const normalized: UserDataRendererSnapshot = {};
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    throw new Error("Renderer storage snapshot must be an object.");
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (!key || (typeof value !== "string" && value !== null)) {
      throw new Error("Renderer storage snapshot contains an invalid entry.");
    }
    normalized[key] = value;
  }
  return normalized;
}

function parseJournal(raw: Buffer): UserDataFileTransactionJournal {
  const parsed = JSON.parse(
    raw.toString("utf-8"),
  ) as Partial<UserDataFileTransactionJournal>;
  if (
    parsed.version !== 1 ||
    typeof parsed.transactionId !== "string" ||
    !["prepared", "files-rolled-back", "committed"].includes(
      parsed.phase ?? "",
    ) ||
    !Array.isArray(parsed.targets) ||
    typeof parsed.rendererSnapshot !== "object" ||
    parsed.rendererSnapshot === null
  ) {
    throw new Error("User-data transaction journal is invalid.");
  }

  const targets = parsed.targets.map((target) => {
    if (
      typeof target !== "object" ||
      target === null ||
      typeof target.filePath !== "string" ||
      typeof target.existed !== "boolean" ||
      typeof target.beforeBase64 !== "string"
    ) {
      throw new Error("User-data transaction journal target is invalid.");
    }
    return {
      filePath: resolve(target.filePath),
      existed: target.existed,
      beforeBase64: target.beforeBase64,
    };
  });

  return {
    version: 1,
    transactionId: parsed.transactionId,
    phase: parsed.phase as UserDataFileTransactionJournal["phase"],
    rendererSnapshot: validateRendererSnapshot(parsed.rendererSnapshot),
    targets,
  };
}

async function readJournal(
  journalPath: string,
  operations: UserDataFileTransactionOperations,
): Promise<UserDataFileTransactionJournal | null> {
  try {
    return parseJournal(await operations.readFile(journalPath));
  } catch (error) {
    if (isMissingError(error)) return null;
    throw error;
  }
}

async function removeIfPresent(
  path: string,
  operations: UserDataFileTransactionOperations,
): Promise<void> {
  try {
    await operations.unlink(path);
  } catch (error) {
    if (!isMissingError(error)) throw error;
  }
}

async function writeJournal(
  journalPath: string,
  journal: UserDataFileTransactionJournal,
  operations: UserDataFileTransactionOperations,
): Promise<void> {
  await operations.writeAtomically(
    journalPath,
    JSON.stringify(journal, null, 2),
  );
}

async function restoreTargets(
  targets: readonly JournalTarget[],
  operations: UserDataFileTransactionOperations,
): Promise<void> {
  for (const target of targets) {
    if (target.existed) {
      await operations.writeAtomically(
        target.filePath,
        Buffer.from(target.beforeBase64, "base64"),
      );
    } else {
      await removeIfPresent(target.filePath, operations);
    }
  }
}

export async function beginUserDataFileTransaction(
  journalPathInput: string,
  changesInput: readonly UserDataFileTransactionChange[],
  rendererSnapshotInput: UserDataRendererSnapshot,
  operationOverrides: Partial<UserDataFileTransactionOperations> = {},
): Promise<{ transactionId: string }> {
  const journalPath = resolve(journalPathInput);
  const rendererSnapshot = validateRendererSnapshot(rendererSnapshotInput);
  const changes = changesInput.map((change) => ({
    filePath: resolve(change.filePath),
    data: Buffer.from(change.data),
  }));
  if (changes.length === 0) {
    throw new Error(
      "A user-data file transaction requires at least one target.",
    );
  }
  if (
    new Set(changes.map((change) => change.filePath)).size !== changes.length
  ) {
    throw new Error("A user-data file transaction cannot repeat a target.");
  }

  const operations = operationsWith(operationOverrides);
  return withFileMutationLocks(
    [journalPath, ...changes.map((change) => change.filePath)],
    async () => {
      const pending = await readJournal(journalPath, operations);
      if (pending?.phase === "committed") {
        await removeIfPresent(journalPath, operations);
      } else if (pending) {
        throw new Error(
          "A pending user-data transaction must be recovered first.",
        );
      }

      const targets: JournalTarget[] = [];
      for (const change of changes) {
        try {
          const before = await operations.readFile(change.filePath);
          targets.push({
            filePath: change.filePath,
            existed: true,
            beforeBase64: before.toString("base64"),
          });
        } catch (error) {
          if (!isMissingError(error)) throw error;
          targets.push({
            filePath: change.filePath,
            existed: false,
            beforeBase64: "",
          });
        }
      }

      const journal: UserDataFileTransactionJournal = {
        version: 1,
        transactionId: randomUUID(),
        phase: "prepared",
        rendererSnapshot,
        targets,
      };
      await writeJournal(journalPath, journal, operations);

      try {
        for (const change of changes) {
          await operations.writeAtomically(change.filePath, change.data);
        }
      } catch (error) {
        try {
          await restoreTargets(targets, operations);
          await removeIfPresent(journalPath, operations);
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "User-data mutation failed and rollback is still pending.",
          );
        }
        throw error;
      }

      return { transactionId: journal.transactionId };
    },
  );
}

async function withCurrentJournal<T>(
  journalPathInput: string,
  operationOverrides: Partial<UserDataFileTransactionOperations>,
  operation: (
    journal: UserDataFileTransactionJournal,
    journalPath: string,
    operations: UserDataFileTransactionOperations,
  ) => Promise<T>,
): Promise<T | null> {
  const journalPath = resolve(journalPathInput);
  const operations = operationsWith(operationOverrides);
  const initial = await readJournal(journalPath, operations);
  if (!initial) return null;

  return withFileMutationLocks(
    [journalPath, ...initial.targets.map((target) => target.filePath)],
    async () => {
      const current = await readJournal(journalPath, operations);
      if (!current) return null;
      return operation(current, journalPath, operations);
    },
  );
}

export async function rollbackUserDataFileTransaction(
  journalPath: string,
  transactionId: string,
  operationOverrides: Partial<UserDataFileTransactionOperations> = {},
): Promise<UserDataFileTransactionRecovery | null> {
  return withCurrentJournal(
    journalPath,
    operationOverrides,
    async (journal, resolvedJournalPath, operations) => {
      if (journal.transactionId !== transactionId) {
        throw new Error("User-data transaction identifier does not match.");
      }
      if (journal.phase === "committed") return null;
      if (journal.phase === "prepared") {
        await restoreTargets(journal.targets, operations);
        journal.phase = "files-rolled-back";
        await writeJournal(resolvedJournalPath, journal, operations);
      }
      return {
        transactionId: journal.transactionId,
        rendererSnapshot: journal.rendererSnapshot,
      };
    },
  );
}

export async function recoverUserDataFileTransaction(
  journalPath: string,
  operationOverrides: Partial<UserDataFileTransactionOperations> = {},
): Promise<UserDataFileTransactionRecovery | null> {
  return withCurrentJournal(
    journalPath,
    operationOverrides,
    async (journal, resolvedJournalPath, operations) => {
      if (journal.phase === "committed") {
        await removeIfPresent(resolvedJournalPath, operations);
        return null;
      }
      if (journal.phase === "prepared") {
        await restoreTargets(journal.targets, operations);
        journal.phase = "files-rolled-back";
        await writeJournal(resolvedJournalPath, journal, operations);
      }
      return {
        transactionId: journal.transactionId,
        rendererSnapshot: journal.rendererSnapshot,
      };
    },
  );
}

export async function completeUserDataFileTransaction(
  journalPath: string,
  transactionId: string,
  operationOverrides: Partial<UserDataFileTransactionOperations> = {},
): Promise<boolean> {
  const result = await withCurrentJournal(
    journalPath,
    operationOverrides,
    async (journal, resolvedJournalPath, operations) => {
      if (journal.transactionId !== transactionId) return false;
      if (journal.phase === "prepared") {
        journal.phase = "committed";
        await writeJournal(resolvedJournalPath, journal, operations);
        // The committed marker is the durable decision. A failed best-effort
        // cleanup must not make the renderer roll its half back while the
        // files remain committed; the next recovery/begin removes it.
        await removeIfPresent(resolvedJournalPath, operations).catch(
          () => undefined,
        );
        return true;
      }
      await removeIfPresent(resolvedJournalPath, operations);
      return true;
    },
  );
  return result ?? false;
}
