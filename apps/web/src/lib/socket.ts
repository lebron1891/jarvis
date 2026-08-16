"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL, tokenStore } from "./api";

let socket: Socket | null = null;

/** Lazily-connected singleton socket, authenticated with the access token. */
export function getSocket(): Socket | null {
  const token = tokenStore.access;
  if (!token) return null;
  if (socket?.connected) return socket;
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
  });
  socket.on("connect_error", () => {
    // Token may have rotated — pick up the fresh one on next attempt.
    if (socket) socket.auth = { token: tokenStore.access ?? "" };
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
