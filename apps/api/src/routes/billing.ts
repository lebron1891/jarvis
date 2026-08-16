import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { notify } from "../services/notifications";

const router = Router();
router.use(requireAuth);

/**
 * Premium subscription (payment-provider agnostic).
 * Wire a real provider (Stripe, Paddle…) by calling these endpoints from your
 * webhook handler once payment succeeds.
 */

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { plan: true, premiumUntil: true },
    });
    res.json(user);
  }),
);

router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const premiumUntil = new Date(Date.now() + 30 * 24 * 3600_000);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { plan: "PREMIUM", premiumUntil },
      select: { plan: true, premiumUntil: true },
    });
    await notify(
      req.user!.id,
      "SYSTEM",
      "Welcome to Premium ✨",
      "Unlimited AI assistance, priority ranking and exclusive badges are now unlocked.",
    );
    res.json(user);
  }),
);

router.post(
  "/cancel",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { plan: "FREE", premiumUntil: null },
      select: { plan: true, premiumUntil: true },
    });
    res.json(user);
  }),
);

export default router;
