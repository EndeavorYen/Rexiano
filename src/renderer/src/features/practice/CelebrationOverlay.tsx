/**
 * Phase 6: Celebration overlay — shown when a practice session ends.
 * Displays tier, accuracy, streak stats, star rating, and new-record badge.
 */
import { useMemo, useState, useEffect } from "react";
import type { PracticeScore, PracticeMode } from "@shared/types";
import { useProgressStore } from "../../stores/useProgressStore";
import { getTier, isNewRecord, type CelebrationTier } from "./celebrationUtils";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";

interface CelebrationOverlayProps {
  score: PracticeScore;
  visible: boolean;
  onPracticeAgain: () => void;
  onChooseSong: () => void;
  /** Called when user clicks the backdrop to dismiss early */
  onDismiss?: () => void;
  /** Song identifier used to look up previous best score for "New Record!" detection */
  songId?: string;
  /** Current practice mode — watch mode never shows "New Record!" */
  mode?: PracticeMode;
}

/** Emoji animation name per tier — not translated */
const TIER_EMOJIS: Record<CelebrationTier, string> = {
  amazing: "confetti",
  great: "star",
  encourage: "sparkle",
};

/** Translation keys for tier titles and subtitles */
const TIER_TITLE_KEYS: Record<CelebrationTier, TranslationKey> = {
  amazing: "celebration.amazing.title",
  great: "celebration.great.title",
  encourage: "celebration.encourage.title",
};

const TIER_SUBTITLE_KEYS: Record<CelebrationTier, TranslationKey> = {
  amazing: "celebration.amazing.subtitle",
  great: "celebration.great.subtitle",
  encourage: "celebration.encourage.subtitle",
};

/** Play-again button translation keys per tier */
const TIER_PLAY_AGAIN_KEYS: Record<CelebrationTier, TranslationKey> = {
  amazing: "celebration.playAgain",
  great: "celebration.oneMoreTime",
  encourage: "celebration.tryAgain",
};

/** Number of CSS particles to render for each tier */
const PARTICLE_COUNT = { amazing: 40, great: 24, encourage: 12 };

/** Simple seeded PRNG to keep particle generation deterministic per tier */
function seededRandom(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  hue: number;
  drift: number;
}

function generateParticles(count: number, tier: CelebrationTier): Particle[] {
  const rand = seededRandom(count * 7 + tier.length * 31);
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rand() * 100,
    delay: rand() * 1.2,
    duration: 1.6 + rand() * 1.4,
    size: tier === "amazing" ? 6 + rand() * 8 : 4 + rand() * 6,
    hue:
      tier === "amazing"
        ? rand() * 360
        : tier === "great"
          ? 40 + rand() * 30
          : 200 + rand() * 60,
    drift: (rand() - 0.5) * 80,
  }));
}

/** Convert accuracy to a 0-5 star rating */
function getStarCount(accuracy: number): number {
  if (accuracy >= 95) return 5;
  if (accuracy >= 85) return 4;
  if (accuracy >= 70) return 3;
  if (accuracy >= 50) return 2;
  return 1; // Always at least 1 star — keep it encouraging
}

/** Render star display */
function StarDisplay({ accuracy }: { accuracy: number }): React.JSX.Element {
  const { t } = useTranslation();
  const filled = getStarCount(accuracy);
  const total = 5;

  return (
    <div
      className="flex items-center gap-1"
      aria-label={t("celebration.starRating", {
        filled: String(filled),
        total: String(total),
      })}
    >
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        return (
          <span
            key={i}
            className="text-xl"
            style={{
              opacity: isFilled ? 1 : 0.2,
              filter: isFilled ? "none" : "grayscale(1)",
              animationDelay: `${0.5 + i * 0.1}s`,
              animation: isFilled
                ? `celebration-emoji-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.5 + i * 0.1}s both`
                : "none",
            }}
          >
            {"\u2B50"}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Celebration screen shown when a practice session ends.
 * Uses pure CSS animations for particle effects -- no PixiJS dependency.
 */
export function CelebrationOverlay({
  score,
  visible,
  onPracticeAgain,
  onChooseSong,
  onDismiss,
  songId,
  mode,
}: CelebrationOverlayProps): React.JSX.Element {
  const { t } = useTranslation();
  const tier = getTier(score.accuracy);
  const count = PARTICLE_COUNT[tier];

  const previousBest = useProgressStore((s) =>
    songId ? s.getBestScore(songId) : null,
  );
  const showNewRecord = isNewRecord(
    score.accuracy,
    score.totalNotes,
    songId,
    previousBest ? previousBest.score.accuracy : null,
    mode,
  );

  // Regenerate particles when tier changes (count is derived from tier)
  const particles = useMemo(
    () => generateParticles(count, tier),
    [count, tier],
  );

  // Show "tap to continue" hint after a 2-second delay
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setShowHint(true), 2000);
    return () => {
      clearTimeout(timer);
      setShowHint(false);
    };
  }, [visible]);

  if (!visible) return <></>;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center celebration-backdrop cursor-pointer"
      data-testid="celebration-overlay"
      data-tier={tier}
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss?.();
      }}
    >
      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <span
            key={p.id}
            className={`absolute celebration-particle ${tier === "amazing" ? "celebration-confetti" : tier === "great" ? "celebration-star" : "celebration-sparkle"}`}
            style={{
              left: `${p.left}%`,
              top: "-5%",
              width: p.size,
              height: tier === "amazing" ? p.size * 0.6 : p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              background:
                tier === "amazing"
                  ? `hsl(${p.hue}, 80%, 60%)`
                  : tier === "great"
                    ? `hsl(${p.hue}, 90%, 55%)`
                    : `hsl(${p.hue}, 60%, 70%)`,
              borderRadius: tier === "amazing" ? "1px" : "50%",
              ["--drift" as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Content card — stop propagation so button clicks don't dismiss */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 px-12 py-8 rounded-3xl celebration-card"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
          backdropFilter: "blur(16px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Big emoji indicator */}
        <div className="text-5xl celebration-bounce" aria-hidden="true">
          {TIER_EMOJIS[tier] === "confetti"
            ? "\uD83C\uDF89"
            : TIER_EMOJIS[tier] === "star"
              ? "\u2B50"
              : "\u2728"}
        </div>

        {/* Title */}
        <h2
          className="text-3xl font-display font-bold celebration-title"
          style={{ color: "var(--color-accent)" }}
        >
          {t(TIER_TITLE_KEYS[tier])}
        </h2>
        <p
          className="text-sm font-body -mt-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t(TIER_SUBTITLE_KEYS[tier])}
        </p>

        {/* Star display instead of raw accuracy number */}
        <StarDisplay accuracy={score.accuracy} />

        {/* New Record indicator */}
        {showNewRecord && (
          <div
            className="font-display font-bold tracking-wide text-sm celebration-new-record"
            style={{ color: "var(--color-accent)" }}
            data-testid="celebration-new-record"
          >
            {t("celebration.newRecord")}
          </div>
        )}

        {/* Score breakdown — compact and secondary */}
        <div
          className="flex gap-6 px-4 py-3 rounded-xl"
          style={{
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
          }}
        >
          <ScoreStat
            label={t("celebration.accuracy")}
            value={`${score.accuracy.toFixed(1)}%`}
          />
          <ScoreStat
            label={t("celebration.hits")}
            value={String(score.hitNotes)}
          />
          <ScoreStat
            label={t("celebration.missed")}
            value={String(score.missedNotes)}
          />
          <ScoreStat
            label={t("celebration.bestStreak")}
            value={String(score.bestStreak)}
          />
        </div>

        {/* Buttons with warmer wording */}
        <div className="flex gap-3 mt-1">
          <button
            onClick={onPracticeAgain}
            className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              boxShadow:
                "0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)",
            }}
            data-testid="celebration-again"
          >
            {t(TIER_PLAY_AGAIN_KEYS[tier])}
          </button>
          <button
            onClick={onChooseSong}
            className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer btn-ghost-themed"
            data-testid="celebration-choose-song"
          >
            {t("celebration.pickSong")}
          </button>
        </div>
      </div>

      {/* Delayed hint — fades in after 2 seconds */}
      <p
        className="absolute bottom-8 z-10 text-xs font-body pointer-events-none transition-opacity duration-700"
        style={{
          color: "var(--color-text-muted)",
          opacity: showHint ? 0.7 : 0,
        }}
      >
        {t("celebration.tapToContinue")}
      </p>
    </div>
  );
}

function ScoreStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-lg font-display font-bold tabular-nums"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-body uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
