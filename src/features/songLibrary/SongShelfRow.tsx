import "./songbook.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";

type AsideMode = "side" | "below" | "none";
const ASIDE_MIN_WIDTH = 300;

export interface SongShelfRowProps {
  title: string;
  /** Small text after the title, e.g. "完成 2/5" */
  sub?: string;
  /** One quiet line under the title */
  description?: string;
  /** Bigger covers: the shelf the page is built around */
  featured?: boolean;
  /** A unit's color: a small dot before the title */
  dotColor?: string;
  /**
   * A card for the free space right of the covers. Shown beside them when
   * there is room, as a slim row under them when the covers fill the shelf
   * but leave too little, and not at all when the covers scroll.
   */
  aside?: React.ReactNode;
  testId?: string;
  children: React.ReactNode;
}

/**
 * One shelf: a title, two arrows, and a row of covers that scrolls sideways.
 * The row bleeds to the page edge so the next cover peeks in from the right.
 */
export function SongShelfRow({
  title,
  sub,
  description,
  featured = false,
  dotColor,
  aside,
  testId,
  children,
}: SongShelfRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const headingId = useId();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const [asideMode, setAsideMode] = useState<AsideMode>("side");

  const updateEdges = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const section = sectionRef.current;
    if (section) {
      const gutter = parseFloat(getComputedStyle(row).paddingLeft) || 0;
      const kids = Array.from(row.children) as HTMLElement[];
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const covers =
        kids.reduce((sum, kid) => sum + kid.offsetWidth, 0) +
        gap * Math.max(0, kids.length - 1);
      const free = section.clientWidth - gutter * 2 - covers - gap;
      setAsideMode(
        free >= ASIDE_MIN_WIDTH ? "side" : free >= -gap ? "below" : "none",
      );
    }
    setCanLeft(row.scrollLeft > 4);
    setCanRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => updateEdges());
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(() => updateEdges());
    observer.observe(row);
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [updateEdges, children, aside]);

  const scrollByPage = (direction: -1 | 1): void => {
    const row = rowRef.current;
    if (!row) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({
      left: direction * row.clientWidth * 0.85,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <section
      ref={sectionRef}
      className={featured ? "shelf is-featured" : "shelf"}
      aria-labelledby={headingId}
      data-testid={testId}
    >
      <div className="shelf-head">
        <div className="shelf-titles">
          <div className="shelf-title-line">
            {dotColor && (
              <span
                className="shelf-dot"
                style={{ background: dotColor }}
                aria-hidden="true"
              />
            )}
            <h2 id={headingId}>{title}</h2>
            {sub && <span className="sub">{sub}</span>}
          </div>
          {description && <p className="shelf-desc">{description}</p>}
        </div>
        <span className="spacer" />
        {/* a shelf that fits on screen has nothing to scroll: no arrows */}
        {(canLeft || canRight) && (
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("songbook.shelf.scrollLeft")}
              disabled={!canLeft}
              onClick={() => scrollByPage(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("songbook.shelf.scrollRight")}
              disabled={!canRight}
              onClick={() => scrollByPage(1)}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
      <div
        className={`shelf-body${aside && asideMode === "side" ? " has-side" : ""}`}
      >
        <div className="row" ref={rowRef} onScroll={updateEdges}>
          {children}
        </div>
        {aside && asideMode !== "none" && (
          <div className={`shelf-aside is-${asideMode}`}>{aside}</div>
        )}
      </div>
    </section>
  );
}
