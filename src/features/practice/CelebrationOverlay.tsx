import type { PracticeMode, PracticeScore } from "@shared/types";
import { useProgressStore } from "../../stores/useProgressStore";
import { useRef } from "react";
import {
  getCelebrationActions,
  getCelebrationPresentation,
  getTier,
  isNewRecord,
  type CelebrationActionId,
  type CelebrationTier,
} from "./celebrationUtils";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import { getRetrySpeed, type NextPracticeAction } from "./nextPracticeAction";

interface CelebrationOverlayProps {
  score: PracticeScore;
  visible: boolean;
  onPracticeAgain: () => void;
  onChooseSong: () => void;
  /** Replay the same song in Wait mode (the advice after a Watch run) */
  onTryWait?: () => void;
  /** Song identifier used to look up previous best score for "New Record!" detection */
  songId?: string;
  nextAction?: NextPracticeAction;
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

const NEXT_ACTION_TITLE_KEYS: Record<
  NextPracticeAction["kind"],
  TranslationKey
> = {
  "slow-down": "celebration.nextAction.slowDown.title",
  "raise-speed": "celebration.nextAction.raiseSpeed.title",
  "repeat-once": "celebration.nextAction.repeatOnce.title",
  "next-song": "celebration.nextAction.nextSong.title",
};

const NEXT_ACTION_BODY_KEYS: Record<
  NextPracticeAction["kind"],
  TranslationKey
> = {
  "slow-down": "celebration.nextAction.slowDown.body",
  "raise-speed": "celebration.nextAction.raiseSpeed.body",
  "repeat-once": "celebration.nextAction.repeatOnce.body",
  "next-song": "celebration.nextAction.nextSong.body",
};

/** Convert accuracy to a 0-5 star rating */
function getStarCount(accuracy: number): number {
  if (accuracy >= 95) return 5;
  if (accuracy >= 85) return 4;
  if (accuracy >= 70) return 3;
  if (accuracy >= 50) return 2;
  if (accuracy >= 25) return 1;
  return 1; // Always at least 1 star — keep it encouraging
}

/** Same "75%" form as the speed control. */
function formatSpeed(speed: number | undefined | null): string {
  if (speed === undefined || speed === null) return "";
  return `${Math.round(speed * 100)}%`;
}

/** Render star display */
function StarDisplay({ accuracy }: { accuracy: number }): React.JSX.Element {
  const { t } = useTranslation();
  const filled = getStarCount(accuracy);
  const total = 5;

  return (
    <div
      className="flex items-center gap-1"
      aria-label={t("celebration.starRating", { filled, total })}
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
 * One score card shown when a practice session ends.
 */
export function CelebrationOverlay({
  score,
  visible,
  onPracticeAgain,
  onChooseSong,
  onTryWait,
  songId,
  nextAction,
  mode = "wait",
}: CelebrationOverlayProps): React.JSX.Element {
  const { t } = useTranslation();
  const presentation = getCelebrationPresentation({
    mode,
    totalNotes: score.totalNotes,
  });
  const isListenThrough = presentation.variant === "listen";
  const tier = isListenThrough ? "great" : getTier(score.accuracy);

  const previousBest = useProgressStore((s) =>
    songId ? s.getBestScore(songId) : null,
  );
  const showNewRecord = isNewRecord(
    score.accuracy,
    score.totalNotes,
    songId,
    previousBest ? previousBest.score.accuracy : null,
  );

  // The replay button applies speed advice, so advice and button agree.
  const retrySpeed = isListenThrough ? null : getRetrySpeed(nextAction);

  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({
    active: visible,
    containerRef: cardRef,
    initialFocusRef: primaryRef,
  });

  if (!visible) return <></>;

  const actions = getCelebrationActions(presentation.variant).filter(
    (action) => action !== "try-wait" || onTryWait,
  );
  const actionLabel = (action: CelebrationActionId): string => {
    if (action === "try-wait") return t("celebration.listen.tryWait");
    if (action === "choose-song") return t("celebration.pickSong");
    if (isListenThrough) return t("celebration.listen.listenAgain");
    return retrySpeed !== null
      ? t("celebration.playAgainAtSpeed", { speed: formatSpeed(retrySpeed) })
      : t(TIER_PLAY_AGAIN_KEYS[tier]);
  };
  const actionHandler = (action: CelebrationActionId): (() => void) => {
    if (action === "try-wait") return () => onTryWait?.();
    if (action === "choose-song") return onChooseSong;
    return onPracticeAgain;
  };
  const actionTestId: Record<CelebrationActionId, string> = {
    "try-wait": "celebration-try-wait",
    "play-again": "celebration-again",
    "choose-song": "celebration-choose-song",
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center celebration-backdrop"
      data-testid="celebration-overlay"
      data-tier={tier}
    >
      {/* Content card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        tabIndex={-1}
        className="relative z-10 flex flex-col items-center gap-4 px-12 py-8 rounded-3xl celebration-card"
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
          {TIER_EMOJIS[tier] === "confetti"
            ? "\uD83C\uDF89"
            : TIER_EMOJIS[tier] === "star"
              ? "\u2B50"
              : "\u2728"}
        </div>

        {/* Title */}
        <h2
          id="celebration-title"
          className="text-3xl font-display font-bold celebration-title"
          style={{ color: "var(--color-accent-text)" }}
        >
          {isListenThrough
            ? t("celebration.listen.title")
            : t(TIER_TITLE_KEYS[tier])}
        </h2>
        <p
          className="text-sm font-body -mt-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {isListenThrough
            ? t("celebration.listen.subtitle")
            : t(TIER_SUBTITLE_KEYS[tier])}
        </p>

        {/* Star display instead of raw accuracy number */}
        {presentation.showScore && <StarDisplay accuracy={score.accuracy} />}

        {/* New Record indicator */}
        {showNewRecord && (
          <div
            className="font-display font-bold tracking-wide text-sm celebration-new-record"
            style={{ color: "var(--color-accent-text)" }}
            data-testid="celebration-new-record"
          >
            {t("celebration.newRecord")}
          </div>
        )}

        {/* One accuracy number (#242); hits / misses / streak stay off */}
        {presentation.showScore && (
          <p
            className="font-display text-lg font-bold tabular-nums"
            style={{ color: "var(--color-text)" }}
            data-testid="celebration-accuracy"
          >
            {t("celebration.accuracy")} {`${score.accuracy.toFixed(0)}%`}
          </p>
        )}

        {nextAction && !isListenThrough && (
          <div
            className="w-full rounded-xl px-4 py-3 text-left"
            style={{
              background:
                "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-alt))",
              border:
                "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
            }}
            data-testid="celebration-next-action"
          >
            <span
              className="text-[10px] font-body font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("celebration.nextAction.label")}
            </span>
            <p
              className="mt-1 text-sm font-display font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {t(NEXT_ACTION_TITLE_KEYS[nextAction.kind])}
            </p>
            <p
              className="mt-0.5 text-xs font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t(NEXT_ACTION_BODY_KEYS[nextAction.kind], {
                speed: formatSpeed(nextAction.targetSpeed),
              })}
            </p>
          </div>
        )}

        {/* Primary action first; the rest are quieter */}
        <div className="flex flex-wrap justify-center gap-3 mt-1">
          {actions.map((action, index) =>
            index === 0 ? (
              <button
                key={action}
                ref={primaryRef}
                type="button"
                onClick={actionHandler(action)}
                className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-on-accent)",
                  boxShadow:
                    "0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)",
                }}
                data-testid={actionTestId[action]}
              >
                {actionLabel(action)}
              </button>
            ) : (
              <button
                key={action}
                type="button"
                onClick={actionHandler(action)}
                className="px-6 py-2.5 text-sm font-display font-bold rounded-xl cursor-pointer btn-ghost-themed"
                data-testid={actionTestId[action]}
              >
                {actionLabel(action)}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
