import "./songbook.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";

export interface SongShelfRowProps {
  title: string;
  /** Small text after the title, e.g. "完成 2/5" */
  sub?: string;
  /** One quiet line under the title */
  description?: string;
  /** Bigger covers: the shelf the page is built around */
  featured?: boolean;
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
  testId,
  children,
}: SongShelfRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const headingId = useId();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setCanLeft(row.scrollLeft > 4);
    setCanRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(row);
    return () => observer.disconnect();
  }, [updateEdges, children]);

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
      className={featured ? "shelf is-featured" : "shelf"}
      aria-labelledby={headingId}
      data-testid={testId}
    >
      <div className="shelf-head">
        <div className="shelf-titles">
          <div className="shelf-title-line">
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
      <div className="row" ref={rowRef} onScroll={updateEdges}>
        {children}
      </div>
    </section>
  );
}
