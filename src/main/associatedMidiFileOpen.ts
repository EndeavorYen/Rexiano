import { isAbsolute, win32 } from "path";

type Platform = NodeJS.Platform;

function isAbsoluteForPlatform(candidate: string, platform: Platform): boolean {
  return platform === "win32"
    ? win32.isAbsolute(candidate)
    : isAbsolute(candidate);
}

function isAssociatedMidiExtension(candidate: string): boolean {
  return /\.(mid|midi)$/i.test(candidate);
}

export function findAssociatedMidiArgument(
  argv: readonly string[],
  platform: Platform = process.platform,
): string | null {
  const candidates = argv.filter(
    (candidate) =>
      typeof candidate === "string" &&
      !candidate.startsWith("-") &&
      isAbsoluteForPlatform(candidate, platform) &&
      isAssociatedMidiExtension(candidate),
  );
  return candidates.at(-1) ?? null;
}

export type AssociatedMidiAuthorizer = (
  candidate: string,
) => Promise<string | null>;

/**
 * Main-owned queue for OS file-open requests. Validation is serialized so a
 * slow earlier realpath cannot overwrite a later user intent.
 */
export class AssociatedMidiFileOpenQueue {
  private pendingPath: string | null = null;
  private validationTail: Promise<void> = Promise.resolve();

  constructor(private readonly authorize: AssociatedMidiAuthorizer) {}

  enqueue(candidate: string): Promise<boolean> {
    const operation = this.validationTail.then(async () => {
      if (!isAssociatedMidiExtension(candidate)) return false;
      const canonical = await this.authorize(candidate);
      if (!canonical || canonical === this.pendingPath) return false;
      this.pendingPath = canonical;
      return true;
    });
    this.validationTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  take(): string | null {
    const pending = this.pendingPath;
    this.pendingPath = null;
    return pending;
  }
}
