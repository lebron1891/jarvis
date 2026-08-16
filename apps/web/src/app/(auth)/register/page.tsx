"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Get 3 free credits to book your first lessons.
      </p>
      <div className="mt-6">
        <OAuthButtons />
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" required className="input" value={form.name} onChange={set("name")} placeholder="Ada Lovelace" />
            </div>
            <div>
              <label className="label" htmlFor="username">Username</label>
              <input
                id="username"
                required
                className="input"
                value={form.username}
                onChange={set("username")}
                placeholder="ada"
                pattern="[A-Za-z0-9_.\-]{3,30}"
                title="3-30 characters: letters, digits, . _ -"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={form.password}
              onChange={set("password")}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Create account
          </Button>
          <p className="text-center text-xs text-zinc-400">
            By signing up you agree to exchange kindness and knowledge.
          </p>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
