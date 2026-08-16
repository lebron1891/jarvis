import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { awardXp, bumpChallengeProgress, checkBadges } from "../services/gamification";
import { notify } from "../services/notifications";
import { XP_REWARDS } from "../utils/gamification";

const router = Router();

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      bookingId: z.string(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { bookingId, rating, comment } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw ApiError.notFound("Booking not found");
    if (booking.teacherId !== req.user!.id && booking.studentId !== req.user!.id) {
      throw ApiError.forbidden();
    }
    if (booking.status !== "COMPLETED") {
      throw ApiError.conflict("You can review a session once the exchange is complete");
    }
    const targetId =
      req.user!.id === booking.teacherId ? booking.studentId : booking.teacherId;

    const existing = await prisma.review.findUnique({
      where: { bookingId_authorId: { bookingId, authorId: req.user!.id } },
    });
    if (existing) throw ApiError.conflict("You already reviewed this session");

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { bookingId, authorId: req.user!.id, targetId, rating, comment },
        include: {
          author: { select: { username: true, name: true, avatarUrl: true } },
        },
      });
      const agg = await tx.review.aggregate({
        where: { targetId },
        _avg: { rating: true },
        _count: true,
      });
      await tx.user.update({
        where: { id: targetId },
        data: {
          ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100,
          ratingCount: agg._count,
        },
      });
      return created;
    });

    await awardXp(req.user!.id, XP_REWARDS.REVIEW_WRITTEN, "Writing a review");
    await bumpChallengeProgress(req.user!.id, "reviews_written");
    await checkBadges(targetId);
    await notify(
      targetId,
      "REVIEW",
      `New ${rating}★ review`,
      comment ? `“${comment.slice(0, 120)}”` : "You received a new rating.",
      { bookingId },
    );
    res.status(201).json({ review });
  }),
);

router.get(
  "/user/:userId",
  validate({
    query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
  }),
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { targetId: req.params.userId },
      orderBy: { createdAt: "desc" },
      take: (req.query as unknown as { limit: number }).limit,
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
