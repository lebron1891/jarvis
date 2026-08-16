import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { awardXp, checkBadges } from "../services/gamification";
import { notify } from "../services/notifications";
import { XP_REWARDS } from "../utils/gamification";
import { PUBLIC_USER_SELECT } from "./auth";

const router = Router();

const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(2000).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  timezone: z.string().max(60).optional(),
  languages: z.array(z.string().max(40)).max(10).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  profileTheme: z.string().max(30).optional(),
});

const availabilitySchema = z.array(
  z
    .object({
      dayOfWeek: z.number().int().min(0).max(6),
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(1).max(1440),
    })
    .refine((s) => s.endMinute > s.startMinute, {
      message: "End must be after start",
    }),
);

const userSkillSchema = z.object({
  skillId: z.string(),
  kind: z.enum(["TEACH", "LEARN"]),
  headline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  yearsOfExp: z.number().int().min(0).max(80).default(0),
  mode: z.enum(["ONLINE", "IN_PERSON", "BOTH"]).default("ONLINE"),
});

router.patch(
  "/me",
  requireAuth,
  validate({ body: profileSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: req.body,
      select: PUBLIC_USER_SELECT,
    });
    await checkBadges(user.id); // POLYGLOT can unlock from languages
    res.json({ user });
  }),
);

/** Onboarding: profile basics + teach/learn skills + weekly availability. */
router.post(
  "/me/onboarding",
  requireAuth,
  validate({
    body: z.object({
      profile: profileSchema.default({}),
      skills: z.array(userSkillSchema).max(20).default([]),
      availability: availabilitySchema.default([]),
    }),
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { profile, skills, availability } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { ...profile, onboardingDone: true },
      });
      for (const s of skills) {
        await tx.userSkill.upsert({
          where: {
            userId_skillId_kind: { userId, skillId: s.skillId, kind: s.kind },
          },
          create: { userId, ...s },
          update: { ...s, active: true },
        });
      }
      if (availability.length > 0) {
        await tx.availabilitySlot.deleteMany({ where: { userId } });
        await tx.availabilitySlot.createMany({
          data: (availability as z.infer<typeof availabilitySchema>).map((a) => ({
            userId,
            ...a,
          })),
        });
      }
    });

    await awardXp(userId, XP_REWARDS.ONBOARDING_DONE, "Completing onboarding");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ user });
  }),
);

router.put(
  "/me/availability",
  requireAuth,
  validate({ body: z.object({ slots: availabilitySchema }) }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await prisma.$transaction([
      prisma.availabilitySlot.deleteMany({ where: { userId } }),
      prisma.availabilitySlot.createMany({
        data: req.body.slots.map((a: { dayOfWeek: number; startMinute: number; endMinute: number }) => ({
          userId,
          ...a,
        })),
      }),
    ]);
    const slots = await prisma.availabilitySlot.findMany({ where: { userId } });
    res.json({ slots });
  }),
);

// --- My skills -------------------------------------------------------------

router.post(
  "/me/skills",
  requireAuth,
  validate({ body: userSkillSchema }),
  asyncHandler(async (req, res) => {
    const skill = await prisma.skill.findUnique({ where: { id: req.body.skillId } });
    if (!skill) throw ApiError.notFound("Skill not found");
    const userSkill = await prisma.userSkill.upsert({
      where: {
        userId_skillId_kind: {
          userId: req.user!.id,
          skillId: req.body.skillId,
          kind: req.body.kind,
        },
      },
      create: { userId: req.user!.id, ...req.body },
      update: { ...req.body, active: true },
      include: { skill: { include: { category: true } } },
    });
    res.status(201).json({ userSkill });
  }),
);

router.delete(
  "/me/skills/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await prisma.userSkill.findUnique({ where: { id: req.params.id } });
    if (!found || found.userId !== req.user!.id) throw ApiError.notFound();
    await prisma.userSkill.update({
      where: { id: found.id },
      data: { active: false },
    });
    res.json({ ok: true });
  }),
);

// --- Follows ---------------------------------------------------------------

router.post(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user!.id) throw ApiError.badRequest("You cannot follow yourself");
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true },
    });
    if (!target) throw ApiError.notFound("User not found");
    const follower = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { name: true, username: true },
    });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.user!.id, followingId: targetId } },
      create: { followerId: req.user!.id, followingId: targetId },
      update: {},
    });
    await notify(
      targetId,
      "FOLLOW",
      "New follower 👋",
      `${follower.name} (@${follower.username}) started following you.`,
      { userId: req.user!.id },
    );
    res.json({ following: true });
  }),
);

router.delete(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.follow.deleteMany({
      where: { followerId: req.user!.id, followingId: req.params.id },
    });
    res.json({ following: false });
  }),
);

// --- Public profile --------------------------------------------------------

router.get(
  "/:username",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username.toLowerCase() },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        country: true,
        timezone: true,
        languages: true,
        plan: true,
        profileTheme: true,
        verifiedTeacher: true,
        xp: true,
        level: true,
        streakCount: true,
        ratingAvg: true,
        ratingCount: true,
        completedExchanges: true,
        sessionsTaught: true,
        sessionsLearned: true,
        reliabilityScore: true,
        createdAt: true,
        isBanned: true,
        skills: {
          where: { active: true },
          include: { skill: { include: { category: true } } },
        },
        availability: true,
        badges: { include: { badge: true } },
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user || user.isBanned) throw ApiError.notFound("User not found");

    let isFollowing = false;
    if (req.user) {
      isFollowing = !!(await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: req.user.id, followingId: user.id },
        },
      }));
    }
    const { isBanned: _hidden, ...publicUser } = user;
    res.json({ user: publicUser, isFollowing });
  }),
);

router.get(
  "/:username/reviews",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw ApiError.notFound("User not found");
    const reviews = await prisma.review.findMany({
      where: { targetId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { username: true, name: true, avatarUrl: true } },
        booking: {
          select: { userSkill: { select: { skill: { select: { name: true } } } } },
        },
      },
    });
    res.json({ reviews });
  }),
);

export default router;
