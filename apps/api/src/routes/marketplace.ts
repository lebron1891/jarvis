import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";

const router = Router();

const searchSchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().optional(), // category slug
  language: z.string().max(40).optional(),
  mode: z.enum(["ONLINE", "IN_PERSON"]).optional(),
  country: z.string().max(60).optional(),
  sort: z.enum(["rating", "popularity", "newest", "distance"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

/**
 * Teacher marketplace search. "distance" sorts same-country teachers first
 * (viewer's country when signed in, otherwise the provided country filter).
 */
router.get(
  "/teachers",
  optionalAuth,
  validate({ query: searchSchema }),
  asyncHandler(async (req, res) => {
    const { q, category, language, mode, country, sort, page, pageSize } =
      req.query as unknown as z.infer<typeof searchSchema>;

    const where: Prisma.UserSkillWhereInput = {
      kind: "TEACH",
      active: true,
      user: {
        isBanned: false,
        ...(language ? { languages: { has: language } } : {}),
        ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
      },
      ...(mode ? { mode: { in: [mode, "BOTH"] } } : {}),
      ...(q
        ? {
            OR: [
              { skill: { name: { contains: q, mode: "insensitive" } } },
              { headline: { contains: q, mode: "insensitive" } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { username: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(category ? { skill: { category: { slug: category } } } : {}),
    };

    const orderBy: Prisma.UserSkillOrderByWithRelationInput[] =
      sort === "popularity"
        ? [{ user: { completedExchanges: "desc" } }, { user: { ratingAvg: "desc" } }]
        : sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ user: { ratingAvg: "desc" } }, { user: { ratingCount: "desc" } }];

    const [total, results] = await Promise.all([
      prisma.userSkill.count({ where }),
      prisma.userSkill.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          skill: { include: { category: true } },
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
              country: true,
              languages: true,
              verifiedTeacher: true,
              level: true,
              ratingAvg: true,
              ratingCount: true,
              completedExchanges: true,
              lastActiveAt: true,
            },
          },
        },
      }),
    ]);

    // Nearby-first: stable partition by viewer country without SQL gymnastics.
    let items = results;
    const homeCountry =
      sort === "distance"
        ? country ??
          (req.user
            ? (
                await prisma.user.findUnique({
                  where: { id: req.user.id },
                  select: { country: true },
                })
              )?.country
            : undefined)
        : undefined;
    if (homeCountry) {
      items = [
        ...results.filter((r) => r.user.country === homeCountry),
        ...results.filter((r) => r.user.country !== homeCountry),
      ];
    }

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

/** Featured teachers for the landing page / dashboard. */
router.get(
  "/featured",
  asyncHandler(async (_req, res) => {
    const items = await prisma.userSkill.findMany({
      where: { kind: "TEACH", active: true, user: { isBanned: false } },
      orderBy: [{ user: { ratingAvg: "desc" } }, { user: { completedExchanges: "desc" } }],
      take: 6,
      include: {
        skill: { include: { category: true } },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
            country: true,
            verifiedTeacher: true,
            level: true,
            ratingAvg: true,
            ratingCount: true,
            completedExchanges: true,
          },
        },
      },
    });
    res.json({ items });
  }),
);

export default router;
