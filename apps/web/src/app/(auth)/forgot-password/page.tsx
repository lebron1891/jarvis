"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { apiPost } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="mt-4 text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-zinc-500">
          If an account exists for <span className="font-medium">{email}</span>, we sent a link to
          reset your password. The link expires in one hour.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-500">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-500">Sign in</Link>
      </p>
    </div>
  );
}
