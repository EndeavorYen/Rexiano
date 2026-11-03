import { PlayCircle } from "lucide-react";
import { songDisplayTitle } from "./songTitle";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import type {
  PracticeRecommendationModel,
  PracticeRecommendationReason,
} from "./songLibrarySelectors";

const recommendationReasonKeys: Record<
  PracticeRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

export interface PracticeRecommendationBannerProps {
  recommendation: PracticeRecommendationModel;
  isLoading: boolean;
  onSelectSong: (songId: string) => void;
  rememberReturnFocus: (testId: string) => void;
}

export function PracticeRecommendationBanner({
  recommendation,
  isLoading,
  onSelectSong,
  rememberReturnFocus,
}: PracticeRecommendationBannerProps): React.JSX.Element {
  const { t, lang } = useTranslation();

  return (
    <section className="surface-elevated mb-5 p-4 animate-page-enter">
      <button
        type="button"
        onClick={() => {
          rememberReturnFocus("song-library-recommendation");
          onSelectSong(recommendation.song.id);
        }}
        disabled={isLoading}
        className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
        style={{
          background:
            "color-mix(in srgb, var(--color-note1) 10%, var(--color-surface))",
          border:
            "1px solid color-mix(in srgb, var(--color-note1) 20%, var(--color-border))",
        }}
        data-testid="song-library-recommendation"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-on-accent)",
            }}
          >
            {isLoading ? (
              <span
                className="h-4 w-4 rounded-full border-2 animate-spin"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--color-on-accent) 45%, transparent)",
                  borderTopColor: "var(--color-on-accent)",
                }}
              />
            ) : (
              <PlayCircle size={20} />
            )}
          </span>
          <span className="min-w-0">
            <span
              className="block text-xs font-body font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-accent-text)" }}
            >
              {t("library.recommendation.title")}
            </span>
            <span
              className="block truncate text-base font-display font-bold"
              style={{ color: "var(--color-text)" }}
              data-testid="song-library-recommendation-title"
            >
              {songDisplayTitle(recommendation.song, lang).primary}
            </span>
            <span
              className="block text-xs font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t(recommendationReasonKeys[recommendation.reason])}
              {" · "}
              {recommendation.bestAccuracy !== null
                ? `${Math.round(recommendation.bestAccuracy)}%`
                : t("library.neverPracticed")}
            </span>
          </span>
        </span>
        <span
          className="hidden shrink-0 rounded-lg px-3 py-1.5 text-xs font-body font-semibold sm:inline-flex"
          style={{
            color: "var(--color-on-accent)",
            background: "var(--color-accent)",
          }}
        >
          {t("library.recommendation.cta")}
        </span>
      </button>
    </section>
  );
}
