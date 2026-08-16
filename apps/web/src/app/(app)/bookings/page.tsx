"use client";

import { Check, CheckCheck, Clock, Star, Video, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pill, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { apiPost, apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Booking } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

type Tab = "upcoming" | "requests" | "history";

export default function BookingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ bookings: Booking[] }>("/api/bookings/mine");
      setBookings(data.bookings);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const now = Date.now();
  const filtered = (bookings ?? []).filter((b) => {
    if (tab === "requests") return b.status === "PENDING";
    if (tab === "upcoming")
      return b.status === "CONFIRMED" && new Date(b.endsAt).getTime() >= now - 3600_000;
    return ["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status) ||
      (b.status === "CONFIRMED" && new Date(b.endsAt).getTime() < now - 3600_000);
  });

  async function action(booking: Booking, verb: "accept" | "decline" | "cancel" | "complete") {
    setError(null);
    try {
      await apiPost(`/api/bookings/${booking.id}/${verb}`);
      await load();
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "upcoming", label: "Upcoming" },
    {
      key: "requests",
      label: "Requests",
      count: (bookings ?? []).filter((b) => b.status === "PENDING").length,
    },
    { key: "history", label: "History" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-zinc-500">Your sessions, requests and exchange history.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none",
              tab === t.key
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
            )}
          >
            {t.label}
            {!!t.count && (
              <span className="rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>

      {bookings === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "requests" ? "No pending requests" : tab === "upcoming" ? "No upcoming sessions" : "No history yet"}
          description="Book a session from the marketplace to get started."
          action={
            <Link href="/marketplace" className="text-sm font-medium text-brand-600 hover:text-brand-500">
              Browse teachers →
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const isTeacher = b.teacherId === user.id;
            const other = isTeacher ? b.student : b.teacher;
            const started = new Date(b.startsAt).getTime() <= now;
            const joinable =
              b.status === "CONFIRMED" &&
              b.mode === "ONLINE" &&
              new Date(b.startsAt).getTime() - 15 * 60_000 <= now &&
              new Date(b.endsAt).getTime() + 3600_000 >= now;
            const iConfirmed = isTeacher ? b.teacherConfirmed : b.studentConfirmed;

            return (
              <div key={b.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={other.name} src={other.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{b.userSkill.skill.name}</p>
                      <Pill tone={statusTone[b.status]}>{b.status.toLowerCase()}</Pill>
                      <Pill tone="zinc">
                        {isTeacher ? "You teach" : "You learn"}
                      </Pill>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {isTeacher ? "For" : "With"}{" "}
                      <Link href={`/profile/${other.username}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
                        {other.name}
                      </Link>{" "}
                      · <Clock className="mb-0.5 inline h-3.5 w-3.5" /> {formatDateTime(b.startsAt)} ·{" "}
                      {b.credits} credit{b.credits > 1 ? "s" : ""}
                    </p>
                    {b.notes && <p className="mt-1 text-sm italic text-zinc-400">“{b.notes}”</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {b.status === "PENDING" && isTeacher && (
                      <>
                        <Button size="sm" onClick={() => action(b, "accept")}>
                          <Check className="h-4 w-4" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => action(b, "decline")}>
                          <X className="h-4 w-4" /> Decline
                        </Button>
                      </>
                    )}
                    {b.status === "PENDING" && !isTeacher && (
                      <Button size="sm" variant="outline" onClick={() => action(b, "cancel")}>
                        Cancel request
                      </Button>
                    )}
                    {joinable && (
                      <Link
                        href={`/session/${b.meetingRoomId}?b=${b.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-500"
                      >
                        <Video className="h-3.5 w-3.5" /> Join room
                      </Link>
                    )}
                    {b.status === "CONFIRMED" && started && !iConfirmed && (
                      <Button size="sm" variant="secondary" onClick={() => action(b, "complete")}>
                        <CheckCheck className="h-4 w-4" /> Mark complete
                      </Button>
                    )}
                    {b.status === "CONFIRMED" && started && iConfirmed && (
                      <Pill tone="green">Waiting for partner ✓</Pill>
                    )}
                    {b.status === "CONFIRMED" && !started && (
                      <Button size="sm" variant="ghost" onClick={() => action(b, "cancel")}>
                        Cancel
                      </Button>
                    )}
                    {b.status === "COMPLETED" && (
                      <Button size="sm" variant="outline" onClick={() => setReviewFor(b)}>
                        <Star className="h-4 w-4" /> Review
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewFor && (
        <ReviewModal
          booking={reviewFor}
          isTeacher={reviewFor.teacherId === user.id}
          onClose={() => setReviewFor(null)}
        />
      )}
    </div>
  );
}

function ReviewModal({
  booking,
  isTeacher,
  onClose,
}: {
  booking: Booking;
  isTeacher: boolean;
  onClose: () => void;
}) {
  const other = isTeacher ? booking.student : booking.teacher;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/reviews", {
        bookingId: booking.id,
        rating,
        comment: comment || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Review ${other.name}`}>
      {done ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Thanks for the feedback! It helps keep the community trustworthy. 🌟
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star
                  className={cn(
                    "h-8 w-8 transition",
                    n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700",
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-24"
            placeholder={`How was your ${booking.userSkill.skill.name} session?`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" loading={busy}>
            Publish review
          </Button>
        </form>
      )}
    </Modal>
  );
}
