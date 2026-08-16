"use client";

import { ArrowDownLeft, ArrowUpRight, Coins, Gift, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatTile, EmptyState, Skeleton } from "@/components/ui/misc";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CreditTransaction } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  SIGNUP_BONUS: { label: "Welcome bonus", icon: <Gift className="h-4 w-4" /> },
  EXCHANGE_EARN: { label: "Lesson taught", icon: <ArrowDownLeft className="h-4 w-4" /> },
  EXCHANGE_SPEND: { label: "Lesson booked", icon: <ArrowUpRight className="h-4 w-4" /> },
  REFUND: { label: "Refund", icon: <RotateCcw className="h-4 w-4" /> },
  CHALLENGE_REWARD: { label: "Challenge reward", icon: <Gift className="h-4 w-4" /> },
  ADMIN_ADJUSTMENT: { label: "Adjustment", icon: <Coins className="h-4 w-4" /> },
};

export default function WalletPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[] | null>(null);

  useEffect(() => {
    apiGet<{ transactions: CreditTransaction[] }>("/api/exchanges/transactions?pageSize=50")
      .then((d) => setTransactions(d.transactions))
      .catch(() => setTransactions([]));
  }, []);

  if (!user) return null;
  const earned = (transactions ?? []).filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = (transactions ?? []).filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-zinc-500">
          Time is your currency — one hour taught equals one credit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Current balance" value={user.creditBalance} icon={<Coins className="h-5 w-5" />} />
        <StatTile label="Total earned" value={`+${earned}`} icon={<ArrowDownLeft className="h-5 w-5" />} />
        <StatTile label="Total spent" value={`−${spent}`} icon={<ArrowUpRight className="h-5 w-5" />} />
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Transaction history</h2>
        {transactions === null ? (
          <Skeleton className="h-64" />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Teach a session to earn your first credits."
            action={
              <Link href="/marketplace" className="text-sm font-medium text-brand-600 hover:text-brand-500">
                Explore the marketplace →
              </Link>
            }
          />
        ) : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.map((t) => {
              const meta = TYPE_META[t.type] ?? TYPE_META.ADMIN_ADJUSTMENT;
              const positive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      positive
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400",
                    )}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-zinc-400">
                      {meta.label} · {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-semibold", positive ? "text-emerald-600" : "text-red-500")}>
                      {positive ? "+" : ""}
                      {t.amount}
                    </p>
                    <p className="text-xs text-zinc-400">balance {t.balanceAfter}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
