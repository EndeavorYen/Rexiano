import { describe, it, expect, beforeEach } from "vitest";
import { ScoreCalculator } from "./ScoreCalculator";

describe("ScoreCalculator", () => {
  let calc: ScoreCalculator;

  beforeEach(() => {
    calc = new ScoreCalculator();
  });

  it("starts with zeroed score", () => {
    const s = calc.getScore();
    expect(s.totalNotes).toBe(0);
    expect(s.hitNotes).toBe(0);
    expect(s.missedNotes).toBe(0);
    expect(s.accuracy).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
  });

  it("records hits and computes accuracy", () => {
    calc.noteHit(60, 1.0);
    calc.noteHit(62, 1.5);
    calc.noteHit(64, 2.0);

    const s = calc.getScore();
    expect(s.totalNotes).toBe(3);
    expect(s.hitNotes).toBe(3);
    expect(s.missedNotes).toBe(0);
    expect(s.accuracy).toBe(100);
  });

  it("records misses and resets streak", () => {
    calc.noteHit(60, 1.0);
    calc.noteHit(62, 1.5);
    calc.noteMiss(64, 2.0);

    const s = calc.getScore();
    expect(s.totalNotes).toBe(3);
    expect(s.hitNotes).toBe(2);
    expect(s.missedNotes).toBe(1);
    expect(s.accuracy).toBeCloseTo(66.67, 1);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });

  it("tracks bestStreak across multiple streak breaks", () => {
    // streak of 3
    calc.noteHit(60, 1.0);
    calc.noteHit(62, 1.5);
    calc.noteHit(64, 2.0);
    // break
    calc.noteMiss(65, 2.5);
    // streak of 2
    calc.noteHit(67, 3.0);
    calc.noteHit(69, 3.5);
    // break
    calc.noteMiss(71, 4.0);

    const s = calc.getScore();
    expect(s.bestStreak).toBe(3);
    expect(s.currentStreak).toBe(0);
  });

  it("reset() clears all data", () => {
    calc.noteHit(60, 1.0);
    calc.noteHit(62, 1.5);
    calc.noteMiss(64, 2.0);
    calc.reset();

    const s = calc.getScore();
    expect(s.totalNotes).toBe(0);
    expect(s.hitNotes).toBe(0);
    expect(s.missedNotes).toBe(0);
    expect(s.accuracy).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
  });

  describe("chord-level scoring", () => {
    it("counts streak by chord events, not individual notes", () => {
      calc.chordHit(3); // 3-note chord hit
      calc.chordHit(2); // 2-note chord hit
      const s = calc.getScore();
      expect(s.currentStreak).toBe(2); // 2 chord events
      expect(s.hitNotes).toBe(5); // 5 individual notes
      expect(s.totalNotes).toBe(5);
    });

    it("resets streak on chord miss", () => {
      calc.chordHit(3);
      calc.chordMiss(2);
      const s = calc.getScore();
      expect(s.currentStreak).toBe(0);
      expect(s.missedNotes).toBe(2);
      expect(s.hitNotes).toBe(3);
      expect(s.totalNotes).toBe(5);
    });

    it("tracks bestStreak across chord hits and misses", () => {
      calc.chordHit(3); // streak 1
      calc.chordHit(2); // streak 2
      calc.chordHit(1); // streak 3
      calc.chordMiss(2); // break
      calc.chordHit(4); // streak 1
      const s = calc.getScore();
      expect(s.bestStreak).toBe(3);
      expect(s.currentStreak).toBe(1);
    });

    it("computes accuracy correctly with chord events", () => {
      calc.chordHit(3); // 3 hits
      calc.chordMiss(1); // 1 miss
      const s = calc.getScore();
      expect(s.accuracy).toBe(75); // 3/4 = 75%
    });

    it("interoperates with single-note hit/miss methods", () => {
      calc.noteHit(60, 1.0); // streak 1
      calc.chordHit(3); // streak 2
      calc.noteHit(64, 2.0); // streak 3
      const s = calc.getScore();
      expect(s.currentStreak).toBe(3);
      expect(s.hitNotes).toBe(5);
      expect(s.totalNotes).toBe(5);
    });
  });

  it("handles all misses (0% accuracy)", () => {
    calc.noteMiss(60, 1.0);
    calc.noteMiss(62, 1.5);

    const s = calc.getScore();
    expect(s.accuracy).toBe(0);
    expect(s.bestStreak).toBe(0);
  });
});
