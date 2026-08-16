import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";

const router = Router();

router.get(
  "/balance",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { creditBalance: true },
    });
    res.json({ balance: user.creditBalance });
  }),
);

/** Full transaction history (the ledger), newest first. */
router.get(
  "/transactions",
  requireAuth,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const [total, transactions] = await Promise.all([
      prisma.creditTransaction.count({ where: { userId: req.user!.id } }),
      prisma.creditTransaction.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          booking: {
            select: {
              id: true,
              userSkill: { select: { skill: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);
    res.json({ transactions, total, page, pageSize });
  }),
);

export default router;
