import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

const TAG_KEYS: Partial<Record<string, TranslationKey>> = {
  "two-hands": "library.tag.twoHands",
  beginner: "library.tag.beginner",
  exercise: "library.tag.exercise",
  scale: "library.tag.scale",
  "alberti-bass": "library.tag.albertiBass",
  american: "library.tag.american",
  arpeggiated: "library.tag.arpeggiated",
  baroque: "library.tag.baroque",
  christmas: "library.tag.christmas",
  classic: "library.tag.classic",
  classical: "library.tag.classical",
  dance: "library.tag.dance",
  duet: "library.tag.duet",
  english: "library.tag.english",
  fast: "library.tag.fast",
  folk: "library.tag.folk",
  french: "library.tag.french",
  holiday: "library.tag.holiday",
  lullaby: "library.tag.lullaby",
  lyrical: "library.tag.lyrical",
  melody: "library.tag.melody",
  popular: "library.tag.popular",
  romantic: "library.tag.romantic",
  sonatina: "library.tag.sonatina",
  traditional: "library.tag.traditional",
};

/**
 * Human label for a song tag slug from songs.json.
 *
 * `3-4` → `3/4`, `level-5` → "Level 5", `g-major` → "G major",
 * `c#-minor` → "C# minor". Every tag in songs.json has an en / zh-TW label;
 * an unknown slug falls back to "Words like this".
 */
export function formatSongTag(tag: string, t: Translate): string {
  const meter = /^(\d+)-(\d+)$/.exec(tag);
  if (meter) return `${meter[1]}/${meter[2]}`;

  const level = /^level-(\d+)$/.exec(tag);
  if (level) return t("library.tag.level", { level: level[1] });

  const key = /^([a-g]#?b?)-(major|minor)$/.exec(tag);
  if (key) {
    const tonic = key[1].charAt(0).toUpperCase() + key[1].slice(1);
    return t(key[2] === "major" ? "library.tag.major" : "library.tag.minor", {
      key: tonic,
    });
  }

  const known = TAG_KEYS[tag];
  if (known) return t(known);

  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Tags to show in a preview: no repeat of the category the card already shows. */
export function previewTags(tags: string[], category: string | null): string[] {
  return tags.filter((tag) => tag !== category);
}
