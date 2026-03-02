import { useCallback } from "react";
import { Search } from "lucide-react";
import {
  useSongLibraryStore,
  type DifficultyFilter,
} from "../../stores/useSongLibraryStore";
import { useTranslation } from "../../i18n/useTranslation";
import type { TranslationKey } from "../../i18n/types";

const difficulties: { value: DifficultyFilter; key: TranslationKey }[] = [
  { value: "all", key: "library.difficulty.all" },
  { value: "beginner", key: "library.difficulty.beginner" },
  { value: "intermediate", key: "library.difficulty.intermediate" },
  { value: "advanced", key: "library.difficulty.advanced" },
];

export function SongLibraryFilters(): React.JSX.Element {
  const { t } = useTranslation();
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const setSearchQuery = useSongLibraryStore((s) => s.setSearchQuery);
  const setDifficultyFilter = useSongLibraryStore((s) => s.setDifficultyFilter);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full">
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
        />
      </div>

      <div
        className="flex items-center gap-1.5 rounded-xl p-1"
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
            className="px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-colors cursor-pointer"
            style={{
              background:
                difficultyFilter === d.value
                  ? "var(--color-accent)"
                  : "transparent",
              color:
                difficultyFilter === d.value ? "#fff" : "var(--color-text)",
            }}
          >
            {t(d.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
