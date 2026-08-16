"use client";

import {
  Bot,
  Calendar,
  Coins,
  Compass,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Repeat,
  Settings,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationsBell } from "@/components/layout/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketplace", label: "Marketplace", icon: Compass },
  { href: "/bookings", label: "Bookings", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/wallet", label: "Wallet", icon: Coins },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.onboardingDone === false) router.replace("/onboarding");
  }, [loading, user, router]);

  // Establish the realtime connection for the whole app area.
  useEffect(() => {
    if (user) getSocket();
  }, [user]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  const nav = user.role === "ADMIN" || user.role === "MODERATOR"
    ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : NAV;

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-4 py-5 font-semibold tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <Repeat className="h-4 w-4" />
        </span>
        SkillSwap
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href={`/profile/${user.username}`}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-400">@{user.username}</p>
          </div>
        </Link>
        <button
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800/70"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-lift animate-fade-in dark:bg-zinc-950">
            <button
              className="absolute right-3 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header className="glass sticky top-0 z-20 flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="mr-2 flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
                <Coins className="h-4 w-4" />
                {user.creditBalance}
              </span>
              {user.streakCount > 0 && (
                <span
                  className="hidden items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-600 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 sm:flex"
                  title={`${user.streakCount}-day streak`}
                >
                  <Flame className="h-4 w-4" />
                  {user.streakCount}
                </span>
              )}
            </div>
            <NotificationsBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
