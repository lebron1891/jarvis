import { Repeat } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[400px] max-w-3xl rounded-full bg-gradient-to-tr from-brand-500/15 via-violet-500/10 to-fuchsia-500/15 blur-3xl"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white">
          <Repeat className="h-4 w-4" />
        </span>
        SkillSwap
      </Link>
      <div className="card relative w-full max-w-md p-8 animate-fade-in-up">{children}</div>
    </div>
  );
}
