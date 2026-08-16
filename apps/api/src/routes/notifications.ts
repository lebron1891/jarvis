import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";

const router = Router();

router.get(
  "/",
  requireAuth,
  validate({
    query: z.object({
      unreadOnly: z.coerce.boolean().default(false),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { unreadOnly, limit } = req.query as unknown as {
      unreadOnly: boolean;
      limit: number;
    };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    res.json({ notifications, unreadCount });
  }),
);

router.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

export default router;
