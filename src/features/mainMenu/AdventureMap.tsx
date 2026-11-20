import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Music2, Play } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { StarRow } from "../progress/StarRow";
import { SongCoverArt } from "../songLibrary/SongCoverArt";
import { lessonGroupColor } from "../songLibrary/lessonGroupColor";
import { songDisplayTitle } from "../songLibrary/songTitle";
import type { TranslationKey } from "@renderer/i18n/types";
import type { AdventureMapModel, MapStation } from "./adventureMap";
import { layoutRoute, segmentPath } from "./routeLayout";
import "./home-map.css";

interface AdventureMapProps {
  model: AdventureMapModel;
  /** The scrolling ancestor; the map moves it to bring stations into view */
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** Buttons that sit at the right end of the unit chip row */
  toolbar?: React.ReactNode;
  loadingSongId?: string | null;
  onPlay: (songId: string) => void;
}

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

/** Scroll `scroller` so `target` sits `ratio` of the way down the viewport. */
function scrollToTarget(
  scroller: HTMLElement,
  target: HTMLElement,
  ratio: number,
  smooth: boolean,
): void {
  const scrollerBox = scroller.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const offset = targetBox.top - scrollerBox.top;
  const top =
    scroller.scrollTop +
    offset -
    scroller.clientHeight * ratio +
    targetBox.height / 2;
  scroller.scrollTo({
    top: Math.max(0, top),
    behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
  });
}

export function AdventureMap({
  model,
  scrollerRef,
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
  const [pickedId, setPickedId] = useState<string | null>(null);

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
      walked: station.status !== "new",
      color: lessonGroupColor(station.groupId),
    }));
  }, [model.stations, layout]);

  const handleSelect = useCallback((songId: string) => {
    const button = mapRef.current?.querySelector<HTMLElement>(
      `[data-station-id="${CSS.escape(songId)}"]`,
    );
    // Remember where the clicked station is: closing another card moves rows.
    anchorRef.current = button
      ? { id: songId, top: button.getBoundingClientRect().top }
      : null;
    focusCardRef.current = true;
    setPickedId(songId);
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
    if (focusCardRef.current) {
      focusCardRef.current = false;
      const card = cardButtonRef.current;
      if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selected?.song.id, scrollerRef]);

  // On arrival, put the next stop a little above the middle of the screen.
  const hasStations = model.stations.length > 0;
  const arrivedRef = useRef(false);
  const nextId = model.nextStation?.song.id ?? null;
  useLayoutEffect(() => {
    if (!hasStations || arrivedRef.current) return;
    arrivedRef.current = true;
    const scroller = scrollerRef.current;
    if (!scroller || !nextId) return;
    const target = mapRef.current?.querySelector<HTMLElement>(
      `[data-station-id="${CSS.escape(nextId)}"]`,
    );
    if (target) scrollToTarget(scroller, target, 0.38, false);
  }, [hasStations, nextId, scrollerRef]);

  const jumpToRegion = useCallback(
    (groupId: string) => {
      const scroller = scrollerRef.current;
      const flag = mapRef.current?.querySelector<HTMLElement>(
        `[data-region-flag="${groupId}"]`,
      );
      if (scroller && flag) scrollToTarget(scroller, flag, 0.12, true);
    },
    [scrollerRef],
  );

  const currentGroupId = model.nextStation?.groupId ?? null;

  return (
    <>
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
              <b>
                {region.completedCount}/{region.totalCount}
              </b>
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
  const statusLabel =
    station.status === "next"
      ? t("map.next")
      : t(`map.status.${station.status}` as TranslationKey);
  const starsLabel = t("map.starsCount", { n: station.stars });
  const label =
    station.status === "new" || station.status === "next"
      ? `${title}，${statusLabel}`
      : `${title}，${starsLabel}，${statusLabel}`;

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
        aria-label={label}
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
          <Music2 aria-hidden="true" strokeWidth={2.4} />
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
  const nextOffset = station.status === "next" ? 150 : 128;

  return (
    <div
      className="hm-card"
      style={
        {
          "--z": color,
          left: `clamp(156px, ${x / 10}%, calc(100% - 156px))`,
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
