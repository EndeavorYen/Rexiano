import "./songbook.css";
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

/** Search box and level picker above the shelves. */
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
    <div className="songbook-filters">
      <label className="songbook-search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={handleSearch}
          placeholder={t("songbook.search.placeholder")}
          aria-label={t("library.searchPlaceholder")}
          data-testid="song-library-search"
        />
      </label>
      <div
        className="segmented songbook-levels"
        role="group"
        aria-label={t("songbook.levels.label")}
      >
        {difficulties.map((d) => (
          <button
            key={d.value}
            type="button"
            aria-pressed={difficultyFilter === d.value}
            data-testid={`song-library-level-${d.value}`}
            onClick={() => setDifficultyFilter(d.value)}
          >
            {t(d.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
