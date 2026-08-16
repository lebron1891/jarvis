import { prisma } from "../lib/prisma";
import { levelForXp, nextStreak, XP_REWARDS } from "../utils/gamification";
import { notify } from "./notifications";

/** Adds XP, recomputes the level and notifies on level-up. */
export async function awardXp(userId: string, amount: number, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });
  if (!user) return;
  const xp = user.xp + amount;
  const level = levelForXp(xp);
  await prisma.user.update({ where: { id: userId }, data: { xp, level } });
  if (level > user.level) {
    await notify(
      userId,
      "ACHIEVEMENT",
      `Level ${level} reached!`,
      `${reason} pushed you to level ${level}. Keep it up!`,
      { level },
    );
  }
}

/** Called on meaningful daily activity; extends or resets the daily streak. */
export async function touchStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, streakUpdatedAt: true },
  });
  if (!user) return;
  const now = new Date();
  const count = nextStreak(
    { count: user.streakCount, updatedAt: user.streakUpdatedAt },
    now,
  );
  if (count === user.streakCount && user.streakUpdatedAt) {
    const sameDay =
      Math.floor(now.getTime() / 86_400_000) ===
      Math.floor(user.streakUpdatedAt.getTime() / 86_400_000);
    if (sameDay) return; // already counted today
  }
  await prisma.user.update({
    where: { id: userId },
    data: { streakCount: count, streakUpdatedAt: now },
  });
  if (count > user.streakCount) {
    await awardXp(userId, XP_REWARDS.DAILY_STREAK, "Daily streak");
  }
}

/**
 * Badge rules, evaluated against current stats. Cheap enough to run after
 * every relevant event (exchange completed, review received, etc.).
 */
const BADGE_RULES: Array<{
  code: string;
  test: (u: {
    completedExchanges: number;
    sessionsTaught: number;
    sessionsLearned: number;
    streakCount: number;
    languages: string[];
    ratingAvg: number;
    ratingCount: number;
    verifiedTeacher: boolean;
  }) => boolean;
}> = [
  { code: "FIRST_EXCHANGE", test: (u) => u.completedExchanges >= 1 },
  { code: "EXCHANGE_10", test: (u) => u.completedExchanges >= 10 },
  { code: "EXCHANGE_50", test: (u) => u.completedExchanges >= 50 },
  { code: "MENTOR", test: (u) => u.sessionsTaught >= 10 },
  { code: "SCHOLAR", test: (u) => u.sessionsLearned >= 10 },
  { code: "STREAK_7", test: (u) => u.streakCount >= 7 },
  { code: "STREAK_30", test: (u) => u.streakCount >= 30 },
  { code: "POLYGLOT", test: (u) => u.languages.length >= 3 },
  { code: "TOP_RATED", test: (u) => u.ratingCount >= 10 && u.ratingAvg >= 4.8 },
  { code: "VERIFIED", test: (u) => u.verifiedTeacher },
];

export async function checkBadges(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      completedExchanges: true,
      sessionsTaught: true,
      sessionsLearned: true,
      streakCount: true,
      languages: true,
      ratingAvg: true,
      ratingCount: true,
      verifiedTeacher: true,
      badges: { select: { badge: { select: { code: true } } } },
    },
  });
  if (!user) return;
  const owned = new Set(user.badges.map((b) => b.badge.code));
  const earned = BADGE_RULES.filter((r) => !owned.has(r.code) && r.test(user));
  if (earned.length === 0) return;

  const badges = await prisma.badge.findMany({
    where: { code: { in: earned.map((r) => r.code) } },
  });
  for (const badge of badges) {
    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
    await notify(
      userId,
      "ACHIEVEMENT",
      "New badge unlocked 🏅",
      `You earned “${badge.name}” — ${badge.description}`,
      { badgeCode: badge.code },
    );
  }
}

/** Advances active challenges tracking the given metric. */
export async function bumpChallengeProgress(
  userId: string,
  metric: string,
  amount = 1,
) {
  const now = new Date();
  const challenges = await prisma.challenge.findMany({
    where: { metric, startsAt: { lte: now }, endsAt: { gte: now } },
  });
  for (const challenge of challenges) {
    const uc = await prisma.userChallenge.upsert({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
      create: { userId, challengeId: challenge.id, progress: amount },
      update: { progress: { increment: amount } },
    });
    if (!uc.completedAt && uc.progress >= challenge.target) {
      await prisma.userChallenge.update({
        where: { userId_challengeId: { userId, challengeId: challenge.id } },
        data: { completedAt: now },
      });
      await awardXp(userId, challenge.xpReward, `Challenge “${challenge.title}”`);
      await notify(
        userId,
        "ACHIEVEMENT",
        "Challenge complete 🎯",
        `You finished “${challenge.title}” and earned ${challenge.xpReward} XP.`,
        { challengeCode: challenge.code },
      );
    }
  }
}
