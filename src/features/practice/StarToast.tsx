import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import { STAR_PATH } from "../progress/StarRow";
import type { StarCount } from "../progress/stars";
import { nextStarCelebration } from "./scoreHud";
import { useScoreHud } from "./useScoreHud";
import "./play-feedback.css";

/** The big star is this wide; the HUD star it flies to is 28. */
export const STAR_TOAST_SIZE = 96;
/** Rest ~0.9 s in the middle, then fly to the HUD: 1.3 s in all. */
export const STAR_TOAST_MS = 1300;
export const STAR_TOAST_REDUCED_MS = 600;
/** Where the star sits in the falling-notes panel: share of its height. */
export const STAR_TOAST_TOP_SHARE = 0.15;

const TOAST_KEYS: Record<StarCount, TranslationKey | null> = {
  0: null,
  1: "practice.starToast1",
  2: "practice.starToast2",
  3: "practice.starToast3",
};

interface ToastState {
  id: number;
  star: StarCount;
  /** Viewport px of the star's centre */
  left: number;
  top: number;
}

/**
 * Keyframes for the fly-away: the toast is measured against the HUD star it
 * lands on. Exported for tests; the values are plain numbers.
 */
export function buildToastKeyframes(
  fly: { dx: number; dy: number; scale: number } | null,
  reduced: boolean,
): Keyframe[] {
  if (reduced || !fly) {
    return [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, offset: 0.75 },
      { opacity: 0, offset: 1 },
    ];
  }
  const base = `translate(-50%, -${STAR_TOAST_SIZE / 2}px)`;
  return [
    { opacity: 0, transform: `${base} scale(0.4)`, offset: 0 },
    { opacity: 1, transform: `${base} scale(1.12)`, offset: 0.1 },
    { opacity: 1, transform: `${base} scale(1)`, offset: 0.18 },
    { opacity: 1, transform: `${base} scale(1)`, offset: 0.69 },
    {
      opacity: 1,
      transform: `translate(calc(-50% + ${fly.dx}px), calc(-${STAR_TOAST_SIZE / 2}px + ${fly.dy}px)) scale(${fly.scale})`,
      offset: 0.97,
    },
    {
      opacity: 0,
      transform: `translate(calc(-50% + ${fly.dx}px), calc(-${STAR_TOAST_SIZE / 2}px + ${fly.dy}px)) scale(${fly.scale})`,
      offset: 1,
    },
  ];
}

/**
 * The moment a new star is earned, where the child is looking: a big star
 * over the top of the falling notes with one line of words. It then shrinks
 * and flies to its place in the HUD. It is drawn in a portal on the page so
 * the stage's clipping never cuts the flight, and it never takes a click.
 */
export function StarToast(): React.JSX.Element | null {
  const { t } = useTranslation();
  const hud = useScoreHud();
  const stars = hud?.stars ?? 0;
  const played = hud?.played ?? 0;

  const celebrated = useRef<StarCount>(0);
  const nextId = useRef(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const step = nextStarCelebration(celebrated.current, stars, played);
    celebrated.current = step.celebrated;
    if (step.announce === null) return;
    const panel = document.querySelector<HTMLElement>(
      '[data-testid="falling-notes-panel"]',
    );
    const rect = panel?.getBoundingClientRect();
    if (!rect) return;
    nextId.current += 1;
    setToast({
      id: nextId.current,
      star: step.announce,
      left: rect.left + rect.width / 2,
      // The star's centre: 15% down, plus half the star.
      top: rect.top + rect.height * STAR_TOAST_TOP_SHARE + STAR_TOAST_SIZE / 2,
    });
  }, [stars, played]);

  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!toast || !el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const target = document.querySelector<SVGElement>(
      `[data-testid="score-hud"] .star-row-star:nth-child(${toast.star})`,
    );
    const rect = target?.getBoundingClientRect();
    const fly =
      rect && rect.width > 0
        ? {
            dx: rect.left + rect.width / 2 - toast.left,
            dy: rect.top + rect.height / 2 - toast.top,
            scale: rect.width / STAR_TOAST_SIZE,
          }
        : null;
    const duration = reduced ? STAR_TOAST_REDUCED_MS : STAR_TOAST_MS;
    const animation = el.animate?.(buildToastKeyframes(fly, !!reduced), {
      duration,
      easing: "ease-in-out",
      fill: "both",
    });
    const done = window.setTimeout(() => setToast(null), duration + 40);
    return () => {
      window.clearTimeout(done);
      animation?.cancel();
    };
  }, [toast]);

  const key = toast ? TOAST_KEYS[toast.star] : null;
  if (!toast || !key) return null;

  return createPortal(
    <div
      key={toast.id}
      ref={ref}
      className="play-star-toast"
      data-testid="star-toast"
      data-star={toast.star}
      style={{ left: toast.left, top: toast.top }}
      aria-hidden="true"
    >
      <svg
        width={STAR_TOAST_SIZE}
        height={STAR_TOAST_SIZE}
        viewBox="0 0 24 24"
        className="star-row-star is-earned play-star-toast-star"
      >
        <path d={STAR_PATH} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span className="play-star-toast-text">{t(key)}</span>
    </div>,
    document.body,
  );
}
