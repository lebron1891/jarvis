import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { notifyMany } from "../services/notifications";
import { slugify } from "./categories";

const router = Router();
router.use(requireRole("ADMIN", "MODERATOR"));

// --- Users -----------------------------------------------------------------

router.get(
  "/users",
  validate({
    query: z.object({
      q: z.string().max(80).optional(),
      banned: z.coerce.boolean().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { q, banned, page, pageSize } = req.query as unknown as {
      q?: string;
      banned?: boolean;
      page: number;
      pageSize: number;
    };
    const where = {
      ...(banned !== undefined ? { isBanned: banned } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { username: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatarUrl: true,
          role: true,
          plan: true,
          isBanned: true,
          banReason: true,
          emailVerified: true,
          verifiedTeacher: true,
          creditBalance: true,
          completedExchanges: true,
          ratingAvg: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
    ]);
    res.json({ users, total, page, pageSize });
  }),
);

router.post(
  "/users/:id/ban",
  validate({ body: z.object({ reason: z.string().min(3).max(500) }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: true, banReason: req.body.reason },
      select: { id: true, isBanned: true, banReason: true },
    });
    // Kill every active session.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ user });
  }),
);

router.post(
  "/users/:id/unban",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false, banReason: null },
      select: { id: true, isBanned: true },
    });
    res.json({ user });
  }),
);

router.patch(
  "/users/:id",
  requireRole("ADMIN"),
  validate({
    body: z.object({
      role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
      verifiedTeacher: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, role: true, verifiedTeacher: true },
    });
    res.json({ user });
  }),
);

// --- Reports / moderation ----------------------------------------------------

router.get(
  "/reports",
  validate({
    query: z.object({
      status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"),
    }),
  }),
  asyncHandler(async (req, res) => {
    const reports = await prisma.report.findMany({
      where: { status: (req.query as { status: "OPEN" | "RESOLVED" | "DISMISSED" }).status },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: { select: { username: true, name: true } },
        targetUser: { select: { id: true, username: true, name: true, isBanned: true } },
      },
    });
    res.json({ reports });
  }),
);

router.post(
  "/reports/:id/resolve",
  validate({ body: z.object({ action: z.enum(["RESOLVED", "DISMISSED"]) }) }),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        status: req.body.action,
        resolvedById: req.user!.id,
        resolvedAt: new Date(),
      },
    });
    res.json({ report });
  }),
);

/** Soft-delete a reported message. */
router.delete(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    await prisma.message.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), body: null, fileUrl: null },
    });
    res.json({ ok: true });
  }),
);

// --- Categories --------------------------------------------------------------

router.post(
  "/categories",
  validate({
    body: z.object({ name: z.string().min(2).max(50), icon: z.string().max(40).default("sparkles") }),
  }),
  asyncHandler(async (req, res) => {
    const slug = slugify(req.body.name);
    if (!slug) throw ApiError.badRequest("Invalid name");
    const category = await prisma.category.upsert({
      where: { slug },
      create: { name: req.body.name, slug, icon: req.body.icon, isCustom: false },
      update: { name: req.body.name, icon: req.body.icon, isCustom: false },
    });
    res.status(201).json({ category });
  }),
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// --- Announcements -------------------------------------------------------------

router.post(
  "/announcements",
  validate({
    body: z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(4000) }),
  }),
  asyncHandler(async (req, res) => {
    const announcement = await prisma.announcement.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    const users = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true },
    });
    await notifyMany(
      users.map((u) => u.id),
      "ANNOUNCEMENT",
      req.body.title,
      req.body.body,
      { announcementId: announcement.id },
    );
    res.status(201).json({ announcement, recipients: users.length });
  }),
);

// --- Analytics -----------------------------------------------------------------

router.get(
  "/analytics/overview",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const dayMs = 24 * 3600_000;
    const d7 = new Date(now.getTime() - 7 * dayMs);
    const d30 = new Date(now.getTime() - 30 * dayMs);

    const [
      totalUsers,
      newUsers30d,
      activeUsers7d,
      totalExchanges,
      exchanges30d,
      premiumUsers,
      openReports,
      messages7d,
      completedBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: d30 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: d7 } } }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.booking.count({ where: { status: "COMPLETED", updatedAt: { gte: d30 } } }),
      prisma.user.count({ where: { plan: "PREMIUM" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.message.count({ where: { createdAt: { gte: d7 } } }),
      prisma.booking.findMany({
        where: { status: "COMPLETED" },
        select: { startsAt: true, endsAt: true },
        take: 2000,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const avgSessionMinutes =
      completedBookings.length === 0
        ? 0
        : Math.round(
            completedBookings.reduce(
              (sum, b) => sum + (b.endsAt.getTime() - b.startsAt.getTime()) / 60_000,
              0,
            ) / completedBookings.length,
          );

    // Weekly signups over the past 8 weeks (growth curve).
    const signupsByWeek: Array<{ weekStart: string; count: number }> = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * dayMs);
      const end = new Date(now.getTime() - i * 7 * dayMs);
      const count = await prisma.user.count({
        where: { createdAt: { gte: start, lt: end } },
      });
      signupsByWeek.push({ weekStart: start.toISOString().slice(0, 10), count });
    }

    // 30-day retention: of users created 30-60 days ago, how many were active
    // in the last 30 days.
    const cohort = await prisma.user.count({
      where: { createdAt: { gte: new Date(now.getTime() - 60 * dayMs), lt: d30 } },
    });
    const retained = await prisma.user.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 60 * dayMs), lt: d30 },
        lastActiveAt: { gte: d30 },
      },
    });

    const popularSkills = await prisma.booking.groupBy({
      by: ["userSkillId"],
      where: { status: "COMPLETED" },
      _count: true,
      orderBy: { _count: { userSkillId: "desc" } },
      take: 8,
    });
    const skillDetails = await prisma.userSkill.findMany({
      where: { id: { in: popularSkills.map((p) => p.userSkillId) } },
      include: { skill: true },
    });
    const skillNames = new Map(skillDetails.map((s) => [s.id, s.skill.name]));

    res.json({
      totals: {
        users: totalUsers,
        newUsers30d,
        activeUsers7d,
        exchanges: totalExchanges,
        exchanges30d,
        premiumUsers,
        openReports,
        messages7d,
        avgSessionMinutes,
        monthlyRevenue: premiumUsers * 9.99,
        retention30d: cohort === 0 ? null : Math.round((retained / cohort) * 100),
      },
      signupsByWeek,
      popularSkills: popularSkills.map((p) => ({
        name: skillNames.get(p.userSkillId) ?? "Unknown",
        sessions: p._count,
      })),
    });
  }),
);

export default router;
