import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";

const router = Router();

/** Report a user or a specific message for moderation. */
router.post(
  "/",
  requireAuth,
  validate({
    body: z
      .object({
        targetUserId: z.string().optional(),
        messageId: z.string().optional(),
        reason: z.enum([
          "spam",
          "harassment",
          "inappropriate_content",
          "scam",
          "no_show",
          "other",
        ]),
        details: z.string().max(2000).optional(),
      })
      .refine((r) => r.targetUserId || r.messageId, {
        message: "Report a user or a message",
      }),
  }),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.create({
      data: { reporterId: req.user!.id, ...req.body },
    });
    res.status(201).json({ report });
  }),
);

export default router;
