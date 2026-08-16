"use client";

import {
  Award,
  BadgeCheck,
  CalendarPlus,
  Flag,
  Globe2,
  Languages,
  MapPin,
  MessageSquare,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Rating } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { PageLoader } from "@/components/ui/spinner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Review, User, UserSkill } from "@/lib/types";
import { DAY_NAMES, formatDate, minutesToTime } from "@/lib/utils";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [bookingSkill, setBookingSkill] = useState<UserSkill | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ user: User; isFollowing: boolean }>(`/api/users/${username}`);
      setProfile(data.user);
      setIsFollowing(data.isFollowing);
      const r = await apiGet<{ reviews: Review[] }>(`/api/users/${username}/reviews`);
      setReviews(r.reviews);
    } catch {
      setNotFound(true);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) return <EmptyState title="User not found" />;
  if (!profile) return <PageLoader />;

  const isMe = me?.id === profile.id;
  const teachSkills = (profile.skills ?? []).filter((s) => s.kind === "TEACH");
  const learnSkills = (profile.skills ?? []).filter((s) => s.kind === "LEARN");

  async function toggleFollow() {
    if (!profile) return;
    if (isFollowing) {
      await apiDelete(`/api/users/${profile.id}/follow`).catch(() => undefined);
      setIsFollowing(false);
    } else {
      await apiPost(`/api/users/${profile.id}/follow`).catch(() => undefined);
      setIsFollowing(true);
    }
  }

  async function openConversation() {
    if (!profile) return;
    const data = await apiPost<{ conversationId: string }>("/api/conversations", {
      userId: profile.id,
    });
    router.push(`/messages?c=${data.conversationId}`);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <Avatar name={profile.name} src={profile.avatarUrl} size="xl" />
            {!isMe && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openConversation}>
                  <MessageSquare className="h-4 w-4" /> Message
                </Button>
                <Button variant={isFollowing ? "ghost" : "secondary"} size="sm" onClick={toggleFollow}>
                  {isFollowing ? (
                    <><UserMinus className="h-4 w-4" /> Unfollow</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> Follow</>
                  )}
                </Button>
                <button
                  onClick={() => setReportOpen(true)}
                  className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                  aria-label="Report user"
                >
                  <Flag className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
              {profile.verifiedTeacher && (
                <Pill tone="brand"><BadgeCheck className="h-3.5 w-3.5" /> Verified teacher</Pill>
              )}
              {profile.plan === "PREMIUM" && <Pill tone="violet">✨ Premium</Pill>}
            </div>
            <p className="text-zinc-500">@{profile.username}</p>
            {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
              <Rating value={profile.ratingAvg} count={profile.ratingCount} />
              <span>Level {profile.level}</span>
              <span>{profile.completedExchanges} exchanges</span>
              {profile.country && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.country}</span>
              )}
              {profile.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Languages className="h-4 w-4" />
                  {profile.languages.join(", ")}
                </span>
              )}
              <span>Member since {formatDate(profile.createdAt, { day: undefined })}</span>
            </div>
            {(profile.badges ?? []).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.badges!.map((b) => (
                  <Pill key={b.badgeId} tone="amber" className="gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    {b.badge.name}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Teaching */}
          <section>
            <h2 className="mb-3 font-semibold">Teaches</h2>
            {teachSkills.length === 0 ? (
              <EmptyState title="No lessons offered yet" />
            ) : (
              <div className="space-y-3">
                {teachSkills.map((s) => (
                  <div key={s.id} className="card flex flex-wrap items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{s.skill.name}</h3>
                        <Pill tone="zinc">{s.skill.category.name}</Pill>
                        <Pill tone={s.mode === "IN_PERSON" ? "amber" : "green"}>
                          {s.mode === "BOTH" ? (
                            <><Globe2 className="h-3 w-3" /> Online & in person</>
                          ) : s.mode === "IN_PERSON" ? (
                            <><MapPin className="h-3 w-3" /> In person</>
                          ) : (
                            <><Globe2 className="h-3 w-3" /> Online</>
                          )}
                        </Pill>
                      </div>
                      {s.headline && <p className="mt-1 text-sm text-zinc-500">{s.headline}</p>}
                      {s.description && (
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.description}</p>
                      )}
                    </div>
                    {!isMe && (
                      <Button onClick={() => setBookingSkill(s)}>
                        <CalendarPlus className="h-4 w-4" />
                        Book · {s.hourlyCredits} cr/h
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reviews */}
          <section>
            <h2 className="mb-3 font-semibold">Reviews ({reviews.length})</h2>
            {reviews.length === 0 ? (
              <EmptyState title="No reviews yet" description="Reviews appear after completed exchanges." />
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.author.name} src={r.author.avatarUrl} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{r.author.name}</p>
                          <p className="text-xs text-zinc-400">
                            {r.booking?.userSkill.skill.name} · {formatDate(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Rating value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: availability + wants to learn */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Weekly availability</h2>
            {(profile.availability ?? []).length === 0 ? (
              <p className="text-sm text-zinc-400">Not shared yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...(profile.availability ?? [])]
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)
                  .map((slot) => (
                    <li key={slot.id} className="flex justify-between">
                      <span className="text-zinc-500">{DAY_NAMES[slot.dayOfWeek]}</span>
                      <span className="font-medium">
                        {minutesToTime(slot.startMinute)} – {minutesToTime(slot.endMinute)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-zinc-400">Times in {profile.timezone}</p>
          </section>
          {learnSkills.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Wants to learn</h2>
              <div className="flex flex-wrap gap-2">
                {learnSkills.map((s) => (
                  <Pill key={s.id} tone="violet">{s.skill.name}</Pill>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                Teach one of these to earn credits from {profile.name.split(" ")[0]}!
              </p>
            </section>
          )}
        </div>
      </div>

      {bookingSkill && (
        <BookingModal
          skill={bookingSkill}
          teacherName={profile.name}
          onClose={() => setBookingSkill(null)}
        />
      )}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetUserId={profile.id} />
    </div>
  );
}

function BookingModal({
  skill,
  teacherName,
  onClose,
}: {
  skill: UserSkill;
  teacherName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const credits = Math.max(1, Math.round((duration / 60) * skill.hourlyCredits));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/bookings", {
        userSkillId: skill.id,
        startsAt: new Date(`${date}T${time}`).toISOString(),
        durationMinutes: duration,
        mode,
        notes: notes || undefined,
      });
      router.push("/bookings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Book ${skill.skill.name}`}>
      <p className="-mt-2 mb-4 text-sm text-zinc-500">
        1-hour lesson with {teacherName} = {skill.hourlyCredits} credit{skill.hourlyCredits > 1 ? "s" : ""}.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              required
              className="input"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" required className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Duration</label>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
          <div>
            <label className="label">Mode</label>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as "ONLINE" | "IN_PERSON")}
            >
              <option value="ONLINE">Online (video room)</option>
              {skill.mode !== "ONLINE" && <option value="IN_PERSON">In person</option>}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Message to the teacher (optional)</label>
          <textarea
            className="input min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What would you like to focus on?"
          />
        </div>
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          This session will cost <b>{credits} credit{credits > 1 ? "s" : ""}</b>, held when the
          teacher accepts and released to them once you both confirm completion.
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" size="lg" loading={busy} disabled={!date}>
          Send request
        </Button>
      </form>
    </Modal>
  );
}

function ReportModal({
  open,
  onClose,
  targetUserId,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/reports", { targetUserId, reason, details: details || undefined });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report this user">
      {done ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Thanks — our moderation team will review this report shortly.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Reason</label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate_content">Inappropriate content</option>
              <option value="scam">Scam or fraud</option>
              <option value="no_show">Didn&apos;t show up</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Details (optional)</label>
            <textarea className="input min-h-20" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <Button type="submit" variant="danger" className="w-full" loading={busy}>
            Submit report
          </Button>
        </form>
      )}
    </Modal>
  );
}
