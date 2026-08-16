import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { levelProgress, xpForLevel } from "../utils/gamification";

const router = Router();

router.get(
  "/leaderboard",
  validate({
    query: z.object({
      metric: z.enum(["xp", "credits", "exchanges", "streak"]).default("xp"),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { metric, limit } = req.query as unknown as { metric: string; limit: number };
    const orderBy =
      metric === "credits"
        ? { creditBalance: "desc" as const }
        : metric === "exchanges"
          ? { completedExchanges: "desc" as const }
          : metric === "streak"
            ? { streakCount: "desc" as const }
            : { xp: "desc" as const };
    const users = await prisma.user.findMany({
      where: { isBanned: false },
      orderBy,
      take: limit,
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        country: true,
        level: true,
        xp: true,
        creditBalance: true,
        completedExchanges: true,
        streakCount: true,
        verifiedTeacher: true,
      },
    });
    res.json({ leaderboard: users, metric });
  }),
);

/** My gamification snapshot: level progress, streak, badges, challenges. */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        xp: true,
        level: true,
        streakCount: true,
        badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } },
        challenges: { include: { challenge: true } },
      },
    });
    res.json({
      xp: user.xp,
      level: user.level,
      nextLevelXp: xpForLevel(user.level + 1),
      levelProgress: levelProgress(user.xp),
      streak: user.streakCount,
      badges: user.badges,
      challenges: user.challenges,
    });
  }),
);

/** All badges, with which ones the caller owns. */
router.get(
  "/achievements",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [badges, mine] = await Promise.all([
      prisma.badge.findMany({ orderBy: { tier: "asc" } }),
      prisma.userBadge.findMany({ where: { userId: req.user!.id } }),
    ]);
    const owned = new Map(mine.map((b) => [b.badgeId, b.earnedAt]));
    res.json({
      achievements: badges.map((b) => ({
        ...b,
        earned: owned.has(b.id),
        earnedAt: owned.get(b.id) ?? null,
      })),
    });
  }),
);

/** Active challenges with my progress. */
router.get(
  "/challenges",
  requireAuth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const challenges = await prisma.challenge.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: "asc" },
      include: { users: { where: { userId: req.user!.id } } },
    });
    res.json({
      challenges: challenges.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        metric: c.metric,
        target: c.target,
        xpReward: c.xpReward,
        creditReward: c.creditReward,
        endsAt: c.endsAt,
        progress: c.users[0]?.progress ?? 0,
        completedAt: c.users[0]?.completedAt ?? null,
      })),
    });
  }),
);

export default router;
