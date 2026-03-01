/**
 * MainMenu — Landing screen shown at app startup.
 *
 * Provides a friendly, child-oriented welcome screen with:
 * - App branding and greeting
 * - Large "Start Practicing" button
 * - Settings shortcut
 * - Quick access to recently played songs
 */

import { useMemo } from "react";
import { Music, Settings, Play, Clock } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useRecentFiles } from "@renderer/hooks/useRecentFiles";
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
  const { recentFiles: allRecents } = useRecentFiles();
  const recentFiles = allRecents.slice(0, 3);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 18) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);

  const totalSessions = sessions.length;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-8 px-6"
      style={{
        background:
          "linear-gradient(165deg, var(--color-bg), color-mix(in srgb, var(--color-accent) 5%, var(--color-bg)))",
      }}
    >
      {/* Logo & branding */}
      <div className="text-center animate-page-enter">
        <div
          className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #fff))",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          }}
        >
          <Music size={36} color="#fff" />
        </div>
        <h1
          className="text-3xl font-display font-bold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          {t("app.title")}
        </h1>
        <p
          className="text-sm font-body mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {greeting}
        </p>
      </div>

      {/* Main CTA */}
      <button
        onClick={onStartPractice}
        className="flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-body font-bold cursor-pointer animate-page-enter"
        style={{
          background: "var(--color-accent)",
          color: "#fff",
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset",
          transition: "transform 0.15s, box-shadow 0.15s",
          animationDelay: "0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Play size={22} />
        {t("app.startPractice")}
      </button>

      {/* Recent songs quick access */}
      {recentFiles.length > 0 && onSelectRecent && (
        <div
          className="flex flex-col items-center gap-2 animate-page-enter"
          style={{ animationDelay: "0.2s" }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("library.recentlyPlayed")}
          </span>
          <div className="flex items-center gap-2">
            {recentFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => onSelectRecent(file)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body cursor-pointer"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                  transition: "all 0.15s",
                }}
                title={file.name}
              >
                <Clock size={11} />
                <span className="truncate max-w-[120px]">{file.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body cursor-pointer animate-page-enter"
        style={{
          background: "var(--color-surface-alt)",
          color: "var(--color-text-muted)",
          transition: "all 0.15s",
          animationDelay: "0.3s",
        }}
      >
        <Settings size={15} />
        {t("app.openSettings")}
      </button>

      {/* Stats footer */}
      {totalSessions > 0 && (
        <p
          className="text-xs font-body animate-page-enter"
          style={{ color: "var(--color-text-muted)", animationDelay: "0.4s" }}
        >
          {totalSessions}{" "}
          {totalSessions === 1 ? t("library.session") : t("library.sessions")}
        </p>
      )}
    </div>
  );
}
