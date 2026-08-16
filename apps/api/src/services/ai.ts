import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/error";

const client = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : undefined;

const SYSTEM_PROMPT = `You are the SkillSwap learning assistant. SkillSwap is a platform where
people exchange skills instead of money — one hour taught equals one credit.
Be encouraging, practical and concise. Format answers in clean Markdown.`;

export type AiKind =
  | "lesson-plan"
  | "quiz"
  | "summarize"
  | "correct"
  | "recommend"
  | "learning-path"
  | "translate";

const KIND_INSTRUCTIONS: Record<AiKind, string> = {
  "lesson-plan":
    "Create a structured one-hour lesson plan: objectives, warm-up, 3-4 core activities with timings, practice exercise, and homework.",
  quiz: "Create a quiz with 8 questions (mix of multiple choice and open questions). Put an answer key at the end.",
  summarize:
    "Summarize the following lesson notes into key takeaways, concepts to review, and suggested next steps.",
  correct:
    "Correct the following exercise. Point out each mistake, explain why it is wrong, and show the corrected version.",
  recommend:
    "Given the learner profile and the available teachers below, recommend the best matches and explain why in 1-2 sentences each.",
  "learning-path":
    "Design a progressive learning path (beginner → advanced) with milestones, estimated hours, and how to use 1-credit SkillSwap sessions along the way.",
  translate:
    "Translate the following message. Keep tone and formatting. Reply with the translation only.",
};

/**
 * Enforces the daily AI quota for free users, records usage, and returns the
 * assistant's answer. Premium users get unlimited assistance.
 */
export async function runAssistant(
  user: { id: string; plan: string },
  kind: AiKind,
  input: string,
): Promise<{ output: string; remainingToday: number | null }> {
  if (user.plan !== "PREMIUM") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usedToday = await prisma.aiUsage.count({
      where: { userId: user.id, createdAt: { gte: startOfDay } },
    });
    if (usedToday >= env.AI_FREE_DAILY_LIMIT) {
      throw ApiError.paymentRequired(
        `Free plan includes ${env.AI_FREE_DAILY_LIMIT} AI requests per day. Upgrade to Premium for unlimited AI assistance.`,
      );
    }
  }

  const output = await generate(kind, input);
  await prisma.aiUsage.create({ data: { userId: user.id, kind } });

  let remainingToday: number | null = null;
  if (user.plan !== "PREMIUM") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const used = await prisma.aiUsage.count({
      where: { userId: user.id, createdAt: { gte: startOfDay } },
    });
    remainingToday = Math.max(0, env.AI_FREE_DAILY_LIMIT - used);
  }
  return { output, remainingToday };
}

async function generate(kind: AiKind, input: string): Promise<string> {
  if (!client) {
    return [
      "> **AI assistant is not configured.**",
      "",
      "Set `ANTHROPIC_API_KEY` on the server to enable live AI responses.",
      "",
      `In the meantime, here is what I would do for a **${kind}** request:`,
      `- Task: ${KIND_INSTRUCTIONS[kind]}`,
      `- Your input: "${input.slice(0, 200)}${input.length > 200 ? "…" : ""}"`,
    ].join("\n");
  }

  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${KIND_INSTRUCTIONS[kind]}\n\n---\n\n${input}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return "I can't help with that request. Try rephrasing it or ask about something else.";
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
