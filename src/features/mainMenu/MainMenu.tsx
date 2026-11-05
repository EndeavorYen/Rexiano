import { useEffect, useMemo } from "react";
import { ChevronRight, Flame, Library, Play, Upload } from "lucide-react";
import { displayTitleForName } from "@renderer/features/songLibrary/songTitle";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { formatRelativeTime } from "@renderer/utils/relativeTime";
import { FamilyTopBar } from "../shell/FamilyTopBar";
import { PianoQuickConnect } from "../midiDevice/PianoQuickConnect";
import type { RecentFile } from "@shared/types";

interface MainMenuProps {
  onStartPractice: () => void;
  onOpenSettings: () => void;
  onOpenFile?: () => void;
  onSelectRecent?: (file: RecentFile) => void;
  recentFiles: RecentFile[];
}

/**
 * Home screen, laid out like the other family games: top bar, one big
 * sun-yellow action, then cards.
 */
export function MainMenu({
  onStartPractice,
  onOpenSettings,
  onOpenFile,
  onSelectRecent,
  recentFiles: allRecents,
}: MainMenuProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const catalogue = useSongLibraryStore((s) => s.songs);
  // Recents store English titles; the catalogue maps them to zh-TW names.
  useEffect(() => {
    const library = useSongLibraryStore.getState();
    if (library.songs.length === 0 && !library.isLoading) {
      void library.fetchSongs();
    }
  }, []);
  const sessions = useProgressStore((s) => s.sessions);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);
  const recentFiles = allRecents.slice(0, 5);
  const hasRecents = recentFiles.length > 0 && !!onSelectRecent;

  useEffect(() => {
    if (!isProgressLoaded) {
      void loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 18) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);

  const totalSessions = sessions.length;
  const practicedSongs = new Set(sessions.map((s) => s.songId)).size;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col gap-4 px-4 pb-10 pt-3 animate-page-enter">
        <FamilyTopBar
          onOpenSettings={onOpenSettings}
          settingsTestId="main-menu-settings"
        />

        {/* On tall tablet screens the cards sit in the optical middle. */}
        <div className="flex flex-1 flex-col justify-center gap-4 pb-[6vh]">
          <section className="home-hero set-card">
            <div className="relative flex flex-col gap-4">
              <div>
                <p className="home-kicker">{t("app.subtitle")}</p>
                <h2 className="home-greeting">{greeting}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatChip
                  icon={<Library size={15} />}
                  value={practicedSongs}
                  label={t("library.songsPracticed")}
                />
                <StatChip
                  icon={<Flame size={15} />}
                  value={totalSessions}
                  label={
                    totalSessions === 1
                      ? t("library.session")
                      : t("library.sessions")
                  }
                />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr]">
                <button
                  onClick={onStartPractice}
                  className="btn-primary-themed flex min-h-[60px] items-center justify-center gap-3 rounded-2xl text-lg cursor-pointer"
                  data-import-recovery-focus-fallback
                >
                  <Play size={22} fill="currentColor" />
                  {t("app.startPractice")}
                </button>
                {onOpenFile && (
                  <button
                    onClick={onOpenFile}
                    className="btn-ghost-themed flex min-h-[60px] items-center justify-center gap-2 rounded-2xl text-base font-bold cursor-pointer"
                    data-testid="main-menu-import"
                  >
                    <Upload size={18} />
                    {t("library.importMidi")}
                  </button>
                )}
              </div>
            </div>
          </section>

          <PianoQuickConnect
            onOpenDetails={onOpenSettings}
            testId="main-menu-piano"
          />

          {hasRecents && (
            <section
              className="set-card"
              aria-label={t("library.recentlyPlayed")}
            >
              <h3>{t("library.recentlyPlayed")}</h3>
              <div className="flex flex-col gap-2">
                {recentFiles.map((file) => {
                  const title = displayTitleForName(file.name, catalogue, lang);
                  return (
                    <button
                      key={file.path}
                      onClick={() => onSelectRecent(file)}
                      className="btn-surface-themed flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left cursor-pointer"
                      title={title}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {title}
                        </span>
                        <span
                          className="block text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {formatRelativeTime(file.timestamp, t)}
                        </span>
                      </span>
                      <ChevronRight
                        size={18}
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <span className="stat-chip">
      <span style={{ color: "var(--color-success-text)" }}>{icon}</span>
      <b>{value}</b>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
    </span>
  );
}
