"use client";

import { BadgeCheck, Globe, MapPin, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Rating, Skeleton } from "@/components/ui/misc";
import { apiGet } from "@/lib/api";
import type { Category, TeacherResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const LANGUAGES = ["English", "French", "Spanish", "German", "Mandarin", "Japanese", "Portuguese", "Arabic"];

export default function MarketplacePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<TeacherResult[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [sort, setSort] = useState("rating");

  useEffect(() => {
    apiGet<{ categories: Category[] }>("/api/categories")
      .then((d) => setCategories(d.categories.filter((c) => !c.isCustom)))
      .catch(() => undefined);
  }, []);

  const search = useCallback(async (pageArg = 1) => {
    setItems(null);
    const params = new URLSearchParams({ sort, page: String(pageArg), pageSize: "12" });
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (language) params.set("language", language);
    if (mode) params.set("mode", mode);
    try {
      const data = await apiGet<{
        items: TeacherResult[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/marketplace/teachers?${params}`);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setItems([]);
    }
  }, [q, category, language, mode, sort]);

  useEffect(() => {
    search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, language, mode, sort]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-1 text-zinc-500">
          {total > 0 ? `${total} lesson offer${total > 1 ? "s" : ""} from the community` : "Find your next teacher"}
        </p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(1);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="input pl-10"
            placeholder="Search a skill, a teacher… (e.g. Piano, TypeScript, Spanish)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setFiltersOpen((o) => !o)}
          className="sm:hidden"
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters */}
      <div className={cn("flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center", filtersOpen ? "flex" : "hidden sm:flex")}>
        <select className="input w-full sm:w-44" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select className="input w-full sm:w-40" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select className="input w-full sm:w-40" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Lesson mode">
          <option value="">Online & in-person</option>
          <option value="ONLINE">Online</option>
          <option value="IN_PERSON">In person</option>
        </select>
        <select className="input w-full sm:w-44" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="rating">Top rated</option>
          <option value="popularity">Most popular</option>
          <option value="distance">Nearby first</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {/* Results */}
      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No teachers match your search"
          description="Try a broader search or a different category."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <Link
                key={t.id}
                href={`/profile/${t.user.username}`}
                className="card group flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start justify-between">
                  <Avatar name={t.user.name} src={t.user.avatarUrl} size="lg" />
                  <Pill tone="brand">{t.skill.category.name}</Pill>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <h3 className="font-semibold">{t.user.name}</h3>
                  {t.user.verifiedTeacher && (
                    <BadgeCheck className="h-4 w-4 text-brand-500" aria-label="Verified teacher" />
                  )}
                </div>
                <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
                  {t.skill.name}
                </p>
                {t.headline && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{t.headline}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-4 text-sm text-zinc-500">
                  <Rating value={t.user.ratingAvg} count={t.user.ratingCount} />
                  <span className="flex items-center gap-1 text-xs">
                    {t.mode === "IN_PERSON" ? (
                      <><MapPin className="h-3.5 w-3.5" />{t.user.country ?? "In person"}</>
                    ) : (
                      <><Globe className="h-3.5 w-3.5" />Online</>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => search(page - 1)}>
                Previous
              </Button>
              <span className="px-2 text-sm text-zinc-500">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => search(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
