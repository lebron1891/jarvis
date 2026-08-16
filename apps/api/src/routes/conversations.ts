import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { notify } from "../services/notifications";
import { getIO } from "../sockets";

const router = Router();

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, username: true, name: true, avatarUrl: true } },
  reactions: true,
} as const;

async function assertParticipant(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw ApiError.forbidden();
  return participant;
}

/** List my conversations with last message + unread count. */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const memberships = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatarUrl: true,
                    lastActiveAt: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: MESSAGE_INCLUDE,
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const unread = await prisma.message.count({
          where: {
            conversationId: m.conversationId,
            createdAt: { gt: m.lastReadAt },
            senderId: { not: userId },
            deletedAt: null,
          },
        });
        return {
          id: m.conversation.id,
          updatedAt: m.conversation.updatedAt,
          participants: m.conversation.participants.map((p) => p.user),
          lastMessage: m.conversation.messages[0] ?? null,
          unread,
        };
      }),
    );
    res.json({ conversations });
  }),
);

/** Open (or create) the 1:1 conversation with another user. */
router.post(
  "/",
  requireAuth,
  validate({ body: z.object({ userId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const meId = req.user!.id;
    const otherId = req.body.userId;
    if (otherId === meId) throw ApiError.badRequest("You cannot message yourself");
    const other = await prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, isBanned: true },
    });
    if (!other || other.isBanned) throw ApiError.notFound("User not found");

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: meId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
    });
    if (existing) return res.json({ conversationId: existing.id });

    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: [{ userId: meId }, { userId: otherId }] },
      },
    });
    res.status(201).json({ conversationId: conversation.id });
  }),
);

router.get(
  "/:id/messages",
  requireAuth,
  validate({
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(40),
    }),
  }),
  asyncHandler(async (req, res) => {
    await assertParticipant(req.params.id, req.user!.id);
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });
    const hasMore = messages.length > limit;
    const items = messages.slice(0, limit).reverse();
    res.json({ messages: items, nextCursor: hasMore ? items[0]?.id : null });
  }),
);

router.post(
  "/:id/messages",
  requireAuth,
  validate({
    body: z
      .object({
        type: z.enum(["TEXT", "IMAGE", "FILE", "VOICE"]).default("TEXT"),
        body: z.string().max(4000).optional(),
        fileUrl: z.string().url().optional(),
        fileName: z.string().max(200).optional(),
        durationSec: z.number().int().min(0).max(600).optional(),
      })
      .refine((m) => (m.type === "TEXT" ? !!m.body?.trim() : !!m.fileUrl), {
        message: "Message needs text or an attachment",
      }),
  }),
  asyncHandler(async (req, res) => {
    const conversationId = req.params.id;
    await assertParticipant(conversationId, req.user!.id);

    const message = await prisma.message.create({
      data: { conversationId, senderId: req.user!.id, ...req.body },
      include: MESSAGE_INCLUDE,
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    // Sender's own read marker advances with their message.
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: req.user!.id } },
      data: { lastReadAt: new Date() },
    });

    getIO()?.to(`convo:${conversationId}`).emit("message:new", message);

    const others = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: req.user!.id } },
    });
    for (const p of others) {
      await notify(
        p.userId,
        "MESSAGE",
        `New message from ${message.sender.name}`,
        message.type === "TEXT" ? (message.body ?? "").slice(0, 120) : `Sent a ${message.type.toLowerCase()}`,
        { conversationId },
      );
    }
    res.status(201).json({ message });
  }),
);

/** Toggle an emoji reaction on a message. */
router.post(
  "/messages/:messageId/reactions",
  requireAuth,
  validate({ body: z.object({ emoji: z.string().min(1).max(16) }) }),
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
    });
    if (!message) throw ApiError.notFound("Message not found");
    await assertParticipant(message.conversationId, req.user!.id);

    const key = {
      messageId: message.id,
      userId: req.user!.id,
      emoji: req.body.emoji,
    };
    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: key },
    });
    if (existing) {
      await prisma.messageReaction.delete({ where: { messageId_userId_emoji: key } });
    } else {
      await prisma.messageReaction.create({ data: key });
    }
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: message.id },
    });
    getIO()
      ?.to(`convo:${message.conversationId}`)
      .emit("message:reactions", { messageId: message.id, reactions });
    res.json({ reactions });
  }),
);

/** Mark the conversation read (drives read receipts). */
router.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertParticipant(req.params.id, req.user!.id);
    const now = new Date();
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user!.id },
      },
      data: { lastReadAt: now },
    });
    getIO()
      ?.to(`convo:${req.params.id}`)
      .emit("conversation:read", {
        conversationId: req.params.id,
        userId: req.user!.id,
        at: now.toISOString(),
      });
    res.json({ ok: true });
  }),
);

export default router;
