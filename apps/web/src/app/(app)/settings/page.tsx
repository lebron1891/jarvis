"use client";

import { KeyRound, Palette, ShieldCheck, Sparkles, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { apiPatch, apiPost, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-zinc-500">Profile, security and subscription.</p>
      </div>
      <ProfileSection />
      <SecuritySection />
      <PremiumSection />
      <p className="text-center text-xs text-zinc-400">
        GDPR: you can request an export or deletion of your data anytime at privacy@skillswap.app
      </p>
    </div>
  );

  function ProfileSection() {
    const [name, setName] = useState(user!.name);
    const [bio, setBio] = useState(user!.bio ?? "");
    const [country, setCountry] = useState(user!.country ?? "");
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function save(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        await apiPatch("/api/users/me", {
          name,
          bio: bio || null,
          country: country || null,
        });
        await refreshUser();
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    }

    async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const uploaded = await uploadFile(file);
        await apiPatch("/api/users/me", { avatarUrl: uploaded.url });
        await refreshUser();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    }

    return (
      <section className="card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <UserIcon className="h-4 w-4 text-brand-500" /> Profile
        </h2>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user!.name} src={user!.avatarUrl} size="lg" />
          <label className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Change photo
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
          </label>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <ErrorText>{error}</ErrorText>
          {saved && <p className="text-sm text-emerald-600">Saved ✓</p>}
          <Button type="submit" loading={busy}>Save changes</Button>
        </form>
      </section>
    );
  }

  function SecuritySection() {
    const [twoFaModal, setTwoFaModal] = useState(false);
    const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function start2fa() {
      setError(null);
      const data = await apiPost<{ secret: string; otpauthUrl: string }>("/api/auth/2fa/setup");
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setTwoFaModal(true);
    }

    async function confirm2fa(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await apiPost("/api/auth/2fa/enable", { code });
        await refreshUser();
        setTwoFaModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid code");
      } finally {
        setBusy(false);
      }
    }

    async function disable2fa(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await apiPost("/api/auth/2fa/disable", { code });
        await refreshUser();
        setTwoFaModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid code");
      } finally {
        setBusy(false);
      }
    }

    const enabled = user!.twoFactorEnabled;

    return (
      <section className="card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand-500" /> Security
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Two-factor authentication</p>
            <p className="text-sm text-zinc-500">
              {enabled ? "Enabled — codes required at sign-in." : "Protect your account with an authenticator app."}
            </p>
          </div>
          <Button
            variant={enabled ? "outline" : "primary"}
            onClick={() => (enabled ? setTwoFaModal(true) : start2fa())}
          >
            <KeyRound className="h-4 w-4" />
            {enabled ? "Disable" : "Enable 2FA"}
          </Button>
        </div>

        <Modal
          open={twoFaModal}
          onClose={() => setTwoFaModal(false)}
          title={enabled ? "Disable two-factor" : "Enable two-factor"}
        >
          {enabled ? (
            <form onSubmit={disable2fa} className="space-y-4">
              <p className="text-sm text-zinc-500">Enter a current code to disable 2FA.</p>
              <input
                className="input text-center text-xl tracking-[.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
              <ErrorText>{error}</ErrorText>
              <Button type="submit" variant="danger" className="w-full" loading={busy}>
                Disable 2FA
              </Button>
            </form>
          ) : (
            <form onSubmit={confirm2fa} className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                <li>Open your authenticator app (1Password, Google Authenticator…)</li>
                <li>
                  Add a new account with this secret key:
                  <code className="mt-1 block break-all rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
                    {secret}
                  </code>
                  {otpauthUrl && (
                    <a href={otpauthUrl} className="mt-1 block text-xs text-brand-600 hover:underline">
                      …or tap here on mobile to add it automatically
                    </a>
                  )}
                </li>
                <li>Enter the 6-digit code below</li>
              </ol>
              <input
                className="input text-center text-xl tracking-[.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>
                Confirm & enable
              </Button>
            </form>
          )}
        </Modal>
      </section>
    );
  }

  function PremiumSection() {
    const [busy, setBusy] = useState(false);
    const premium = user!.plan === "PREMIUM";

    async function toggle() {
      setBusy(true);
      try {
        await apiPost(premium ? "/api/billing/cancel" : "/api/billing/subscribe");
        await refreshUser();
      } finally {
        setBusy(false);
      }
    }

    return (
      <section
        className={cn(
          "card p-6",
          !premium && "border-violet-200 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40 dark:border-violet-900 dark:from-violet-500/5 dark:to-fuchsia-500/5",
        )}
      >
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" /> SkillSwap Premium
        </h2>
        {premium ? (
          <>
            <p className="text-sm text-zinc-500">
              You&apos;re Premium ✨ — unlimited AI, priority ranking, 100 MB uploads and exclusive badges.
            </p>
            <Button variant="outline" className="mt-4" onClick={toggle} loading={busy}>
              Cancel subscription
            </Button>
          </>
        ) : (
          <>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              <li>🤖 Unlimited AI assistance</li>
              <li>📈 Advanced analytics on your sessions</li>
              <li>🚀 Priority ranking in search results</li>
              <li>🎨 Custom profile themes</li>
              <li>📁 100 MB file uploads</li>
              <li>🏅 Exclusive badges</li>
            </ul>
            <Button className="mt-4 bg-violet-600 hover:bg-violet-500" onClick={toggle} loading={busy}>
              <Palette className="h-4 w-4" /> Upgrade — $9.99/month
            </Button>
          </>
        )}
      </section>
    );
  }
}
