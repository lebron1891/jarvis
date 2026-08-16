import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { applyLedgerEntry } from "../services/credits";
import {
  awardXp,
  bumpChallengeProgress,
  checkBadges,
  touchStreak,
} from "../services/gamification";
import { notify } from "../services/notifications";
import { creditsForBooking, XP_REWARDS } from "../utils/gamification";

const router = Router();

const BOOKING_INCLUDE = {
  userSkill: { include: { skill: { include: { category: true } } } },
  teacher: {
    select: { id: true, username: true, name: true, avatarUrl: true, timezone: true },
  },
  student: {
    select: { id: true, username: true, name: true, avatarUrl: true, timezone: true },
  },
} as const;

async function getBookingForParticipant(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: BOOKING_INCLUDE,
  });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.teacherId !== userId && booking.studentId !== userId) {
    throw ApiError.forbidden();
  }
  return booking;
}

// ---------------------------------------------------------------------------

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      userSkillId: z.string(),
      startsAt: z.coerce.date(),
      durationMinutes: z.number().int().min(30).max(240),
      mode: z.enum(["ONLINE", "IN_PERSON"]).default("ONLINE"),
      notes: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { userSkillId, startsAt, durationMinutes, mode, notes } = req.body;
    if (startsAt.getTime() < Date.now()) {
      throw ApiError.badRequest("Sessions must be booked in the future");
    }

    const offer = await prisma.userSkill.findUnique({
      where: { id: userSkillId },
      include: { skill: true, user: { select: { id: true, name: true, isBanned: true } } },
    });
    if (!offer || offer.kind !== "TEACH" || !offer.active || offer.user.isBanned) {
      throw ApiError.notFound("This lesson offer is no longer available");
    }
    if (offer.userId === req.user!.id) {
      throw ApiError.badRequest("You cannot book your own lesson");
    }

    const credits = creditsForBooking(durationMinutes, offer.hourlyCredits);
    const student = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { creditBalance: true, name: true },
    });
    if (student.creditBalance < credits) {
      throw ApiError.conflict(
        `This session costs ${credits} credit(s) but you only have ${student.creditBalance}. Teach a lesson to earn more!`,
      );
    }

    const booking = await prisma.booking.create({
      data: {
        teacherId: offer.userId,
        studentId: req.user!.id,
        userSkillId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
        credits,
        mode,
        notes,
      },
      include: BOOKING_INCLUDE,
    });

    await notify(
      offer.userId,
      "BOOKING",
      "New session request 📩",
      `${student.name} wants to learn ${offer.skill.name} (${credits} credit${credits > 1 ? "s" : ""}).`,
      { bookingId: booking.id },
    );
    res.status(201).json({ booking });
  }),
);

router.get(
  "/mine",
  requireAuth,
  validate({
    query: z.object({
      role: z.enum(["teacher", "student", "all"]).default("all"),
      status: z
        .enum(["PENDING", "CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED"])
        .optional(),
      upcoming: z.coerce.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { role, status, upcoming } = req.query as unknown as {
      role: "teacher" | "student" | "all";
      status?: "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED";
      upcoming?: boolean;
    };
    const userId = req.user!.id;
    const bookings = await prisma.booking.findMany({
      where: {
        ...(role === "teacher"
          ? { teacherId: userId }
          : role === "student"
            ? { studentId: userId }
            : { OR: [{ teacherId: userId }, { studentId: userId }] }),
        ...(status ? { status } : {}),
        ...(upcoming ? { endsAt: { gte: new Date() } } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      include: BOOKING_INCLUDE,
    });
    res.json({ bookings });
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForParticipant(req.params.id, req.user!.id);
    res.json({ booking });
  }),
);

/** Teacher accepts: the student's credits move into escrow (debited now). */
router.post(
  "/:id/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForParticipant(req.params.id, req.user!.id);
    if (booking.teacherId !== req.user!.id) throw ApiError.forbidden("Only the teacher can accept");
    if (booking.status !== "PENDING") throw ApiError.conflict("This request was already handled");

    const updated = await prisma.$transaction(async (tx) => {
      await applyLedgerEntry(tx, {
        userId: booking.studentId,
        amount: -booking.credits,
        type: "EXCHANGE_SPEND",
        bookingId: booking.id,
        description: `Booked: ${booking.userSkill.skill.name} with ${booking.teacher.name}`,
      });
      return tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED" },
        include: BOOKING_INCLUDE,
      });
    });

    await notify(
      booking.studentId,
      "BOOKING",
      "Session confirmed ✅",
      `${booking.teacher.name} accepted your ${booking.userSkill.skill.name} session.`,
      { bookingId: booking.id },
    );
    res.json({ booking: updated });
  }),
);

router.post(
  "/:id/decline",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForParticipant(req.params.id, req.user!.id);
    if (booking.teacherId !== req.user!.id) throw ApiError.forbidden("Only the teacher can decline");
    if (booking.status !== "PENDING") throw ApiError.conflict("This request was already handled");
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "DECLINED" },
      include: BOOKING_INCLUDE,
    });
    await notify(
      booking.studentId,
      "BOOKING",
      "Session declined",
      `${booking.teacher.name} can't make your ${booking.userSkill.skill.name} session. Try another time slot.`,
      { bookingId: booking.id },
    );
    res.json({ booking: updated });
  }),
);

/** Either side cancels. Confirmed sessions refund the student in full. */
router.post(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForParticipant(req.params.id, req.user!.id);
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      throw ApiError.conflict("This booking can no longer be cancelled");
    }
    const cancellerId = req.user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      if (booking.status === "CONFIRMED") {
        await applyLedgerEntry(tx, {
          userId: booking.studentId,
          amount: booking.credits,
          type: "REFUND",
          bookingId: booking.id,
          description: `Refund: cancelled ${booking.userSkill.skill.name} session`,
        });
        // Late cancellations chip away at reliability.
        await tx.user.update({
          where: { id: cancellerId },
          data: { reliabilityScore: { decrement: 5 } },
        });
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledById: cancellerId },
        include: BOOKING_INCLUDE,
      });
    });

    const otherId = cancellerId === booking.teacherId ? booking.studentId : booking.teacherId;
    await notify(
      otherId,
      "BOOKING",
      "Session cancelled",
      `Your ${booking.userSkill.skill.name} session was cancelled.${booking.status === "CONFIRMED" ? " Credits were refunded." : ""}`,
      { bookingId: booking.id },
    );
    res.json({ booking: updated });
  }),
);

/**
 * Exchange confirmation: both participants confirm completion. On the second
 * confirmation the teacher is paid and stats, XP, streaks and badges update.
 */
router.post(
  "/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await getBookingForParticipant(req.params.id, req.user!.id);
    if (booking.status !== "CONFIRMED") {
      throw ApiError.conflict("Only confirmed sessions can be completed");
    }
    if (booking.startsAt.getTime() > Date.now()) {
      throw ApiError.conflict("You can confirm completion once the session has started");
    }

    const isTeacher = req.user!.id === booking.teacherId;
    const teacherConfirmed = booking.teacherConfirmed || isTeacher;
    const studentConfirmed = booking.studentConfirmed || !isTeacher;
    const bothConfirmed = teacherConfirmed && studentConfirmed;

    const updated = await prisma.$transaction(async (tx) => {
      if (bothConfirmed) {
        await applyLedgerEntry(tx, {
          userId: booking.teacherId,
          amount: booking.credits,
          type: "EXCHANGE_EARN",
          bookingId: booking.id,
          description: `Taught: ${booking.userSkill.skill.name} to ${booking.student.name}`,
        });
        await tx.user.update({
          where: { id: booking.teacherId },
          data: { completedExchanges: { increment: 1 }, sessionsTaught: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: booking.studentId },
          data: { completedExchanges: { increment: 1 }, sessionsLearned: { increment: 1 } },
        });
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          teacherConfirmed,
          studentConfirmed,
          ...(bothConfirmed ? { status: "COMPLETED" as const } : {}),
        },
        include: BOOKING_INCLUDE,
      });
    });

    if (bothConfirmed) {
      await awardXp(booking.teacherId, XP_REWARDS.SESSION_TAUGHT, "Teaching a session");
      await awardXp(booking.studentId, XP_REWARDS.SESSION_LEARNED, "Completing a lesson");
      await Promise.all([
        touchStreak(booking.teacherId),
        touchStreak(booking.studentId),
        bumpChallengeProgress(booking.teacherId, "sessions_taught"),
        bumpChallengeProgress(booking.studentId, "sessions_learned"),
      ]);
      await Promise.all([checkBadges(booking.teacherId), checkBadges(booking.studentId)]);
      await notify(
        booking.teacherId,
        "EXCHANGE",
        `+${booking.credits} credit${booking.credits > 1 ? "s" : ""} earned 🎉`,
        `Exchange complete: ${booking.userSkill.skill.name} with ${booking.student.name}.`,
        { bookingId: booking.id },
      );
      await notify(
        booking.studentId,
        "EXCHANGE",
        "Exchange complete 🎉",
        `Hope you enjoyed ${booking.userSkill.skill.name}! Leave ${booking.teacher.name} a review.`,
        { bookingId: booking.id },
      );
    } else {
      const otherId = isTeacher ? booking.studentId : booking.teacherId;
      await notify(
        otherId,
        "EXCHANGE",
        "Confirmation needed",
        `Your partner marked the ${booking.userSkill.skill.name} session as done — please confirm.`,
        { bookingId: booking.id },
      );
    }
    res.json({ booking: updated });
  }),
);

export default router;
