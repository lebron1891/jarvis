import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { slugify } from "./categories";

const router = Router();

router.get(
  "/",
  validate({
    query: z.object({
      q: z.string().max(80).optional(),
      categoryId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { q, categoryId, limit } = req.query as unknown as {
      q?: string;
      categoryId?: string;
      limit: number;
    };
    const skills = await prisma.skill.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      take: limit,
      orderBy: { name: "asc" },
      include: {
        category: true,
        _count: { select: { userSkills: { where: { kind: "TEACH", active: true } } } },
      },
    });
    res.json({ skills });
  }),
);

/** Create a skill inside a category (deduplicated by slug). */
router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({ name: z.string().min(2).max(60), categoryId: z.string() }),
  }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { id: req.body.categoryId },
    });
    if (!category) throw ApiError.notFound("Category not found");
    const slug = slugify(req.body.name);
    if (!slug) throw ApiError.badRequest("Invalid skill name");
    const existing = await prisma.skill.findUnique({
      where: { slug },
      include: { category: true },
    });
    if (existing) return res.json({ skill: existing });
    const skill = await prisma.skill.create({
      data: { name: req.body.name, slug, categoryId: category.id },
      include: { category: true },
    });
    res.status(201).json({ skill });
  }),
);

export default router;
