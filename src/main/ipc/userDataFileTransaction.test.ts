import { access, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, test } from "vitest";
import { writeFileAtomically } from "./atomicFilePersistence";
import {
  beginUserDataFileTransaction,
  completeUserDataFileTransaction,
  recoverUserDataFileTransaction,
  type UserDataFileTransactionOperations,
} from "./userDataFileTransaction";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rexiano-user-data-txn-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function missing(path: string): Promise<boolean> {
  return access(path).then(
    () => false,
    () => true,
  );
}

describe("user-data file transaction", () => {
  test.each([1, 2, 3])(
    "rolls every target back byte-for-byte when promotion stage %i fails",
    async (failureStage) => {
      const dir = await makeTempDir();
      const journalPath = join(dir, "transaction.json");
      const progressPath = join(dir, "progress.json");
      const recentsPath = join(dir, "recents.json");
      const oldProgress = Buffer.from('[\n  {"id":"old"}\n]\n');
      const oldRecents = Buffer.from('[{"path":"/old.mid"}]');
      await writeFile(progressPath, oldProgress);
      await writeFile(recentsPath, oldRecents);
      let promotions = 0;
      const operations: Partial<UserDataFileTransactionOperations> = {
        writeAtomically: async (path, data) => {
          promotions += 1;
          if (promotions === failureStage) {
            throw new Error(`injected promotion failure ${failureStage}`);
          }
          await writeFileAtomically(path, data);
        },
      };

      await expect(
        beginUserDataFileTransaction(
          journalPath,
          [
            { filePath: progressPath, data: Buffer.from("[]") },
            { filePath: recentsPath, data: Buffer.from("[]") },
          ],
          {},
          operations,
        ),
      ).rejects.toThrow(`injected promotion failure ${failureStage}`);

      expect(await readFile(progressPath)).toEqual(oldProgress);
      expect(await readFile(recentsPath)).toEqual(oldRecents);
      expect(await missing(journalPath)).toBe(true);
    },
  );

  test("recovers an interrupted renderer transaction after restart", async () => {
    const dir = await makeTempDir();
    const journalPath = join(dir, "transaction.json");
    const progressPath = join(dir, "progress.json");
    const oldProgress = Buffer.from('[{"id":"old"}]');
    await writeFile(progressPath, oldProgress);

    const begun = await beginUserDataFileTransaction(
      journalPath,
      [{ filePath: progressPath, data: Buffer.from('[{"id":"new"}]') }],
      { "rexiano-settings": '{"volume":72}' },
    );
    expect(await readFile(progressPath, "utf-8")).toContain("new");

    const recovery = await recoverUserDataFileTransaction(journalPath);
    expect(recovery).toEqual({
      transactionId: begun.transactionId,
      rendererSnapshot: { "rexiano-settings": '{"volume":72}' },
    });
    expect(await readFile(progressPath)).toEqual(oldProgress);

    await completeUserDataFileTransaction(journalPath, begun.transactionId);
    expect(await missing(journalPath)).toBe(true);
  });

  test("removes a newly created target when rolling back", async () => {
    const dir = await makeTempDir();
    const journalPath = join(dir, "transaction.json");
    const progressPath = join(dir, "progress.json");

    const begun = await beginUserDataFileTransaction(
      journalPath,
      [{ filePath: progressPath, data: Buffer.from("[]") }],
      { "rexiano-settings": null },
    );
    await recoverUserDataFileTransaction(journalPath);

    expect(await missing(progressPath)).toBe(true);
    await completeUserDataFileTransaction(journalPath, begun.transactionId);
  });
});
