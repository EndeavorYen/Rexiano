import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Play } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { StarRow } from "../progress/StarRow";
import { SongCoverArt } from "../songLibrary/SongCoverArt";
import { lessonGroupColor } from "../songLibrary/lessonGroupColor";
import { songDisplayTitle } from "../songLibrary/songTitle";
import type { TranslationKey } from "@renderer/i18n/types";
import {
  isRoadWalked,
  type AdventureMapModel,
  type MapStation,
} from "./adventureMap";
import { layoutRoute, rowAnchorTop, segmentPath } from "./routeLayout";
import "./home-map.css";

interface AdventureMapProps {
  model: AdventureMapModel;
  /** The scrolling ancestor; the map moves it to bring stations into view */
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** Where the unit chip row goes: the fixed area above the scroller */
  chipsHost: HTMLElement | null;
  /** Buttons that sit at the right end of the unit chip row */
  toolbar?: React.ReactNode;
  loadingSongId?: string | null;
  onPlay: (songId: string) => void;
}

/** Gap between the fixed area and the upper edge of the next stop's row */
const ARRIVAL_GAP = 24;
/** Half the card width plus a margin, so the card stays inside the map */
const CARD_HALF = 162;
/** The larger first-visit card */
const CARD_HALF_FIRST = 186;
const WIDE_QUERY = "(min-width: 900px)";

function useRouteColumns(): number {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" || !window.matchMedia
      ? true
      : window.matchMedia(WIDE_QUERY).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = (): void => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide ? 4 : 3;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Scroll `scroller` so the top of `target` sits `gap` px below the scroller's top. */
function scrollToEdge(
  scroller: HTMLElement,
  target: HTMLElement,
  gap: number,
  smooth: boolean,
): void {
  const offset =
    target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollTo({
    top: Math.max(0, Math.round(scroller.scrollTop + offset - gap)),
    behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
  });
}

export function AdventureMap({
  model,
  scrollerRef,
  chipsHost,
  toolbar,
  loadingSongId = null,
  onPlay,
}: AdventureMapProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const cols = useRouteColumns();
  const mapRef = useRef<HTMLDivElement>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const focusCardRef = useRef(false);
  const anchorRef = useRef<{ id: string; top: number } | null>(null);
  // True once the child has scrolled or tapped: from then on nothing moves the page.
  const settledRef = useRef(false);
  const pendingAlignRef = useRef(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Bumps on every tap, so tapping the already-open station still moves focus.
  const [tapCount, setTapCount] = useState(0);

  const stationsById = useMemo(
    () => new Map(model.stations.map((s) => [s.song.id, s])),
    [model.stations],
  );
  const selected: MapStation | null =
    (pickedId ? stationsById.get(pickedId) : undefined) ??
    model.nextStation ??
    null;

  const regionSizes = useMemo(
    () => model.regions.map((r) => r.stations.length),
    [model.regions],
  );
  const baseLayout = useMemo(
    () => layoutRoute({ regionSizes, cols }),
    [regionSizes, cols],
  );
  const selectedRow = selected
    ? (baseLayout.stations[selected.index]?.row ?? null)
    : null;
  const layout = useMemo(
    () => layoutRoute({ regionSizes, cols, openCardRow: selectedRow }),
    [regionSizes, cols, selectedRow],
  );

  const paths = useMemo(() => {
    return model.stations.slice(1).map((station, i) => ({
      key: station.song.id,
      d: segmentPath(layout.stations[i], layout.stations[i + 1], layout.cols),
      walked: isRoadWalked(model.stations[i], station),
      color: lessonGroupColor(station.groupId),
    }));
  }, [model.stations, layout]);

  // The next stop's row: where every arrival and every "back to next" lands.
  const hasStations = model.stations.length > 0;
  const nextId = model.nextStation?.song.id ?? null;
  const nextIndex = model.nextStation?.index ?? null;
  const unitStartOf = useMemo(() => {
    if (nextIndex === null) return null;
    const i = model.regions.findIndex((r) => r.firstIndex === nextIndex);
    return i < 0 ? null : i;
  }, [model.regions, nextIndex]);

  const layoutRef = useRef(layout);
  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const alignToNext = useCallback(
    (smooth: boolean) => {
      const scroller = scrollerRef.current;
      const map = mapRef.current;
      if (!scroller || !map || nextIndex === null) return;
      let top = 0;
      if (unitStartOf !== 0) {
        const mapTop =
          map.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
        top =
          mapTop +
          rowAnchorTop(layoutRef.current, nextIndex, unitStartOf) -
          ARRIVAL_GAP;
      }
      scroller.scrollTo({
        top: Math.max(0, Math.round(top)),
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
    },
    [nextIndex, scrollerRef, unitStartOf],
  );

  // Arrival: align before the first paint, then again whenever the layout
  // moves (fonts, late data, window size) until the child takes over.
  useLayoutEffect(() => {
    if (!hasStations || nextIndex === null) return;
    settledRef.current = false;
    alignToNext(false);
  }, [hasStations, nextIndex, alignToNext]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const map = mapRef.current;
    if (!scroller || !map || !hasStations || nextIndex === null) return;
    const realign = (): void => {
      if (!settledRef.current) alignToNext(false);
    };
    const settle = (): void => {
      settledRef.current = true;
    };
    void document.fonts?.ready.then(realign);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(realign);
    observer?.observe(map);
    observer?.observe(scroller);
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((name) =>
      scroller.addEventListener(name, settle, { passive: true }),
    );
    return () => {
      observer?.disconnect();
      events.forEach((name) => scroller.removeEventListener(name, settle));
    };
  }, [hasStations, nextIndex, alignToNext, scrollerRef]);

  // "Back to next stop": shown while the next stop is out of view.
  const [backDirection, setBackDirection] = useState<"up" | "down" | null>(
    null,
  );
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !nextId) return;
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const node = mapRef.current?.querySelector<HTMLElement>(
        `[data-station-id="${CSS.escape(nextId)}"]`,
      );
      if (!node) return;
      const view = scroller.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const centre = box.top + box.height / 2;
      setBackDirection(
        centre < view.top ? "up" : centre > view.bottom ? "down" : null,
      );
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(scroller);
    if (mapRef.current) observer?.observe(mapRef.current);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      observer?.disconnect();
    };
  }, [nextId, scrollerRef]);

  const backToNext = useCallback(() => {
    settledRef.current = true;
    pendingAlignRef.current = true;
    focusCardRef.current = false;
    anchorRef.current = null;
    setPickedId(null);
    setTapCount((n) => n + 1);
  }, []);

  const handleSelect = useCallback((songId: string) => {
    const button = mapRef.current?.querySelector<HTMLElement>(
      `[data-station-id="${CSS.escape(songId)}"]`,
    );
    // Remember where the clicked station is: closing another card moves rows.
    anchorRef.current = button
      ? { id: songId, top: button.getBoundingClientRect().top }
      : null;
    settledRef.current = true;
    focusCardRef.current = true;
    setPickedId(songId);
    setTapCount((n) => n + 1);
  }, []);

  // Keep the clicked station under the pointer, then bring the card in view.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const anchor = anchorRef.current;
    if (scroller && anchor) {
      const button = mapRef.current?.querySelector<HTMLElement>(
        `[data-station-id="${CSS.escape(anchor.id)}"]`,
      );
      if (button) {
        scroller.scrollTop += button.getBoundingClientRect().top - anchor.top;
      }
    }
    anchorRef.current = null;
    if (pendingAlignRef.current) {
      pendingAlignRef.current = false;
      alignToNext(true);
    }
    if (focusCardRef.current) {
      focusCardRef.current = false;
      const card = cardButtonRef.current;
      if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selected?.song.id, tapCount, scrollerRef, alignToNext]);

  const jumpToRegion = useCallback(
    (groupId: string) => {
      const scroller = scrollerRef.current;
      const flag = mapRef.current?.querySelector<HTMLElement>(
        `[data-region-flag="${groupId}"]`,
      );
      if (scroller && flag) {
        settledRef.current = true;
        scrollToEdge(scroller, flag, ARRIVAL_GAP, true);
      }
    },
    [scrollerRef],
  );

  const currentGroupId = model.nextStation?.groupId ?? null;

  const chips = (
    <nav className="hm-units-row" aria-label={t("map.unitsLabel")}>
      <div className="hm-units">
        {model.regions.map((region) => (
          <button
            key={region.groupId}
            type="button"
            className={`hm-unit-chip${region.groupId === currentGroupId ? " is-here" : ""}`}
            style={
              {
                "--z": lessonGroupColor(region.groupId),
              } as React.CSSProperties
            }
            aria-current={region.groupId === currentGroupId || undefined}
            data-testid={`map-unit-${region.groupId}`}
            onClick={() => jumpToRegion(region.groupId)}
          >
            <i aria-hidden="true" />
            {t(region.group.titleKey)}
            <b>
              {region.completedCount}/{region.totalCount}
            </b>
          </button>
        ))}
      </div>
      <div className="hm-entries">{toolbar}</div>
    </nav>
  );

  return (
    <>
      {chipsHost && createPortal(chips, chipsHost)}

      <section
        className="hm-map"
        ref={mapRef}
        style={{ height: layout.height }}
        aria-label={t("map.routeLabel")}
        data-testid="adventure-map"
      >
        <div className="hm-terrain" aria-hidden="true">
          {model.regions.map((region, i) => {
            const band = layout.regionBands[i];
            return (
              <div
                key={region.groupId}
                className="hm-band"
                style={
                  {
                    "--z": lessonGroupColor(region.groupId),
                    top: band.top,
                    height: band.bottom - band.top,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>

        <svg
          className="hm-route"
          viewBox={`0 0 1000 ${layout.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g>
            {paths.map((p) => (
              <path key={p.key} className="hm-road" d={p.d} />
            ))}
          </g>
          <g>
            {paths.map((p) => (
              <path
                key={p.key}
                className={`hm-core ${p.walked ? "is-walked" : "is-ahead"}`}
                style={{ "--z": p.color } as React.CSSProperties}
                d={p.d}
              />
            ))}
          </g>
        </svg>

        {model.regions.map((region, i) => {
          const flag = layout.flags[i];
          return (
            <span
              key={region.groupId}
              className="hm-flag"
              style={
                {
                  "--z": lessonGroupColor(region.groupId),
                  left: `${flag.x / 10}%`,
                  top: flag.y,
                } as React.CSSProperties
              }
              data-region-flag={region.groupId}
            >
              <i aria-hidden="true" />
              {t(region.group.titleKey)}
            </span>
          );
        })}

        <ol className="hm-stations">
          {model.stations.map((station) => {
            const pos = layout.stations[station.index];
            return (
              <StationNode
                key={station.song.id}
                station={station}
                x={pos.x}
                y={pos.y}
                selected={station.song.id === selected?.song.id}
                onSelect={handleSelect}
              />
            );
          })}
        </ol>

        {selected && (
          <StationCard
            key={selected.song.id}
            station={selected}
            x={layout.stations[selected.index].x}
            y={layout.stations[selected.index].y}
            lang={lang}
            buttonRef={cardButtonRef}
            loading={loadingSongId === selected.song.id}
            firstTime={!model.hasAnyProgress && selected.index === 0}
            onPlay={onPlay}
          />
        )}
      </section>

      {backDirection && (
        <div className="hm-back-dock">
          <button
            type="button"
            className="btn-ghost-themed hm-back"
            data-testid="map-back-to-next"
            onClick={backToNext}
          >
            {backDirection === "up" ? (
              <ArrowUp size={18} aria-hidden="true" />
            ) : (
              <ArrowDown size={18} aria-hidden="true" />
            )}
            {t("map.backToNext")}
          </button>
        </div>
      )}
    </>
  );
}

interface StationNodeProps {
  station: MapStation;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (songId: string) => void;
}

const StationNode = memo(function StationNode({
  station,
  x,
  y,
  selected,
  onSelect,
}: StationNodeProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const title = songDisplayTitle(station.song, lang).primary;
  const starsLabel = t("map.starsCount", { n: station.stars });

  return (
    <li
      className={`hm-stn is-${station.status}${selected ? " is-selected" : ""}`}
      style={
        {
          "--z": lessonGroupColor(station.groupId),
          left: `${x / 10}%`,
          top: y,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className="hm-node"
        aria-pressed={selected}
        data-testid={`map-station-${station.song.id}`}
        data-station-id={station.song.id}
        data-status={station.status}
        onClick={() => onSelect(station.song.id)}
      >
        {station.status === "next" && (
          <span className="hm-tag">{t("map.next")}</span>
        )}
        <span className="hm-disk">
          {station.status === "next" ? (
            <Play fill="currentColor" aria-hidden="true" strokeWidth={2} />
          ) : (
            <span className="hm-num">{station.index + 1}</span>
          )}
        </span>
        {station.stars > 0 && (
          <StarRow
            className="hm-stars"
            stars={station.stars}
            size={16}
            label={starsLabel}
          />
        )}
        {station.status === "next" && station.stars === 0 && (
          <StarRow
            className="hm-stars"
            stars={0}
            size={16}
            label={starsLabel}
          />
        )}
        <span className="hm-name">{title}</span>
        <span className="hm-meta">
          {t("map.seconds", { n: Math.round(station.song.durationSeconds) })}
        </span>
      </button>
    </li>
  );
});

interface StationCardProps {
  station: MapStation;
  x: number;
  y: number;
  lang: string;
  loading: boolean;
  firstTime: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onPlay: (songId: string) => void;
}

function reasonKey(station: MapStation, firstTime: boolean): TranslationKey {
  if (firstTime) return "map.reason.first";
  if (station.status === "new") return "map.reason.new";
  if (station.status === "done") return "map.reason.done";
  if (station.status === "next") {
    return station.playCount > 0 || station.stars > 0
      ? "map.reason.next"
      : "map.reason.new";
  }
  return "map.reason.played";
}

function StationCard({
  station,
  x,
  y,
  lang,
  loading,
  firstTime,
  buttonRef,
  onPlay,
}: StationCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const title = songDisplayTitle(station.song, lang).primary;
  const color = lessonGroupColor(station.groupId);
  const played = station.stars > 0 || station.playCount > 0;
  const nextOffset = station.status === "next" ? 140 : 128;
  const half = firstTime ? CARD_HALF_FIRST : CARD_HALF;

  return (
    <div
      className={`hm-card${firstTime ? " is-first" : ""}`}
      style={
        {
          "--z": color,
          left: `clamp(${half}px, ${x / 10}%, calc(100% - ${half}px))`,
          top: y + nextOffset,
        } as React.CSSProperties
      }
      role="group"
      aria-label={title}
      data-testid="map-station-card"
    >
      <div className="hm-card-body">
        <div
          className="hm-cover"
          aria-hidden="true"
          style={{ background: color }}
        >
          <SongCoverArt
            contour={station.song.contour}
            seed={station.song.id}
            color={color}
          />
        </div>
        <div className="hm-card-text">
          <h2 className="hm-card-title" title={title}>
            {title}
          </h2>
          <p className="hm-card-why">{t(reasonKey(station, firstTime))}</p>
          <StarRow
            stars={station.stars}
            size={18}
            label={t("map.starsCount", { n: station.stars })}
          />
        </div>
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="btn-primary-themed hm-go"
        disabled={loading}
        data-testid="map-start"
        onClick={() => onPlay(station.song.id)}
      >
        <Play size={20} fill="currentColor" aria-hidden="true" />
        {played ? t("map.playAgain") : t("app.startPractice")}
      </button>
    </div>
  );
}
