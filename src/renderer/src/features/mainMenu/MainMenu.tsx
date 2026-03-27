/**
 * Phase 6.5: Main menu — application home screen with recent files,
 * practice stats overview, and quick actions.
 */
import { useMemo } from "react";
import {
  Play,
  Clock3,
  Library,
  Flame,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useRecentFiles } from "@renderer/hooks/useRecentFiles";
import { formatRelativeTime } from "@renderer/utils/relativeTime";
import { getTimeOfDay } from "@renderer/utils/greeting";
import type { RecentFile } from "@shared/types";

interface MainMenuProps {
  onStartPractice: () => void;
  onOpenSettings: () => void;
  onSelectRecent?: (file: RecentFile) => void;
}

export function MainMenu({
  onStartPractice,
  onOpenSettings,
  onSelectRecent,
}: MainMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessions = useProgressStore((s) => s.sessions);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const kidMode = useSettingsStore((s) => s.kidMode);
  const { recentFiles: allRecents } = useRecentFiles();
  const recentFiles = allRecents.slice(0, 5);
  /** R3-01 fix: lookup map covers all PracticeMode values (including "step")
   *  instead of an if-chain that silently fell through to "watch". */
  const defaultModeLabel = useMemo(() => {
    const modeI18nMap: Record<
      string,
      "practice.watch" | "practice.wait" | "practice.free" | "practice.step"
    > = {
      watch: "practice.watch",
      wait: "practice.wait",
      free: "practice.free",
      step: "practice.step",
    };
    const key = modeI18nMap[defaultMode] ?? "practice.watch";
    return t(key);
  }, [defaultMode, t]);

  const greeting = (() => {
    const tod = getTimeOfDay();
    return t(`library.greeting.${tod}`);
  })();

  const totalSessions = sessions.length;
  const practicedSongs = new Set(sessions.map((s) => s.songId)).size;

  return (
    <div
      className="flex-1 min-h-0 app-shell overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:py-8"
      data-testid="main-menu-view"
    >
      <div className="mx-auto w-full max-w-6xl flex items-start lg:items-center min-h-full">
        <div
          className="surface-panel subtle-shadow-md w-full p-6 sm:p-8 lg:p-10 animate-page-enter"
          data-testid="main-menu-panel"
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
            <section className="space-y-6">
              <span className="kicker-label">{t("app.subtitle")}</span>

              <div className="flex items-center gap-4">
                <div className="brand-emblem rounded-2xl">
                  <img
                    src={appIcon}
                    alt="Rexiano"
                    width={66}
                    height={66}
                    className="rounded-2xl subtle-shadow"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-none">
                    {t("app.title")}
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                    data-testid="main-menu-greeting"
                  >
                    {greeting}
                  </p>
                </div>
              </div>

              <p
                className="text-sm sm:text-base max-w-lg"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("app.menuGreeting")}
              </p>

              {totalSessions > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  <MetaPill
                    icon={<Library size={14} />}
                    label={
                      practicedSongs === 1
                        ? t("library.songPracticed")
                        : t("library.songsPracticed")
                    }
                    value={practicedSongs}
                  />
                  <MetaPill
                    icon={<Flame size={14} />}
                    label={
                      totalSessions === 1
                        ? t("library.session")
                        : t("library.sessions")
                    }
                    value={totalSessions}
                  />
                </div>
              ) : (
                <p
                  className="text-sm font-body"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("library.exploreSongs")}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onStartPractice}
                  className="btn-primary-themed flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-body font-semibold cursor-pointer"
                >
                  <Play size={17} />
                  {t("app.startPractice")}
                </button>
                <button
                  onClick={onOpenSettings}
                  className="btn-surface-themed flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-body font-medium cursor-pointer"
                >
                  <SlidersHorizontal size={16} />
                  {t("app.openSettings")}
                </button>
              </div>

              {!kidMode && (
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-body"
                  style={{
                    color: "var(--color-text-muted)",
                    background:
                      "color-mix(in srgb, var(--color-surface-alt) 70%, var(--color-surface))",
                    border: "1px solid var(--color-border)",
                  }}
                  data-testid="main-menu-last-used-summary"
                >
                  <Clock3 size={12} />
                  <span>
                    {t("settings.defaultMode")}: {defaultModeLabel}
                  </span>
                  <span className="font-mono tabular-nums">
                    {Math.round(defaultSpeed * 100)}%
                  </span>
                </div>
              )}
            </section>

            <aside className="surface-elevated p-4 sm:p-5 space-y-3" aria-label={recentFiles.length > 0 ? t("library.recentlyPlayed") : t("library.importMidi")}>
              <h2
                className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Clock3 size={13} />
                {recentFiles.length > 0 ? t("library.recentlyPlayed") : t("library.importMidi")}
              </h2>

              {recentFiles.length > 0 && onSelectRecent ? (
                <div className="space-y-2.5">
                  {recentFiles.map((file, idx) => (
                    <button
                      key={file.path}
                      onClick={() => onSelectRecent(file)}
                      className="card-hover animate-page-enter w-full text-left rounded-lg px-3.5 py-2.5 cursor-pointer"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                        border: "1px solid var(--color-border)",
                        animationDelay: `${idx * 55}ms`,
                      }}
                      title={file.name}
                      aria-label={file.name}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-body font-medium truncate">
                          {file.name}
                        </p>
                        <ArrowUpRight
                          size={13}
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      </div>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {formatRelativeTime(file.timestamp)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-lg px-3.5 py-4 text-sm"
                  style={{
                    color: "var(--color-text-muted)",
                    background:
                      "color-mix(in srgb, var(--color-surface) 74%, transparent)",
                    border: "1px dashed var(--color-border)",
                  }}
                >
                  {t("library.noSongsHint")}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs"
      style={{
        color: "var(--color-text)",
        background:
          "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
        border:
          "1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border))",
      }}
    >
      <span style={{ color: "var(--color-accent)" }}>{icon}</span>
      <span className="font-body font-medium">{value}</span>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
    </div>
  );
}
