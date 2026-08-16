"use client";

import {
  Activity,
  Clock3,
  Coins,
  Flag,
  Megaphone,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Skeleton, StatTile } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminAnalytics, User } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";

// Chart color: brand indigo — validated (dataviz six checks) on light #fff and
// dark #18181b card surfaces.
const CHART_HUE = "#6366f1";

type Tab = "overview" | "users" | "reports" | "platform";

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return <EmptyState title="Admin access required" />;
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Analytics" },
    { key: "users", label: "Users" },
    { key: "reports", label: "Reports" },
    { key: "platform", label: "Platform" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-brand-500" /> Admin
        </h1>
        <p className="mt-1 text-zinc-500">Moderation, analytics and platform management.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none",
              tab === t.key
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <AnalyticsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "platform" && <PlatformTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AnalyticsTab() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    apiGet<AdminAnalytics>("/api/admin/analytics/overview").then(setData).catch(() => undefined);
  }, []);

  if (!data) return <Skeleton className="h-96" />;
  const t = data.totals;
  const maxSignups = Math.max(1, ...data.signupsByWeek.map((w) => w.count));
  const maxSkill = Math.max(1, ...data.popularSkills.map((s) => s.sessions));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total users" value={t.users} hint={`+${t.newUsers30d} in 30 days`} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Active users (7d)" value={t.activeUsers7d} hint={`${t.messages7d} messages this week`} icon={<Activity className="h-5 w-5" />} />
        <StatTile label="Total exchanges" value={t.exchanges} hint={`${t.exchanges30d} in 30 days`} icon={<RefreshCcw className="h-5 w-5" />} />
        <StatTile label="Monthly revenue" value={`$${t.monthlyRevenue.toFixed(0)}`} hint={`${t.premiumUsers} premium members`} icon={<Coins className="h-5 w-5" />} />
        <StatTile label="Avg session" value={`${t.avgSessionMinutes} min`} icon={<Clock3 className="h-5 w-5" />} />
        <StatTile label="30-day retention" value={t.retention30d === null ? "—" : `${t.retention30d}%`} icon={<UserCheck className="h-5 w-5" />} />
        <StatTile label="Open reports" value={t.openReports} icon={<Flag className="h-5 w-5" />} />
        <StatTile label="Engagement" value={t.users ? `${Math.round((t.activeUsers7d / t.users) * 100)}%` : "—"} hint="weekly active / total" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly signups — single series, so the title carries identity (no legend). */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold">New signups per week</h2>
          <p className="text-xs text-zinc-400">Last 8 weeks</p>
          <div className="relative mt-6 flex h-44 items-end gap-2" role="img" aria-label="Bar chart of weekly signups">
            {data.signupsByWeek.map((w, i) => (
              <div
                key={w.weekStart}
                className="group relative flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && (
                  <div className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lift dark:bg-zinc-700">
                    <b>{w.count}</b> signup{w.count === 1 ? "" : "s"} · wk of {formatDate(w.weekStart, { year: undefined })}
                  </div>
                )}
                <div
                  className="rounded-t transition-opacity"
                  style={{
                    height: `${Math.max(2, (w.count / maxSignups) * 100)}%`,
                    backgroundColor: CHART_HUE,
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400 dark:border-zinc-800">
            <span>{formatDate(data.signupsByWeek[0]?.weekStart ?? "", { year: undefined })}</span>
            <span>this week</span>
          </div>
        </section>

        {/* Popular skills — ranked horizontal bars, one measure, direct labels. */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold">Most exchanged skills</h2>
          <p className="text-xs text-zinc-400">By completed sessions</p>
          {data.popularSkills.length === 0 ? (
            <p className="mt-8 text-center text-sm text-zinc-400">No completed exchanges yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.popularSkills.map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{s.name}</span>
                    <span className="tabular-nums text-zinc-500">{s.sessions}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-r bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-r"
                      style={{ width: `${(s.sessions / maxSkill) * 100}%`, backgroundColor: CHART_HUE }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface AdminUser extends User {
  email: string;
  isBanned: boolean;
  banReason?: string | null;
  lastActiveAt: string;
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query = "") => {
    const params = new URLSearchParams({ pageSize: "50" });
    if (query.trim()) params.set("q", query.trim());
    const data = await apiGet<{ users: AdminUser[] }>(`/api/admin/users?${params}`);
    setUsers(data.users);
  }, []);

  useEffect(() => {
    load().catch(() => setUsers([]));
  }, [load]);

  async function ban() {
    if (!banTarget) return;
    setError(null);
    try {
      await apiPost(`/api/admin/users/${banTarget.id}/ban`, { reason: banReason });
      setBanTarget(null);
      setBanReason("");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function unban(id: string) {
    await apiPost(`/api/admin/users/${id}/unban`).catch(() => undefined);
    await load(q);
  }

  async function verify(u: AdminUser) {
    await apiPatch(`/api/admin/users/${u.id}`, { verifiedTeacher: !u.verifiedTeacher }).catch(() => undefined);
    await load(q);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q).catch(() => undefined);
        }}
        className="flex max-w-md gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-10" placeholder="Search email, username, name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {users === null ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Credits</th>
                <th className="px-5 py-3 font-medium">Exchanges</th>
                <th className="px-5 py-3 font-medium">Last active</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-zinc-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.isBanned ? (
                        <Pill tone="red">banned</Pill>
                      ) : (
                        <Pill tone="green">active</Pill>
                      )}
                      {u.role !== "USER" && <Pill tone="brand">{u.role?.toLowerCase()}</Pill>}
                      {u.verifiedTeacher && <Pill tone="violet">verified</Pill>}
                    </div>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{u.creditBalance}</td>
                  <td className="px-5 py-3 tabular-nums">{u.completedExchanges}</td>
                  <td className="px-5 py-3 text-xs text-zinc-400">{timeAgo(u.lastActiveAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => verify(u)}>
                        {u.verifiedTeacher ? "Unverify" : "Verify"}
                      </Button>
                      {u.isBanned ? (
                        <Button size="sm" variant="outline" onClick={() => unban(u.id)}>Unban</Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setBanTarget(u)}>Ban</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!banTarget} onClose={() => setBanTarget(null)} title={`Ban ${banTarget?.name}?`}>
        <p className="text-sm text-zinc-500">
          They will be signed out everywhere and hidden from the marketplace.
        </p>
        <textarea
          className="input mt-4 min-h-20"
          placeholder="Reason (shown to the user)"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBanTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={ban} disabled={banReason.trim().length < 3}>
            Ban user
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Report {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: { username: string; name: string };
  targetUser?: { id: string; username: string; name: string; isBanned: boolean } | null;
  messageId?: string | null;
}

function ReportsTab() {
  const [reports, setReports] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    const data = await apiGet<{ reports: Report[] }>("/api/admin/reports?status=OPEN");
    setReports(data.reports);
  }, []);

  useEffect(() => {
    load().catch(() => setReports([]));
  }, [load]);

  async function resolve(id: string, action: "RESOLVED" | "DISMISSED") {
    await apiPost(`/api/admin/reports/${id}/resolve`, { action }).catch(() => undefined);
    await load();
  }

  if (reports === null) return <Skeleton className="h-64" />;
  if (reports.length === 0)
    return <EmptyState title="No open reports" description="The community is behaving 🎉" />;

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-4 p-5">
          <Flag className="h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <b>{r.reporter.name}</b> reported{" "}
              {r.targetUser ? <b>@{r.targetUser.username}</b> : "a message"} for{" "}
              <Pill tone="red">{r.reason.replace(/_/g, " ")}</Pill>
            </p>
            {r.details && <p className="mt-1 text-sm text-zinc-500">“{r.details}”</p>}
            <p className="mt-1 text-xs text-zinc-400">{timeAgo(r.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => resolve(r.id, "DISMISSED")}>
              Dismiss
            </Button>
            <Button size="sm" onClick={() => resolve(r.id, "RESOLVED")}>
              Mark resolved
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlatformTab() {
  const [name, setName] = useState("");
  const [catDone, setCatDone] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/admin/categories", { name }).catch(() => undefined);
    setCatDone(name);
    setName("");
  }

  async function announce(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await apiPost<{ recipients: number }>("/api/admin/announcements", { title, body });
      setSent(data.recipients);
      setTitle("");
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6">
        <h2 className="mb-1 font-semibold">Add official category</h2>
        <p className="mb-4 text-sm text-zinc-500">Official categories appear in marketplace filters.</p>
        <form onSubmit={addCategory} className="flex gap-2">
          <input className="input flex-1" placeholder="e.g. Gardening" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          <Button type="submit">Add</Button>
        </form>
        {catDone && <p className="mt-3 text-sm text-emerald-600">“{catDone}” added ✓</p>}
      </section>

      <section className="card p-6">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Megaphone className="h-4 w-4 text-brand-500" /> Send announcement
        </h2>
        <p className="mb-4 text-sm text-zinc-500">Delivered as a notification to every member.</p>
        <form onSubmit={announce} className="space-y-3">
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="input min-h-24" placeholder="Message…" value={body} onChange={(e) => setBody(e.target.value)} required />
          <Button type="submit" loading={busy}>Send to everyone</Button>
          {sent !== null && <p className="text-sm text-emerald-600">Sent to {sent} members ✓</p>}
        </form>
      </section>
    </div>
  );
}
