/**
 * Pure gamification math. Level curve: level n starts at 100 * (n-1)^2 XP —
 * level 2 at 100 XP, level 3 at 400 XP, level 4 at 900 XP, and so on.
 */

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) ** 2;
}

export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/** Progress toward the next level, in [0, 1]. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - floor) / (ceil - floor)));
}

export const XP_REWARDS = {
  SESSION_TAUGHT: 50,
  SESSION_LEARNED: 30,
  REVIEW_WRITTEN: 10,
  DAILY_STREAK: 5,
  ONBOARDING_DONE: 20,
} as const;

/** Credits granted when signing up so new members can book a first lesson. */
export const SIGNUP_BONUS_CREDITS = 3;

/** One hour taught equals one credit. */
export function creditsForBooking(durationMinutes: number, hourlyCredits = 1): number {
  return Math.max(1, Math.round((durationMinutes / 60) * hourlyCredits));
}

export type StreakState = { count: number; updatedAt: Date | null };

/**
 * Given the previous streak state and "now", returns the new streak count.
 * Same-day activity keeps the streak, next-day extends it, a gap resets it.
 */
export function nextStreak(prev: StreakState, now: Date): number {
  if (!prev.updatedAt) return 1;
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const diff = day(now) - day(prev.updatedAt);
  if (diff === 0) return prev.count;
  if (diff === 1) return prev.count + 1;
  return 1;
}
