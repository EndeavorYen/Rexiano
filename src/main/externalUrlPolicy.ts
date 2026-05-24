export function normalizeExternalUrl(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;

  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
