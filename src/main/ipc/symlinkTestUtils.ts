import { mkdtempSync, rmSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/** True when this process may create symlinks. False only on EPERM/EACCES; other errors throw. */
export function canCreateSymlinks(): boolean {
  const dir = mkdtempSync(join(tmpdir(), "rexiano-symlink-probe-"));
  let allowed = true;
  try {
    symlinkSync(dir, join(dir, "link"));
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code === "EPERM" || code === "EACCES") {
      allowed = false;
    } else {
      throw error;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return allowed;
}
