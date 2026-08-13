import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  withFileMutationLock,
  writeFileAtomically,
} from "./atomicFilePersistence";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rexiano-atomic-file-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("atomic file persistence", () => {
  test("serializes delayed read-modify-write operations for one path", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "progress.json");
    await writeFile(filePath, "[]", "utf-8");

    await Promise.all(
      Array.from({ length: 20 }, (_, id) =>
        withFileMutationLock(filePath, async () => {
          const records = JSON.parse(
            await readFile(filePath, "utf-8"),
          ) as number[];
          await new Promise((resolve) => setTimeout(resolve, id % 3));
          records.push(id);
          await writeFileAtomically(filePath, JSON.stringify(records));
        }),
      ),
    );

    expect(JSON.parse(await readFile(filePath, "utf-8"))).toEqual(
      Array.from({ length: 20 }, (_, id) => id),
    );
  });

  test("keeps the last valid target when atomic promotion fails", async () => {
    const dir = await makeTempDir();
    const filePath = join(dir, "recents.json");
    const original = JSON.stringify([{ path: "/old.mid" }]);
    await writeFile(filePath, original, "utf-8");
    const rename = vi.fn(async () => {
      throw new Error("injected rename failure");
    });

    await expect(
      writeFileAtomically(filePath, JSON.stringify([{ path: "/new.mid" }]), {
        rename,
      }),
    ).rejects.toThrow("injected rename failure");

    expect(await readFile(filePath, "utf-8")).toBe(original);
    expect(rename).toHaveBeenCalledTimes(1);
  });
});
