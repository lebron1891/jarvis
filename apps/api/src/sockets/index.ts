import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../utils/tokens";

let io: Server | undefined;

export function getIO(): Server | undefined {
  return io;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

/**
 * Realtime gateway. Handles:
 *  - per-user notification rooms
 *  - conversation rooms (typing indicators, live messages)
 *  - WebRTC signaling + whiteboard sync for video sessions
 */
export function initSockets(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    // Presence heartbeat (fire and forget)
    prisma.user
      .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);

    socket.on("conversation:join", (conversationId: string) => {
      if (typeof conversationId === "string") socket.join(`convo:${conversationId}`);
    });
    socket.on("conversation:leave", (conversationId: string) => {
      if (typeof conversationId === "string") socket.leave(`convo:${conversationId}`);
    });
    socket.on(
      "typing",
      (payload: { conversationId: string; isTyping: boolean }) => {
        if (!payload?.conversationId) return;
        socket.to(`convo:${payload.conversationId}`).emit("typing", {
          conversationId: payload.conversationId,
          userId,
          isTyping: !!payload.isTyping,
        });
      },
    );

    // --- WebRTC signaling -------------------------------------------------
    socket.on("rtc:join", (roomId: string) => {
      if (typeof roomId !== "string") return;
      const room = `session:${roomId}`;
      socket.join(room);
      socket.to(room).emit("rtc:peer-joined", { peerId: socket.id, userId });
    });

    socket.on("rtc:leave", (roomId: string) => {
      if (typeof roomId !== "string") return;
      const room = `session:${roomId}`;
      socket.leave(room);
      socket.to(room).emit("rtc:peer-left", { peerId: socket.id });
    });

    // Direct peer-to-peer relay: offers, answers and ICE candidates.
    socket.on(
      "rtc:signal",
      (payload: { to: string; roomId: string; data: unknown }) => {
        if (!payload?.to) return;
        io?.to(payload.to).emit("rtc:signal", {
          from: socket.id,
          userId,
          data: payload.data,
        });
      },
    );

    // --- Collaborative whiteboard ----------------------------------------
    socket.on(
      "whiteboard:draw",
      (payload: { roomId: string; stroke: unknown }) => {
        if (!payload?.roomId) return;
        socket.to(`session:${payload.roomId}`).emit("whiteboard:draw", {
          userId,
          stroke: payload.stroke,
        });
      },
    );
    socket.on("whiteboard:clear", (roomId: string) => {
      if (typeof roomId !== "string") return;
      socket.to(`session:${roomId}`).emit("whiteboard:clear");
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("session:")) {
          socket.to(room).emit("rtc:peer-left", { peerId: socket.id });
        }
      }
    });
  });

  return io;
}
