import { describe, expect, it } from "vitest";
import {
  creditsForBooking,
  levelForXp,
  levelProgress,
  nextStreak,
  xpForLevel,
} from "../utils/gamification";

describe("level curve", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it("reaches level 2 at 100 XP and level 3 at 400 XP", () => {
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(399)).toBe(2);
    expect(levelForXp(400)).toBe(3);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
  });

  it("level thresholds and levelForXp are consistent", () => {
    for (let level = 1; level <= 30; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it("reports progress in [0, 1]", () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(50)).toBeCloseTo(0.5);
    expect(levelProgress(250)).toBeCloseTo(0.5);
    expect(levelProgress(101)).toBeGreaterThan(0);
    expect(levelProgress(101)).toBeLessThan(1);
  });
});

describe("creditsForBooking", () => {
  it("charges one credit per hour", () => {
    expect(creditsForBooking(60)).toBe(1);
    expect(creditsForBooking(120)).toBe(2);
  });

  it("rounds to the nearest credit with a minimum of 1", () => {
    expect(creditsForBooking(30)).toBe(1);
    expect(creditsForBooking(90)).toBe(2); // 1.5h rounds up
    expect(creditsForBooking(80)).toBe(1); // 1.33h rounds down
  });

  it("respects custom hourly rates", () => {
    expect(creditsForBooking(60, 2)).toBe(2);
    expect(creditsForBooking(30, 2)).toBe(1);
  });
});

describe("nextStreak", () => {
  const day = (offset: number) => new Date(Date.UTC(2026, 6, 8 + offset, 12));

  it("starts at 1 for first activity", () => {
    expect(nextStreak({ count: 0, updatedAt: null }, day(0))).toBe(1);
  });

  it("keeps the count for same-day activity", () => {
    expect(nextStreak({ count: 4, updatedAt: day(0) }, day(0))).toBe(4);
  });

  it("increments on consecutive days", () => {
    expect(nextStreak({ count: 4, updatedAt: day(0) }, day(1))).toBe(5);
  });

  it("resets after a gap", () => {
    expect(nextStreak({ count: 9, updatedAt: day(0) }, day(2))).toBe(1);
    expect(nextStreak({ count: 9, updatedAt: day(0) }, day(30))).toBe(1);
  });
});
