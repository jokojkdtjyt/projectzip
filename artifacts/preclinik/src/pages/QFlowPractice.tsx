import { useMemo, useState } from "react";
import { BookOpen, ChevronRight, CircleHelp, Search, X } from "lucide-react";
import { Link } from "wouter";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQueries } from "@tanstack/react-query";
import {
  getListQflowChaptersQueryKey,
  listQflowChapters,
  useListModules,
} from "@workspace/api-client-react";

export default function QFlowPractice() {
  const [search, setSearch] = useState("");
  const { data: roleData } = useIsAdmin();
  const { data: modules, isLoading, isError, refetch } = useListModules(
    { published: true },
  );
  const publishedModules = useMemo(
    () => (modules ?? []).filter((module) => module.published),
    [modules],
  );
  const chapterQueries = useQueries({
    queries: publishedModules.map((module) => ({
      queryKey: getListQflowChaptersQueryKey(module.id),
      queryFn: () => listQflowChapters(module.id),
      enabled: Boolean(module.id),
      retry: false,
    })),
  });

  const query = search.trim().toLocaleLowerCase();
  const filteredModules = publishedModules.filter((module) =>
    [module.title, module.category, module.summary]
      .some((value) => value?.toLocaleLowerCase().includes(query)),
  );
  const loadingChapters = chapterQueries.some((item) => item.isLoading);
  const chapterError = chapterQueries.some((item) => item.isError);

  return (
    <div className="min-h-[100dvh] bg-[#f6f3ed] text-[#252522]">
      <header className="border-b border-[#e5dfd4] bg-[#fbfaf7]">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/qflow" className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b1a2f] font-serif text-lg font-bold text-white">P</span>
            <span>
              <span className="block font-serif text-base font-bold leading-tight">PreClinik</span>
              <span className="font-mono text-[9px] uppercase tracking-[.2em] text-[#8b1a2f]">QFLOW</span>
            </span>
          </Link>
          <Link href="/qflow/setup" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#766e64] hover:bg-[#f0ece4] hover:text-[#8b1a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
            Practice preferences
          </Link>
          <nav aria-label="PreClinik navigation" className="hidden items-center gap-1 md:flex">
            <Link href="/catalog" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#766e64] hover:bg-[#f0ece4] hover:text-[#8b1a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
              Course catalog
            </Link>
            <Link href="/my-learning" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#766e64] hover:bg-[#f0ece4] hover:text-[#8b1a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
              My learning
            </Link>
            {roleData?.isAdmin && (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-bold text-[#8b1a2f] hover:bg-[#f0ece4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
        <div className="grid gap-8 border-b border-[#ddd6ca] pb-9 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.22em] text-[#8b1a2f]">Question bank · Browse by module</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-.03em] sm:text-5xl">Choose a module.<br className="hidden sm:block" /> Work through its chapters.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#716b62] sm:text-base">
              Find a subject, choose the chapters you want to revise, then start a focused question session.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#e3ddd2] bg-[#fbfaf7] px-4 py-3 text-sm text-[#716b62]">
            <BookOpen className="h-4 w-4 text-[#8b1a2f]" />
            <span>Published QFLOW modules</span>
          </div>
        </div>

        <section aria-labelledby="module-list-title" className="pt-8">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="module-list-title" className="font-serif text-2xl font-semibold">All modules</h2>
              {!isLoading && !isError && (
                <p className="mt-1 text-sm text-[#777168]">{filteredModules.length} {filteredModules.length === 1 ? "module" : "modules"}{query ? " found" : " available"}</p>
              )}
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c857b]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, category, summary"
                aria-label="Search QFLOW modules"
                data-testid="input-search-qflow-modules"
                className="h-11 w-full rounded-xl border border-[#ded8cd] bg-[#fbfaf7] pl-10 pr-10 text-sm outline-none transition focus:border-[#8b1a2f] focus:ring-2 focus:ring-[#8b1a2f]/15"
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#777168] hover:bg-[#eee9e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>

          {isLoading && (
            <div aria-label="Loading modules" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-[#e5dfd4] bg-[#fbfaf7]" />)}
            </div>
          )}
          {isError && (
            <div role="alert" className="rounded-2xl border border-[#e2c9c5] bg-[#fbf4f2] p-8 text-center">
              <CircleHelp className="mx-auto h-7 w-7 text-[#8b1a2f]" />
              <h3 className="mt-3 font-serif text-xl font-semibold">Modules did not load</h3>
              <p className="mt-2 text-sm text-[#716b62]">Check your connection and try again.</p>
              <button type="button" onClick={() => void refetch()} className="mt-5 rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">Retry</button>
            </div>
          )}
          {!isLoading && !isError && filteredModules.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#fbfaf7] px-6 py-14 text-center">
              <Search className="mx-auto h-7 w-7 text-[#8c857b]" />
              <h3 className="mt-3 font-serif text-xl font-semibold">{query ? "No matching modules" : "No published modules yet"}</h3>
              <p className="mt-2 text-sm text-[#777168]">{query ? "Try a different title, category, or keyword." : "Published QFLOW modules will appear here."}</p>
            </div>
          )}
          {!isLoading && !isError && filteredModules.length > 0 && (
            <>
              {chapterError && <p role="status" className="mb-4 rounded-lg border border-[#e8d9bd] bg-[#faf5e9] px-4 py-3 text-sm text-[#715823]">Some chapter counts are temporarily unavailable.</p>}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredModules.map((module) => {
                  const index = publishedModules.findIndex((candidate) => candidate.id === module.id);
                  const chapters = chapterQueries[index]?.data;
                  const questionCount = chapters?.reduce((sum, chapter) => sum + (chapter.questionCount ?? 0), 0);
                  const chapterCount = chapters?.length;
                  return (
                    <article key={module.id} data-testid={`card-qflow-module-${module.id}`} className="group flex min-h-[230px] flex-col overflow-hidden rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8b7a7] hover:shadow-[0_12px_30px_rgba(45,37,29,.08)]">
                      <div className="h-1.5" style={{ background: module.gradient || "#8b1a2f" }} />
                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#8b1a2f]">{module.category}</p>
                            <h3 className="mt-2 font-serif text-xl font-semibold leading-snug">{module.title}</h3>
                          </div>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2e8e5] text-[#8b1a2f]"><BookOpen className="h-4 w-4" /></span>
                        </div>
                        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#716b62]">{module.summary || "Browse the published chapters and practice questions in this module."}</p>
                        <div className="mt-5 flex items-center gap-4 border-t border-[#e9e3d9] pt-4 font-mono text-[10px] uppercase tracking-wide text-[#777168]">
                          <span>{chapterCount === undefined ? (loadingChapters ? "Loading chapters" : "Chapters unavailable") : `${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"}`}</span>
                          <span className="h-1 w-1 rounded-full bg-[#b8aea1]" />
                          <span>{questionCount === undefined ? "— questions" : `${questionCount} ${questionCount === 1 ? "question" : "questions"}`}</span>
                        </div>
                        <Link href={`/qflow/practice/module/${module.id}`} data-testid={`link-qflow-module-${module.id}`} className="mt-5 inline-flex min-h-10 items-center justify-between rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">
                          Browse chapters <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
