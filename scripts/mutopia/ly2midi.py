"""Render a Mutopia LilyPond file to a playable MIDI.

- convert-ly to current syntax
- grace notes dropped (they would become tiny notes the child cannot read)
- articulations keep the written note length
- repeats unfolded
- PDF output suppressed

usage: python3 -I ly2midi.py <src.ly> <workdir> [--midi-tempo N]
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

import lilypond

BIN = Path(lilypond.executable()).parent

PRELUDE = r"""
grace = #(define-music-function (m) (ly:music?) (make-sequential-music '()))
acciaccatura = #(define-music-function (m) (ly:music?) (make-sequential-music '()))
appoggiatura = #(define-music-function (m) (ly:music?) (make-sequential-music '()))
slashedGrace = #(define-music-function (m) (ly:music?) (make-sequential-music '()))
breathe = {}
% Keep the written length: staccato & co. would otherwise shorten the MIDI
% note, and the sheet rebuilt from it would show 16ths and rests.
rexianoWritten = #(define-music-function (m) (ly:music?)
  (music-map
    (lambda (x)
      (if (ly:music-property x 'midi-length #f)
          (ly:music-set-property! x 'midi-length #f))
      x)
    m))
afterGrace = #(define-music-function (frac main grace) ((number-pair?) ly:music? ly:music?) main)
#(define (rexiano-bar-logger ctx)
  (let ((last-bar #f))
    (make-engraver
      ((initialize engraver)
        (let ((port (open-file "barlog.txt" "a")))
          (format port "SCORE\n") (close-port port)))
      ((process-music engraver)
        (let* ((bar (ly:context-property ctx 'internalBarNumber))
               (mp (ly:context-property ctx 'measurePosition))
               (ml (ly:context-property ctx 'measureLength))
               (now (ly:context-current-moment ctx)))
          (if (not (equal? bar last-bar))
            (let ((port (open-file "barlog.txt" "a")))
              (set! last-bar bar)
              (format port "~a ~a ~a ~a\n" bar (ly:moment-main now)
                      (ly:moment-main mp) (ly:moment-main ml))
              (close-port port))))))))
% "Fine." marks where a D.C. al Fine stops; the importer replays up to it.
#(define (rexiano-fine-logger ctx)
  (make-engraver
    (listeners
      ((text-script-event engraver event)
        (let ((text (markup->string (ly:event-property event 'text))))
          (if (string-contains text "Fine")
            (let ((port (open-file "barlog.txt" "a")))
              (format port "~a ~a\n"
                      (if (string-contains text "D.C") "DC" "FINE")
                      (ly:moment-main (ly:context-current-moment ctx)))
              (close-port port))))))))
\layout {
  \context { \Score \consists #rexiano-bar-logger }
  \context { \Voice \consists #rexiano-fine-logger }
}
"""


def main() -> None:
    src = Path(sys.argv[1])
    work = Path(sys.argv[2])
    work.mkdir(parents=True, exist_ok=True)
    for f in src.parent.glob("*.ly*"):
        shutil.copy(f, work / f.name)
    for f in src.parent.glob("*.ily"):
        shutil.copy(f, work / f.name)
    main_ly = work / src.name
    subprocess.run([str(BIN / "convert-ly"), "-e", "-q", str(main_ly)], check=False,
                   capture_output=True)
    text = main_ly.read_text(encoding="utf-8", errors="replace")
    # Old LilyPond tolerated "f8'": octave marks after the duration.
    text = re.sub(r"(?<![\\\w])([a-g](?:isis|eses|is|es|s)?)(\d+\.*)('+|,+)",
                  r"\1\3\2", text)
    # Old staccatissimo shorthand "-|" is "-!" today.
    text = re.sub(r"([-_^])\|", r"\1!", text)
    # Prelude goes right after the \version line (or at the top).
    m = re.search(r"\\version\s+\"[^\"]*\"", text)
    pos = m.end() if m else 0
    text = text[:pos] + "\n" + PRELUDE + "\n" + text[pos:]
    # Unfold repeats for every score.
    text = re.sub(r"\\score\s*\{", r"\\score { \\unfoldRepeats \\rexianoWritten ", text)
    if "\\midi" not in text:
        raise SystemExit(f"no \\midi block in {src}")
    main_ly.write_text(text, encoding="utf-8")
    (work / "barlog.txt").unlink(missing_ok=True)
    res = subprocess.run(
        [str(BIN / "lilypond"), "-dprint-pages=#f", "-dno-point-and-click",
         "--loglevel=ERROR", "-o", str(work / "out"), str(main_ly)],
        capture_output=True, text=True, cwd=work,
    )
    if res.returncode != 0:
        sys.stderr.write(res.stderr[-3000:])
        raise SystemExit(1)
    mids = sorted(work.glob("out*.mid*"))
    print("\n".join(str(p) for p in mids))


if __name__ == "__main__":
    main()
