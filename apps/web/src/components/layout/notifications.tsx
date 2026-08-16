"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const TYPE_EMOJI: Record<string, string> = {
  MESSAGE: "💬",
  BOOKING: "📅",
  EXCHANGE: "🔁",
  REVIEW: "⭐",
  FOLLOW: "👋",
  AI: "🤖",
  ANNOUNCEMENT: "📣",
  ACHIEVEMENT: "🏅",
  SYSTEM: "🔔",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    apiGet<{ notifications: Notification[]; unreadCount: number }>("/api/notifications")
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unreadCount);
      })
      .catch(() => undefined);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;
    const onNew = (n: Notification) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await apiPost("/api/notifications/read-all").catch(() => undefined);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lift animate-fade-in dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-500"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">
                Nothing yet — go book a lesson!
              </p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 border-b border-zinc-50 px-4 py-3 text-sm dark:border-zinc-800/60",
                  !n.readAt && "bg-brand-50/50 dark:bg-brand-500/5",
                )}
              >
                <span className="text-lg">{TYPE_EMOJI[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-zinc-500 dark:text-zinc-400">{n.body}</p>
                  <p className="mt-1 text-xs text-zinc-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
