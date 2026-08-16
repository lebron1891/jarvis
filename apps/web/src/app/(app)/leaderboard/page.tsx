"use client";

import { Crown, Flame, Medal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/misc";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Metric = "xp" | "exchanges" | "streak" | "credits";

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: "xp", label: "XP" },
  { key: "exchanges", label: "Exchanges" },
  { key: "streak", label: "Streaks" },
  { key: "credits", label: "Credits" },
];

export default function LeaderboardPage() {
  const { user: me } = useAuth();
  const [metric, setMetric] = useState<Metric>("xp");
  const [rows, setRows] = useState<User[] | null>(null);

  useEffect(() => {
    setRows(null);
    apiGet<{ leaderboard: User[] }>(`/api/gamification/leaderboard?metric=${metric}&limit=50`)
      .then((d) => setRows(d.leaderboard))
      .catch(() => setRows([]));
  }, [metric]);

  const valueFor = (u: User) =>
    metric === "xp" ? `${u.xp} XP`
      : metric === "exchanges" ? `${u.completedExchanges}`
        : metric === "streak" ? `${u.streakCount} 🔥`
          : `${u.creditBalance} cr`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-zinc-500">The most generous teachers and hungriest learners.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 sm:w-fit">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none",
              metric === m.key
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((u, i) => (
            <Link
              key={u.id}
              href={`/profile/${u.username}`}
              className={cn(
                "flex items-center gap-4 px-5 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                me?.id === u.id && "bg-brand-50/60 dark:bg-brand-500/10",
              )}
            >
              <span className="w-8 text-center">
                {i === 0 ? (
                  <Crown className="mx-auto h-5 w-5 text-amber-400" />
                ) : i === 1 ? (
                  <Medal className="mx-auto h-5 w-5 text-zinc-400" />
                ) : i === 2 ? (
                  <Medal className="mx-auto h-5 w-5 text-amber-700" />
                ) : (
                  <span className="text-sm font-medium text-zinc-400">{i + 1}</span>
                )}
              </span>
              <Avatar name={u.name} src={u.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.name}
                  {me?.id === u.id && <span className="ml-2 text-xs text-brand-600">you</span>}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  @{u.username} · Level {u.level}
                  {u.country ? ` · ${u.country}` : ""}
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold">
                {metric === "streak" && u.streakCount > 0 && <Flame className="h-4 w-4 text-orange-500" />}
                {valueFor(u)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
