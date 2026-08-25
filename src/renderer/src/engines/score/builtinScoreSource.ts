export function builtinScoreFileName(songId: string): string {
  return `${songId}.musicxml`;
}

export function resolveBuiltinSongSource(args: {
  songId: string;
  scorePresent: boolean;
}): "score" | "midi" {
  void args.songId;
  return args.scorePresent ? "score" : "midi";
}
