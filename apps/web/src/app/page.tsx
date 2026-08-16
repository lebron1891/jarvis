import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Coins,
  MessageSquare,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Video,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const CATEGORIES = [
  "Programming", "Design", "Business", "Marketing", "Languages", "Music",
  "Sports", "Cooking", "Photography", "Video Editing", "AI", "Mathematics",
  "Science", "Fitness", "Personal Development",
];

const FEATURES = [
  {
    icon: Coins,
    title: "Time is the currency",
    body: "Teach for one hour, earn one credit, spend it learning anything else. No money ever changes hands.",
  },
  {
    icon: Video,
    title: "Built-in video classroom",
    body: "HD video calls with screen sharing, a collaborative whiteboard, chat and a session timer — right in the app.",
  },
  {
    icon: Bot,
    title: "AI learning assistant",
    body: "Generate lesson plans and quizzes, get exercises corrected, and receive personalised learning paths.",
  },
  {
    icon: CalendarCheck,
    title: "Effortless scheduling",
    body: "Share your availability, get booking requests, and let automatic reminders handle the rest — across time zones.",
  },
  {
    icon: Trophy,
    title: "Progress that feels good",
    body: "XP, levels, daily streaks, challenges and unlockable badges keep you motivated to keep swapping.",
  },
  {
    icon: ShieldCheck,
    title: "A community you can trust",
    body: "Verified teachers, mutual exchange confirmation, ratings and reviews on every completed session.",
  },
];

const STEPS = [
  { n: "01", title: "Share what you know", body: "List the skills you can teach and the ones you want to learn." },
  { n: "02", title: "Book a session", body: "Find the right teacher, pick a slot in their calendar and send a request." },
  { n: "03", title: "Swap an hour", body: "Meet in the built-in video classroom. One hour taught = one credit earned." },
  { n: "04", title: "Spend your credits", body: "Use earned credits to learn anything from anyone in the community." },
];

const TESTIMONIALS = [
  {
    quote:
      "I taught Figma twice a week and learned conversational Spanish in three months. Zero euros spent.",
    name: "Maya C.",
    role: "Product Designer",
  },
  {
    quote:
      "The credit system is genius. Teaching TypeScript pays for my piano lessons — it feels like a cheat code.",
    name: "Liam O.",
    role: "Full-stack Developer",
  },
  {
    quote:
      "As a language coach the built-in classroom and AI quiz generator save me hours of prep every week.",
    name: "Sofía G.",
    role: "Language Coach",
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
        <Repeat className="h-4 w-4" />
      </span>
      SkillSwap
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="glass sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-zinc-600 dark:text-zinc-300 md:flex">
            <a href="#features" className="transition hover:text-zinc-900 dark:hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-zinc-900 dark:hover:text-white">How it works</a>
            <a href="#categories" className="transition hover:text-zinc-900 dark:hover:text-white">Categories</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-48 mx-auto h-[500px] max-w-4xl rounded-full bg-gradient-to-tr from-brand-500/20 via-violet-500/15 to-fuchsia-500/20 blur-3xl"
        />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 text-center sm:px-6 sm:pt-28">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              One hour taught = one hour learned
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Exchange <span className="gradient-text">skills</span>, not money.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-zinc-600 dark:text-zinc-400">
              Teach what you love, earn time credits, and spend them learning
              anything — from coding to cooking — with people around the world.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-600 px-7 text-base font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500"
              >
                Start swapping — it&apos;s free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-2xl border border-zinc-300 px-7 text-base font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Browse teachers
              </Link>
            </div>
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9 average rating</span>
              <span className="hidden sm:flex items-center gap-1.5"><Repeat className="h-4 w-4 text-brand-500" /> 15+ skill categories</span>
              <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-emerald-500" /> Real-time messaging</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to trade knowledge
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            A complete platform — scheduling, video classroom, messaging, AI
            assistance and a reputation system — designed around fair exchange.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card group p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
              <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-3 text-brand-600 transition group-hover:scale-105 dark:bg-brand-500/10 dark:text-brand-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="text-5xl font-semibold text-zinc-200 dark:text-zinc-800">{s.n}</span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn (or teach) almost anything
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-700 dark:hover:text-brand-300"
            >
              {c}
            </span>
          ))}
          <span className="rounded-full border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-700">
            + your own custom categories
          </span>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card p-6">
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-zinc-500"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 px-6 py-16 text-center text-white shadow-lift sm:px-16">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your first 3 credits are on us.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Sign up, tell us what you can teach and what you want to learn, and
            book your first lesson today.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-8 text-base font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Create your free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} SkillSwap. Exchange skills, not money.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-white">Sign in</Link>
            <Link href="/register" className="hover:text-zinc-900 dark:hover:text-white">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
