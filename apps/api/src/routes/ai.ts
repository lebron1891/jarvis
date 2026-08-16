import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { aiLimiter } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { type AiKind, runAssistant } from "../services/ai";

const router = Router();
router.use(requireAuth, aiLimiter);

const promptSchema = z.object({ input: z.string().min(1).max(8000) });

function aiEndpoint(kind: AiKind) {
  return [
    validate({ body: promptSchema }),
    asyncHandler(
      async (req: import("express").Request, res: import("express").Response) => {
        const result = await runAssistant(req.user!, kind, req.body.input);
        res.json(result);
      },
    ),
  ];
}

router.post("/lesson-plan", ...aiEndpoint("lesson-plan"));
router.post("/quiz", ...aiEndpoint("quiz"));
router.post("/summarize", ...aiEndpoint("summarize"));
router.post("/correct", ...aiEndpoint("correct"));
router.post("/learning-path", ...aiEndpoint("learning-path"));
router.post("/translate", ...aiEndpoint("translate"));

/** Teacher recommendations: augments the prompt with live marketplace data. */
router.post(
  "/recommend",
  validate({ body: promptSchema }),
  asyncHandler(async (req, res) => {
    const teachers = await prisma.userSkill.findMany({
      where: { kind: "TEACH", active: true, user: { isBanned: false } },
      orderBy: [{ user: { ratingAvg: "desc" } }],
      take: 25,
      include: {
        skill: { include: { category: true } },
        user: {
          select: {
            username: true,
            name: true,
            country: true,
            languages: true,
            ratingAvg: true,
            ratingCount: true,
            completedExchanges: true,
          },
        },
      },
    });
    const catalog = teachers
      .map(
        (t) =>
          `- @${t.user.username} (${t.user.name}) teaches ${t.skill.name} [${t.skill.category.name}] — ★${t.user.ratingAvg} (${t.user.ratingCount} reviews), ${t.user.completedExchanges} exchanges, languages: ${t.user.languages.join(", ") || "n/a"}, country: ${t.user.country ?? "n/a"}`,
      )
      .join("\n");
    const result = await runAssistant(
      req.user!,
      "recommend",
      `Learner request: ${req.body.input}\n\nAvailable teachers:\n${catalog}`,
    );
    res.json(result);
  }),
);

export default router;
