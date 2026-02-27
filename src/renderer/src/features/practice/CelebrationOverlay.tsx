import { useMemo } from "react";
import type { PracticeScore } from "@shared/types";
import { useProgressStore } from "../../stores/useProgressStore";
import {
  getTier,
  isNewRecord,
  type CelebrationTier,
} from "./celebrationUtils";

interface CelebrationOverlayProps {
  score: PracticeScore;
  visible: boolean;
  onPracticeAgain: () => void;
  onChooseSong: () => void;
  /** Song identifier used to look up previous best score for "New Record!" detection */
  songId?: string;
}

const tierConfig: Record<
  CelebrationTier,
  { title: string; subtitle: string; emoji: string }
> = {
  amazing: {
    title: "Amazing!",
    subtitle: "You nailed it!",
    emoji: "confetti",
  },
  great: {
    title: "Great job!",
    subtitle: "Keep it up!",
    emoji: "star",
  },
  encourage: {
    title: "Nice try!",
    subtitle: "Practice makes perfect",
    emoji: "sparkle",
  },
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

/**
 * Celebration screen shown when a practice session ends.
 * Uses pure CSS animations for particle effects — no PixiJS dependency.
 */
export function CelebrationOverlay({
  score,
  visible,
  onPracticeAgain,
  onChooseSong,
  songId,
}: CelebrationOverlayProps): React.JSX.Element {
  const tier = getTier(score.accuracy);
  const config = tierConfig[tier];
  const count = PARTICLE_COUNT[tier];

  const previousBest = useProgressStore((s) =>
    songId ? s.getBestScore(songId) : null,
  );
  const showNewRecord = isNewRecord(
    score.accuracy,
    score.totalNotes,
    songId,
    previousBest ? previousBest.score.accuracy : null,
  );

  // Regenerate particles when tier changes (count is derived from tier)
  const particles = useMemo(() => generateParticles(count, tier), [count, tier]);

  if (!visible) return <></>;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center celebration-backdrop"
      data-testid="celebration-overlay"
      data-tier={tier}
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

      {/* Content card */}
      <div
        className="relative z-10 flex flex-col items-center gap-5 px-10 py-8 rounded-3xl celebration-card"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Big emoji indicator */}
        <div className="text-5xl celebration-bounce" aria-hidden="true">
          {config.emoji === "confetti"
            ? "\uD83C\uDF89"
            : config.emoji === "star"
              ? "\u2B50"
              : "\u2728"}
        </div>

        {/* Title */}
        <h2
          className="text-3xl font-display font-bold celebration-title"
          style={{ color: "var(--color-accent)" }}
        >
          {config.title}
        </h2>
        <p
          className="text-sm font-body -mt-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          {config.subtitle}
        </p>

        {/* New Record indicator */}
        {showNewRecord && (
          <div
            className="font-display font-bold tracking-wide text-sm celebration-new-record"
            style={{ color: "var(--color-accent)" }}
            data-testid="celebration-new-record"
          >
            New Record!
          </div>
        )}

        {/* Score breakdown */}
        <div
          className="flex gap-6 mt-2 px-4 py-3 rounded-xl"
          style={{
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
          }}
        >
          <ScoreStat label="Accuracy" value={`${score.accuracy.toFixed(1)}%`} />
          <ScoreStat label="Hits" value={String(score.hitNotes)} />
          <ScoreStat label="Missed" value={String(score.missedNotes)} />
          <ScoreStat label="Best Streak" value={String(score.bestStreak)} />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onPracticeAgain}
            className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
            data-testid="celebration-again"
          >
            Practice Again
          </button>
          <button
            onClick={onChooseSong}
            className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer btn-ghost-themed"
            data-testid="celebration-choose-song"
          >
            Choose Song
          </button>
        </div>
      </div>
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
