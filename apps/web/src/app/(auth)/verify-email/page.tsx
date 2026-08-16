"use client";

import { BadgeCheck, CircleX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageLoader } from "@/components/ui/spinner";
import { apiPost } from "@/lib/api";

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    apiPost("/api/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  if (state === "pending") return <PageLoader />;

  return (
    <div className="text-center">
      {state === "ok" ? (
        <>
          <BadgeCheck className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold">Email verified 🎉</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your account is fully activated. Happy swapping!
          </p>
        </>
      ) : (
        <>
          <CircleX className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold">Verification failed</h1>
          <p className="mt-2 text-sm text-zinc-500">{message}</p>
        </>
      )}
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
      >
        Go to dashboard
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
