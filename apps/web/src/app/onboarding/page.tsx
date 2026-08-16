"use client";

import { ArrowLeft, ArrowRight, Check, GraduationCap, Lightbulb, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Category, Skill } from "@/lib/types";
import { cn, DAY_NAMES } from "@/lib/utils";

const LANGUAGES = [
  "English", "French", "Spanish", "German", "Italian", "Portuguese",
  "Mandarin", "Japanese", "Korean", "Arabic", "Hindi", "Russian",
];

interface PickedSkill {
  skillId: string;
  name: string;
  kind: "TEACH" | "LEARN";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 — profile
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Step 2 — skills
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PickedSkill[]>([]);
  const [pickMode, setPickMode] = useState<"TEACH" | "LEARN">("TEACH");

  // Step 3 — availability (weekly, evening defaults)
  const [slots, setSlots] = useState<Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    apiGet<{ categories: Category[] }>("/api/categories").then((d) => setCategories(d.categories)).catch(() => undefined);
    apiGet<{ skills: Skill[] }>("/api/skills?limit=100").then((d) => setSkills(d.skills)).catch(() => undefined);
  }, []);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills.slice(0, 24);
    return skills.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 24);
  }, [skills, query]);

  const toggleSkill = (skill: Skill) => {
    setPicked((prev) => {
      const exists = prev.find((p) => p.skillId === skill.id && p.kind === pickMode);
      if (exists) return prev.filter((p) => p !== exists);
      return [...prev, { skillId: skill.id, name: skill.name, kind: pickMode }];
    });
  };

  const toggleSlot = (dayOfWeek: number, startMinute: number) => {
    setSlots((prev) => {
      const exists = prev.find((s) => s.dayOfWeek === dayOfWeek && s.startMinute === startMinute);
      if (exists) return prev.filter((s) => s !== exists);
      return [...prev, { dayOfWeek, startMinute, endMinute: startMinute + 120 }];
    });
  };

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/users/me/onboarding", {
        profile: {
          bio: bio || undefined,
          country: country || undefined,
          languages,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        skills: picked.map(({ skillId, kind }) => ({ skillId, kind })),
        availability: slots,
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["About you", "Your skills", "Availability"];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <div className="mb-8 flex items-center gap-2 font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <Repeat className="h-4 w-4" />
        </span>
        Welcome to SkillSwap
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                    ? "bg-brand-600 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:block", i === step ? "font-medium" : "text-zinc-400")}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
          </div>
        ))}
      </div>

      <div className="card flex-1 p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-semibold">Tell the community about you</h1>
              <p className="text-sm text-zinc-500">This appears on your public profile.</p>
            </div>
            <div>
              <label className="label">Short bio</label>
              <textarea
                className="input min-h-24 resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What do you do? What are you passionate about?"
                maxLength={2000}
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. France" />
            </div>
            <div>
              <label className="label">Languages you speak</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() =>
                      setLanguages((prev) =>
                        prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      languages.includes(lang)
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-semibold">What will you swap?</h1>
              <p className="text-sm text-zinc-500">
                Pick skills you can <b>teach</b> and skills you want to <b>learn</b>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              {(["TEACH", "LEARN"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPickMode(mode)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                    pickMode === mode
                      ? "bg-white shadow-sm dark:bg-zinc-900"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                  )}
                >
                  {mode === "TEACH" ? <GraduationCap className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                  {mode === "TEACH" ? "I can teach" : "I want to learn"}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Search skills… (TypeScript, Piano, Spanish…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {filteredSkills.map((skill) => {
                const selected = picked.some((p) => p.skillId === skill.id && p.kind === pickMode);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selected
                        ? pickMode === "TEACH"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                          : "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {skill.name}
                  </button>
                );
              })}
              {filteredSkills.length === 0 && (
                <p className="text-sm text-zinc-400">No matching skill — you can add more later in Settings.</p>
              )}
            </div>
            {picked.length > 0 && (
              <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
                <p>
                  <b>{picked.filter((p) => p.kind === "TEACH").length}</b> to teach ·{" "}
                  <b>{picked.filter((p) => p.kind === "LEARN").length}</b> to learn
                </p>
              </div>
            )}
            <p className="text-xs text-zinc-400">{categories.length} categories available — Programming, Design, Music, Languages and more.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h1 className="text-lg font-semibold">When are you usually free?</h1>
              <p className="text-sm text-zinc-500">
                Tap the 2-hour blocks that suit you (your timezone:{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}). You can refine this later.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-separate border-spacing-1 text-center text-xs">
                <thead>
                  <tr>
                    <th />
                    {["8-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"].map((h) => (
                      <th key={h} className="pb-1 font-medium text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_NAMES.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="pr-2 text-right font-medium text-zinc-500">{day.slice(0, 3)}</td>
                      {[8, 10, 12, 14, 16, 18, 20].map((hour) => {
                        const startMinute = hour * 60;
                        const active = slots.some(
                          (s) => s.dayOfWeek === dayIdx && s.startMinute === startMinute,
                        );
                        return (
                          <td key={hour}>
                            <button
                              type="button"
                              onClick={() => toggleSlot(dayIdx, startMinute)}
                              className={cn(
                                "h-8 w-full rounded-md transition",
                                active
                                  ? "bg-brand-500 hover:bg-brand-400"
                                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
                              )}
                              aria-pressed={active}
                              aria-label={`${day} ${hour}:00`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={busy}>
              Finish setup <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
