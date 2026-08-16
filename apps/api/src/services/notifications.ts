import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIO, userRoom } from "../sockets";

/**
 * Persists a notification and pushes it over the socket so connected clients
 * see it instantly (badge counts, toasts, push-style banners).
 */
export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Prisma.InputJsonValue,
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });
  getIO()?.to(userRoom(userId)).emit("notification:new", notification);
  return notification;
}

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Prisma.InputJsonValue,
) {
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, data })),
  });
  const io = getIO();
  if (io) {
    for (const id of userIds) {
      io.to(userRoom(id)).emit("notification:new", { type, title, body, data });
    }
  }
}
