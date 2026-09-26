import { useCallback } from "react";
import { Grid2X2, List, Search } from "lucide-react";
import {
  useSongLibraryStore,
  type DifficultyFilter,
  type SongLibraryViewMode,
} from "../../stores/useSongLibraryStore";
import { useTranslation } from "../../i18n/useTranslation";
import type { TranslationKey } from "../../i18n/types";

const difficulties: { value: DifficultyFilter; key: TranslationKey }[] = [
  { value: "all", key: "library.difficulty.all" },
  { value: "beginner", key: "library.difficulty.beginner" },
  { value: "intermediate", key: "library.difficulty.intermediate" },
  { value: "advanced", key: "library.difficulty.advanced" },
];

const viewModes: {
  value: SongLibraryViewMode;
  key: TranslationKey;
  icon: React.ComponentType<{ size?: number }>;
}[] = [
  { value: "list", key: "library.view.list", icon: List },
  { value: "cards", key: "library.view.cards", icon: Grid2X2 },
];

export function SongLibraryFilters(): React.JSX.Element {
  const { t } = useTranslation();
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const viewMode = useSongLibraryStore((s) => s.viewMode);
  const setSearchQuery = useSongLibraryStore((s) => s.setSearchQuery);
  const setDifficultyFilter = useSongLibraryStore((s) => s.setDifficultyFilter);
  const setViewMode = useSongLibraryStore((s) => s.setViewMode);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search + difficulty row */}
      <div className="flex min-w-0 flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        <div className="flex-1 relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={t("library.searchPlaceholder")}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-lg text-sm font-body input-themed"
            data-testid="song-library-search"
          />
        </div>

        <div
          className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl p-1"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface) 80%, transparent)",
            border: "1px solid var(--color-border)",
          }}
        >
          {difficulties.map((d) => (
            <button
              key={d.value}
              onClick={() => setDifficultyFilter(d.value)}
              className="min-h-9 px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-colors cursor-pointer"
              style={{
                background:
                  difficultyFilter === d.value
                    ? "var(--color-accent)"
                    : "transparent",
                color:
                  difficultyFilter === d.value
                    ? "var(--color-on-accent)"
                    : "var(--color-text)",
              }}
            >
              {t(d.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 80%, transparent)",
              border: "1px solid var(--color-border)",
            }}
          >
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  data-testid={`song-library-view-${mode.value}`}
                  onClick={() => setViewMode(mode.value)}
                  className="flex h-9 w-9 items-center justify-center rounded-md transition-colors cursor-pointer"
                  aria-label={t(mode.key)}
                  aria-pressed={isActive}
                  style={{
                    background: isActive
                      ? "var(--color-accent)"
                      : "transparent",
                    color: isActive
                      ? "var(--color-on-accent)"
                      : "var(--color-text-muted)",
                  }}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
