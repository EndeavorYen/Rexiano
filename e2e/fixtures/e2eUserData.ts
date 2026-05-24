import { join } from "path";

interface E2eUserDataPathInput {
  outputDir: string;
  projectName: string;
  workerIndex: number;
  testId: string;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default"
  );
}

export function createE2eUserDataPath({
  outputDir,
  projectName,
  workerIndex,
  testId,
}: E2eUserDataPathInput): string {
  return join(
    outputDir,
    "electron-user-data",
    slug(projectName),
    `worker-${workerIndex}`,
    slug(testId),
  );
}
