"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyTwoFactor } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (challengeToken) {
        await verifyTwoFactor(challengeToken, code);
        router.push("/dashboard");
        return;
      }
      const result = await login(email, password);
      if (result.twoFactorRequired && result.challengeToken) {
        setChallengeToken(result.challengeToken);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (challengeToken) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            className="input text-center text-2xl tracking-[.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            inputMode="numeric"
            autoFocus
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={code.length !== 6}>
            Verify
          </Button>
          <button
            type="button"
            onClick={() => setChallengeToken(null)}
            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-500">Sign in to keep swapping skills.</p>
      <div className="mt-6">
        <OAuthButtons />
        <form onSubmit={onSubmit} className="space-y-4">
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
              autoComplete="email"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-500">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          New to SkillSwap?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-500">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
