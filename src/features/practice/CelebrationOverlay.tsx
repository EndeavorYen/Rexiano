import type { PracticeMode, PracticeScore } from "@shared/types";
import { useProgressStore } from "../../stores/useProgressStore";
import { useEffect, useRef, useState } from "react";
import type { BrowseRoute } from "../routing/useAppNavigation";
import { backLabelKey } from "../routing/browseRouteLabel";
import {
  getCelebrationActions,
  getCelebrationPresentation,
  getRecordBadge,
  getTier,
  isResultKeyGuardActive,
  nowMs,
  type CelebrationActionId,
  type CelebrationTier,
} from "./celebrationUtils";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import { getRetrySpeed, type NextPracticeAction } from "./nextPracticeAction";
import { StarRow } from "../progress/StarRow";
import { MAX_STARS, starsForAccuracy } from "../progress/stars";
import "./play-feedback.css";

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
  /** The next station on the lesson route; only offered after three stars */
  nextSongTitle?: string;
  onNextSong?: () => void;
  /** Where the song was started from: names the secondary button */
  browseRoute?: BrowseRoute;
}

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

const NEXT_ACTION_BODY_KEYS: Record<
  NextPracticeAction["kind"],
  TranslationKey
> = {
  "slow-down": "celebration.slowAdvice",
  "raise-speed": "celebration.nextAction.raiseSpeed.body",
  "repeat-once": "celebration.againAdvice",
  "next-song": "celebration.nextAction.nextSong.body",
};

/** Same "75%" form as the speed control. */
function formatSpeed(speed: number | undefined | null): string {
  if (speed === undefined || speed === null) return "";
  return `${Math.round(speed * 100)}%`;
}

/** Colour pieces for the three-star shower; plain CSS, no motion if reduced. */
const CONFETTI_PIECES = Array.from({ length: 16 }, (_, index) => index);

/**
 * One result card when a run ends: stars, one sentence, one next step.
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
  nextSongTitle,
  onNextSong,
  browseRoute = "menu",
}: CelebrationOverlayProps): React.JSX.Element {
  const { t } = useTranslation();
  const presentation = getCelebrationPresentation({
    mode,
    totalNotes: score.totalNotes,
  });
  const isListenThrough = presentation.variant === "listen";
  const tier = isListenThrough ? "great" : getTier(score.accuracy);
  const stars = starsForAccuracy(score.accuracy);

  // Frozen when the card opens: the run is saved a moment later and must not
  // turn into its own "previous best" while the card is on screen.
  const [previousBest] = useState(() =>
    songId ? useProgressStore.getState().getBestScore(songId) : null,
  );
  const previousAccuracy = previousBest ? previousBest.score.accuracy : null;
  const recordBadge = getRecordBadge(
    score.accuracy,
    score.totalNotes,
    songId,
    previousAccuracy,
  );

  // The replay button applies speed advice, so advice and button agree.
  const retrySpeed = isListenThrough ? null : getRetrySpeed(nextAction);

  const [advancing, setAdvancing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Keys held down at the end of a run must not press a button for the child.
  const openedAtRef = useRef(0);
  useEffect(() => {
    openedAtRef.current = nowMs();
  }, []);
  const keyGuardActive = (): boolean =>
    isResultKeyGuardActive(openedAtRef.current, nowMs());
  useDialogFocus({
    active: visible,
    containerRef: cardRef,
    initialFocusRef: primaryRef,
  });

  if (!visible) return <></>;

  const hasNextSong = Boolean(onNextSong && nextSongTitle);
  const actions = getCelebrationActions(presentation.variant, {
    stars,
    hasNextSong,
  }).filter((action) => action !== "try-wait" || onTryWait);

  const actionLabel = (action: CelebrationActionId): string => {
    if (action === "next-song") {
      return t("celebration.nextSong", { title: nextSongTitle ?? "" });
    }
    if (action === "try-wait") return t("celebration.listen.tryWait");
    if (action === "choose-song") return t(backLabelKey(browseRoute));
    if (isListenThrough) return t("celebration.listen.listenAgain");
    if (retrySpeed !== null && nextAction?.kind === "slow-down") {
      return t("celebration.slowAgain");
    }
    if (retrySpeed !== null) {
      // Three stars: the replay moves up a speed, so the button says which.
      return t("celebration.playAgainAtSpeed", {
        speed: formatSpeed(retrySpeed),
      });
    }
    return t("celebration.again");
  };
  const actionHandler = (action: CelebrationActionId): (() => void) => {
    if (action === "next-song") {
      return () => {
        setAdvancing(true);
        onNextSong?.();
      };
    }
    if (action === "try-wait") return () => onTryWait?.();
    if (action === "choose-song") return onChooseSong;
    return onPracticeAgain;
  };
  const actionTestId: Record<CelebrationActionId, string> = {
    "next-song": "celebration-next-song",
    "try-wait": "celebration-try-wait",
    "play-again": "celebration-again",
    "choose-song": "celebration-choose-song",
  };

  const [primaryAction, ...otherActions] = actions;
  const adviceApplies =
    nextAction &&
    !isListenThrough &&
    (nextAction.kind !== "next-song" || hasNextSong);
  const oneLiner = isListenThrough
    ? t("celebration.listen.subtitle")
    : adviceApplies
      ? t(NEXT_ACTION_BODY_KEYS[nextAction.kind], {
          speed: formatSpeed(nextAction.targetSpeed),
        })
      : t(TIER_SUBTITLE_KEYS[tier]);

  return (
    <div
      className="family-scrim play-result-scrim"
      data-testid="celebration-overlay"
      data-tier={tier}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        tabIndex={-1}
        className="family-sheet play-result"
        onKeyDownCapture={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            keyGuardActive()
          ) {
            event.preventDefault();
          }
        }}
      >
        {stars === 3 && !isListenThrough && (
          <div className="play-confetti" aria-hidden="true">
            {CONFETTI_PIECES.map((index) => (
              <span
                key={index}
                className="play-confetti-piece"
                style={
                  {
                    "--i": index,
                    // 7 and 16 share no factor: pieces that fall one after
                    // another land far apart across the card's width.
                    "--x": ((index * 7) % 16) * 6 + 4,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}

        {presentation.showScore && (
          <StarRow
            stars={stars}
            size={56}
            animate
            label={t("celebration.starRating", {
              filled: stars,
              total: MAX_STARS,
            })}
            className="play-result-stars"
          />
        )}

        <h2 id="celebration-title" className="play-result-title">
          {isListenThrough
            ? t("celebration.listen.title")
            : t(TIER_TITLE_KEYS[tier])}
        </h2>

        {presentation.showScore && recordBadge && (
          <p
            className="play-result-record"
            data-testid="celebration-new-record"
          >
            {recordBadge === "more-stars"
              ? t("celebration.moreStars")
              : t("celebration.better")}
          </p>
        )}

        <p
          className="play-result-line"
          data-testid={
            adviceApplies && !isListenThrough
              ? "celebration-next-action"
              : undefined
          }
        >
          {oneLiner}
        </p>

        {presentation.showScore && (
          <p className="play-result-count" data-testid="celebration-accuracy">
            {t("celebration.hitCount", {
              hit: score.hitNotes,
              total: score.totalNotes,
              accuracy: Math.round(score.accuracy),
            })}
          </p>
        )}

        <div className="play-result-actions">
          {primaryAction && (
            <button
              ref={primaryRef}
              type="button"
              onClick={(event) => {
                // detail 0 means a key pressed the button, not a pointer.
                if (event.detail === 0 && keyGuardActive()) return;
                actionHandler(primaryAction)();
              }}
              disabled={advancing}
              className="btn-primary-themed play-result-primary"
              data-testid={actionTestId[primaryAction]}
            >
              {actionLabel(primaryAction)}
            </button>
          )}
          <div className="play-result-secondary">
            {otherActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={actionHandler(action)}
                disabled={advancing}
                className="btn-ghost-themed play-result-ghost"
                data-testid={actionTestId[action]}
              >
                {actionLabel(action)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
