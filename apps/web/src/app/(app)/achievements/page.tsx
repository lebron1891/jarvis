"use client";

import { Award, Lock, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import { apiGet } from "@/lib/api";
import type { Achievement, Challenge } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);

  useEffect(() => {
    apiGet<{ achievements: Achievement[] }>("/api/gamification/achievements")
      .then((d) => setAchievements(d.achievements))
      .catch(() => setAchievements([]));
    apiGet<{ challenges: Challenge[] }>("/api/gamification/challenges")
      .then((d) => setChallenges(d.challenges))
      .catch(() => setChallenges([]));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="mt-1 text-zinc-500">Badges you&apos;ve unlocked and challenges in progress.</p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Target className="h-4 w-4 text-brand-500" /> Active challenges
        </h2>
        {challenges === null ? (
          <Skeleton className="h-32" />
        ) : challenges.length === 0 ? (
          <p className="text-sm text-zinc-400">No active challenges right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {challenges.map((c) => {
              const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
              return (
                <div key={c.id} className="card p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                    <span className="text-xs font-medium text-brand-600">+{c.xpReward} XP</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{c.description}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        c.completedAt ? "bg-emerald-500" : "bg-gradient-to-r from-brand-500 to-violet-500",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-xs text-zinc-400">
                    {c.completedAt ? "Completed 🎉" : `${c.progress}/${c.target} · ends ${formatDate(c.endsAt)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Award className="h-4 w-4 text-brand-500" /> Badges
        </h2>
        {achievements === null ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "card flex items-center gap-4 p-5 transition",
                  !a.earned && "opacity-55 grayscale",
                )}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
                    a.tier >= 3
                      ? "bg-gradient-to-br from-amber-400 to-orange-500"
                      : a.tier === 2
                        ? "bg-gradient-to-br from-brand-500 to-violet-600"
                        : "bg-gradient-to-br from-zinc-400 to-zinc-500",
                  )}
                >
                  {a.earned ? <Award className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-zinc-500">{a.description}</p>
                  {a.earned && a.earnedAt && (
                    <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      Earned {formatDate(a.earnedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
