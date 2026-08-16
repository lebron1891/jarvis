import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";

const router = Router();

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ isCustom: "asc" }, { name: "asc" }],
      include: { _count: { select: { skills: true } } },
    });
    res.json({ categories });
  }),
);

/** Members can propose custom categories; they are flagged isCustom. */
router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({ name: z.string().min(2).max(50), icon: z.string().max(40).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const slug = slugify(req.body.name);
    if (!slug) throw ApiError.badRequest("Invalid category name");
    const existing = await prisma.category.findFirst({
      where: { OR: [{ slug }, { name: req.body.name }] },
    });
    if (existing) return res.json({ category: existing });
    const category = await prisma.category.create({
      data: {
        name: req.body.name,
        slug,
        icon: req.body.icon ?? "sparkles",
        isCustom: req.user!.role === "ADMIN" ? false : true,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ category });
  }),
);

export default router;
