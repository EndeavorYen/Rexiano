import { MAX_STARS, type StarCount } from "./stars";

export const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z";

interface StarRowProps {
  stars: StarCount;
  /** Star edge length in px */
  size?: number;
  /** Accessible label, e.g. "2 of 3 stars" */
  label: string;
  /** Pop each earned star in, one after another (result screens) */
  animate?: boolean;
  /**
   * With `animate`: seconds between one earned star and the next. The first
   * one then pops in at 0.35s (the result card). Left out, the stars pop in
   * quickly one after another (0.25s, 0.22s apart).
   */
  stagger?: number;
  className?: string;
}

/**
 * Earned stars are sun-yellow with a darker rim; unearned ones are an
 * outline, so the count reads without relying on color alone.
 */
export function StarRow({
  stars,
  size = 18,
  label,
  animate = false,
  stagger,
  className,
}: StarRowProps): React.JSX.Element {
  return (
    <span
      className={`star-row${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={label}
      data-stars={stars}
    >
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const earned = index < stars;
        return (
          <svg
            key={index}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={
              earned
                ? `star-row-star is-earned${animate ? " is-animated" : ""}`
                : "star-row-star"
            }
            style={
              animate && earned
                ? {
                    animationDelay: `${
                      stagger === undefined
                        ? 0.25 + index * 0.22
                        : 0.35 + index * stagger
                    }s`,
                  }
                : undefined
            }
          >
            <path d={STAR_PATH} strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}
