export interface E2eFixtureAccessOptions {
  isE2eTestMode: boolean;
}

export function shouldExposeE2eFixtures({
  isE2eTestMode,
}: E2eFixtureAccessOptions): boolean {
  return isE2eTestMode;
}
