"use client";

import {
  BookOpenCheck,
  Bot,
  FileQuestion,
  GraduationCap,
  Languages,
  ListChecks,
  Route,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/misc";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const TOOLS = [
  {
    key: "lesson-plan",
    label: "Lesson plan",
    icon: GraduationCap,
    placeholder: "e.g. A 1-hour beginner lesson on React hooks for a designer who knows HTML/CSS",
    cta: "Generate lesson plan",
  },
  {
    key: "quiz",
    label: "Quiz",
    icon: FileQuestion,
    placeholder: "e.g. Intermediate Spanish — past tenses and everyday vocabulary",
    cta: "Create quiz",
  },
  {
    key: "summarize",
    label: "Summarize",
    icon: BookOpenCheck,
    placeholder: "Paste your lesson notes here…",
    cta: "Summarize lesson",
  },
  {
    key: "correct",
    label: "Correct",
    icon: ListChecks,
    placeholder: "Paste the exercise and the student's answer…",
    cta: "Correct exercise",
  },
  {
    key: "recommend",
    label: "Find teachers",
    icon: UsersRound,
    placeholder: "e.g. I want to learn jazz piano, I speak English and French, evenings only",
    cta: "Recommend teachers",
  },
  {
    key: "learning-path",
    label: "Learning path",
    icon: Route,
    placeholder: "e.g. From zero to conversational Japanese in 6 months",
    cta: "Build learning path",
  },
  {
    key: "translate",
    label: "Translate",
    icon: Languages,
    placeholder: "Paste a message and say the target language, e.g. → French",
    cta: "Translate",
  },
] as const;

type ToolKey = (typeof TOOLS)[number]["key"];

export default function AssistantPage() {
  const { user } = useAuth();
  const [tool, setTool] = useState<ToolKey>("lesson-plan");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = TOOLS.find((t) => t.key === tool)!;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOutput(null);
    try {
      const data = await apiPost<{ output: string; remainingToday: number | null }>(
        `/api/ai/${tool}`,
        { input },
      );
      setOutput(data.output);
      setRemaining(data.remainingToday);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Bot className="h-6 w-6 text-brand-500" /> AI Assistant
          </h1>
          <p className="mt-1 text-zinc-500">
            Lesson plans, quizzes, corrections, learning paths and more — powered by Claude.
          </p>
        </div>
        {user?.plan === "PREMIUM" ? (
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300">
            ✨ Premium — unlimited
          </span>
        ) : remaining !== null ? (
          <span className="text-sm text-zinc-500">{remaining} free requests left today</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTool(t.key);
              setOutput(null);
              setError(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              tool === t.key
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={run} className="card space-y-4 p-6">
        <textarea
          className="input min-h-32 resize-y"
          placeholder={active.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={8000}
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!input.trim()}>
          <Sparkles className="h-4 w-4" />
          {active.cta}
        </Button>
      </form>

      {output && (
        <div className="card p-6 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Bot className="h-4 w-4" /> Assistant
          </div>
          <div className="prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
