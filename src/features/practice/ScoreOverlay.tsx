import { useMemo } from "react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { StarRow } from "../progress/StarRow";
import { MAX_STARS } from "../progress/stars";
import { buildScoreHud, countPlayableNotes } from "./scoreHud";
import "./play-feedback.css";

/**
 * The live HUD: stars so far, how many notes are played, and the streak.
 * A fixed-width pill in the title bar, so it never covers the falling notes
 * and never jumps as the numbers change. Watch mode has no scoring, so no HUD.
 */
export function ScoreOverlay(): React.JSX.Element {
  const { t } = useTranslation();
  const score = usePracticeStore((s) => s.score);
  const mode = usePracticeStore((s) => s.mode);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const song = useSongStore((s) => s.song);

  const totalNotes = useMemo(
    () => (song ? countPlayableNotes(song.tracks, activeTracks) : 0),
    [song, activeTracks],
  );
  const hud = buildScoreHud({ mode, score, totalNotes });
  if (!hud) return <></>;

  return (
    <div
      className="play-hud"
      role="status"
      aria-label={t("practice.scoreLabel")}
      data-testid="score-hud"
    >
      <StarRow
        stars={hud.stars}
        size={18}
        label={t("practice.hudStars", {
          filled: hud.stars,
          total: MAX_STARS,
        })}
      />
      <span className="play-hud-progress" data-testid="score-hud-progress">
        {t("practice.hudPlayed", { played: hud.played, total: hud.total })}
      </span>
      <span className="play-hud-combo-slot">
        {hud.combo && (
          <span
            // A new key restarts the pop on every note in the streak.
            key={hud.combo.count}
            className={`play-hud-combo${hud.combo.milestone ? " is-milestone" : ""}`}
            data-testid="score-hud-combo"
          >
            <span className="play-hud-combo-count">{hud.combo.count}</span>
            <span className="play-hud-combo-label">{t("practice.combo")}</span>
          </span>
        )}
      </span>
    </div>
  );
}
