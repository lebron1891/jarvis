"use client";

import {
  ArrowRight,
  Calendar,
  Coins,
  Flame,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pill, statusTone } from "@/components/ui/badge";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/misc";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Booking, Challenge, TeacherResult } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface GamificationMe {
  xp: number;
  level: number;
  nextLevelXp: number;
  levelProgress: number;
  streak: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [game, setGame] = useState<GamificationMe | null>(null);
  const [featured, setFeatured] = useState<TeacherResult[] | null>(null);

  useEffect(() => {
    apiGet<{ bookings: Booking[] }>("/api/bookings/mine?upcoming=true")
      .then((d) => setBookings(d.bookings.filter((b) => ["PENDING", "CONFIRMED"].includes(b.status)).slice(0, 4)))
      .catch(() => setBookings([]));
    apiGet<{ challenges: Challenge[] }>("/api/gamification/challenges")
      .then((d) => setChallenges(d.challenges.slice(0, 3)))
      .catch(() => setChallenges([]));
    apiGet<GamificationMe>("/api/gamification/me").then(setGame).catch(() => undefined);
    apiGet<{ items: TeacherResult[] }>("/api/marketplace/featured")
      .then((d) => setFeatured(d.items.slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hey {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-zinc-500">Ready to swap some skills today?</p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-500"
        >
          Find a teacher <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Credit balance"
          value={user.creditBalance}
          hint="1 credit = 1 hour of learning"
          icon={<Coins className="h-5 w-5" />}
        />
        <StatTile
          label="Level"
          value={
            <span>
              {game?.level ?? user.level}
              <span className="ml-2 align-middle text-xs font-normal text-zinc-400">
                {game ? `${game.xp} XP` : ""}
              </span>
            </span>
          }
          hint={game ? `${Math.round(game.levelProgress * 100)}% to level ${game.level + 1}` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatTile
          label="Daily streak"
          value={`${game?.streak ?? user.streakCount} days`}
          hint="Complete sessions to keep it alive"
          icon={<Flame className="h-5 w-5" />}
        />
        <StatTile
          label="Exchanges"
          value={user.completedExchanges}
          hint={`${user.sessionsTaught} taught · ${user.sessionsLearned} learned`}
          icon={<GraduationCap className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming sessions */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Calendar className="h-4 w-4 text-brand-500" /> Upcoming sessions
            </h2>
            <Link href="/bookings" className="text-sm text-brand-600 hover:text-brand-500">
              View all
            </Link>
          </div>
          {bookings === null ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState
              title="No upcoming sessions"
              description="Browse the marketplace and book your first exchange."
              action={
                <Link href="/marketplace" className="text-sm font-medium text-brand-600 hover:text-brand-500">
                  Explore the marketplace →
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const isTeacher = b.teacherId === user.id;
                const other = isTeacher ? b.student : b.teacher;
                return (
                  <Link
                    key={b.id}
                    href="/bookings"
                    className="card flex items-center gap-4 p-4 transition hover:shadow-lift"
                  >
                    <Avatar name={other.name} src={other.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {b.userSkill.skill.name}{" "}
                        <span className="text-zinc-400">
                          {isTeacher ? `for ${other.name}` : `with ${other.name}`}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-500">{formatDateTime(b.startsAt)}</p>
                    </div>
                    <Pill tone={statusTone[b.status]}>{b.status.toLowerCase()}</Pill>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Challenges */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4 text-brand-500" /> Weekly challenges
            </h2>
            <Link href="/achievements" className="text-sm text-brand-600 hover:text-brand-500">
              All
            </Link>
          </div>
          {challenges === null ? (
            <Skeleton className="h-48" />
          ) : challenges.length === 0 ? (
            <EmptyState title="No active challenges" />
          ) : (
            <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {challenges.map((c) => {
                const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{c.title}</p>
                      <span className="text-xs text-zinc-400">+{c.xpReward} XP</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{c.description}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-zinc-400">
                      {c.progress}/{c.target}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Featured teachers */}
      {featured && featured.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-brand-500" /> Top-rated teachers
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {featured.map((t) => (
              <Link
                key={t.id}
                href={`/profile/${t.user.username}`}
                className="card flex items-center gap-3 p-4 transition hover:shadow-lift"
              >
                <Avatar name={t.user.name} src={t.user.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.user.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {t.skill.name} · ★{t.user.ratingAvg > 0 ? t.user.ratingAvg.toFixed(1) : "New"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
