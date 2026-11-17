import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Film, ListChecks } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import {
  getGetModuleQueryKey,
  getListLessonsQueryKey,
  getListQflowChaptersQueryKey,
  useGetModule,
  useListLessons,
  useListQflowChapters,
} from "@workspace/api-client-react";
import { trackEvent } from "@/lib/googleAnalytics";

export default function QFlowModuleSelection() {
  const { moduleId = "" } = useParams<{ moduleId: string }>();
  const [, setLocation] = useLocation();
  const { data: module, isLoading: moduleLoading, isError: moduleError, refetch: refetchModule } = useGetModule(moduleId, {
    query: { enabled: !!moduleId, queryKey: getGetModuleQueryKey(moduleId) },
  });
  const { data: chapters, isLoading: chaptersLoading, isError: chaptersError, refetch: refetchChapters } = useListQflowChapters(moduleId, {
    query: { enabled: !!moduleId, queryKey: getListQflowChaptersQueryKey(moduleId) },
  });
  const { data: lessons } = useListLessons(moduleId, {
    query: { enabled: !!moduleId, queryKey: getListLessonsQueryKey(moduleId) },
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const chapterIds = useMemo(() => (chapters ?? []).map((chapter) => chapter.id).join("|"), [chapters]);

  useEffect(() => {
    if (chapters) setSelectedIds(chapters.filter((chapter) => (chapter.questionCount ?? 0) > 0).map((chapter) => chapter.id));
  }, [chapterIds]); // initialize selection when the module's chapter list changes

  const selectedChapters = chapters?.filter((chapter) => selectedIds.includes(chapter.id)) ?? [];
  const questionCount = selectedChapters.reduce((total, chapter) => total + (chapter.questionCount ?? 0), 0);
  const isLoading = moduleLoading || chaptersLoading;

  const startSession = () => {
    if (!selectedIds.length || !questionCount) return;
    trackEvent("qflow_lesson_selection_completed", {
      module_id: moduleId,
      lesson_count: selectedIds.length,
      question_count: questionCount,
    });
    setLocation(`/qflow/session?module=${encodeURIComponent(moduleId)}&lessons=${selectedIds.join(",")}`);
  };

  if (isLoading) return <QFlowFrame><div aria-label="Loading chapters" className="mx-auto max-w-5xl space-y-4 py-8"><div className="h-36 animate-pulse rounded-2xl bg-[#e9e3d9]" /><div className="h-16 animate-pulse rounded-xl bg-[#e9e3d9]" /><div className="h-16 animate-pulse rounded-xl bg-[#e9e3d9]" /></div></QFlowFrame>;

  if (moduleError || chaptersError || !module) {
    return <QFlowFrame><div role="alert" className="mx-auto max-w-xl rounded-2xl border border-[#e5dfd4] bg-[#fbfaf7] p-8 text-center"><CircleHelp className="mx-auto h-8 w-8 text-[#8b1a2f]" /><h1 className="mt-4 font-serif text-2xl font-semibold">{!module ? "Module not available" : "Chapter list did not load"}</h1><p className="mt-2 text-sm text-[#716b62]">The current QFLOW content could not be retrieved.</p><button type="button" onClick={() => { void refetchModule(); void refetchChapters(); }} className="mt-5 rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">Try again</button><div><Link href="/qflow/practice" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#716b62] hover:text-[#8b1a2f]"><ArrowLeft className="h-4 w-4" /> All modules</Link></div></div></QFlowFrame>;
  }

  return (
    <QFlowFrame>
      <div className="mx-auto max-w-5xl">
        <Link href="/qflow/practice" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-[#716b62] hover:text-[#8b1a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]"><ArrowLeft className="h-4 w-4" /> All modules</Link>
        <section className="mt-6 rounded-[24px] bg-[#542b32] p-6 text-[#fffaf5] sm:p-9">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#e4c8a1]">QFLOW · {module.category}</p>
          <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">{module.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Select chapters to shape your practice session. Published teaching videos linked to each chapter are listed alongside it.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[.08] px-4 py-3">
              <ListChecks className="h-5 w-5 text-[#e4c8a1]" />
              <div><div className="font-serif text-xl font-semibold">{questionCount}</div><div className="font-mono text-[9px] uppercase tracking-wider text-white/60">selected questions</div></div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8b1a2f]">Chapter selection</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">Build your session</h2>
              <p className="mt-1 text-sm text-[#716b62]">{selectedChapters.length} of {chapters?.length ?? 0} chapters selected</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedIds((chapters ?? []).filter((chapter) => (chapter.questionCount ?? 0) > 0).map((chapter) => chapter.id))} className="rounded-lg border border-[#ded8cd] bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#514b44] hover:border-[#bba79b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">Select available</button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-[#ded8cd] bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#716b62] hover:border-[#bba79b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">Clear</button>
            </div>
          </div>

          {!chapters?.length ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d8d0c4] bg-[#fbfaf7] px-6 py-14 text-center"><BookOpen className="mx-auto h-7 w-7 text-[#8c857b]" /><h3 className="mt-3 font-serif text-xl font-semibold">No chapters published</h3><p className="mt-2 text-sm text-[#716b62]">There are no QFLOW chapters available in this module yet.</p></div>
          ) : (
            <div className="mt-5 space-y-3">
              {chapters.map((chapter, index) => {
                const selected = selectedIds.includes(chapter.id);
                const hasQuestions = (chapter.questionCount ?? 0) > 0;
                const linkedFromChapter = (chapter.linkedLessons ?? []).filter((lesson) => lesson.type === "Video" && lesson.published);
                const linkedFromModule = (lessons ?? []).filter((lesson) => lesson.type === "Video" && lesson.published && lesson.qflowChapterId === chapter.id);
                const linkedLessons = [...new Map([...linkedFromChapter, ...linkedFromModule].map((lesson) => [lesson.id, lesson])).values()];
                return (
                  <article key={chapter.id} data-testid={`chapter-${chapter.id}`} className={`rounded-2xl border bg-[#fbfaf7] transition-colors ${selected ? "border-[#b98d91] shadow-[0_3px_14px_rgba(55,35,30,.05)]" : "border-[#e3ddd2]"}`}>
                    <button type="button" disabled={!hasQuestions} aria-pressed={selected} onClick={() => setSelectedIds((current) => current.includes(chapter.id) ? current.filter((id) => id !== chapter.id) : [...current, chapter.id])} className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b1a2f] disabled:cursor-not-allowed disabled:opacity-65 sm:gap-4 sm:p-5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-bold ${selected ? "border-[#8b1a2f] bg-[#8b1a2f] text-white" : "border-[#ded8cd] bg-[#f3efe8] text-[#716b62]"}`}>{selected ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-serif text-base font-semibold sm:text-lg">{chapter.title}<span className="rounded-md bg-[#f2e8e5] px-2 py-1 font-mono text-[9px] font-bold tracking-wide text-[#8b1a2f]">{chapter.qflowChapterCode || chapter.id}</span></span>
                        <span className="mt-1 block text-xs leading-5 text-[#777168]">{chapter.summary || "Questions and teaching resources for this chapter."}</span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block"><span className="block font-mono text-xs font-bold text-[#514b44]">{chapter.questionCount ?? 0}</span><span className="font-mono text-[9px] uppercase tracking-wide text-[#8c857b]">questions</span></span>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${selected ? "text-[#8b1a2f]" : "text-[#a59d92]"}`} />
                    </button>
                    <div className="flex flex-col gap-2 border-t border-[#eee8df] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <span className="font-mono text-[10px] text-[#777168]">{hasQuestions ? `${chapter.questionCount} ${chapter.questionCount === 1 ? "question" : "questions"} available` : "No questions available yet"}</span>
                      {linkedLessons.length > 0 ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {linkedLessons.map((lesson) => (
                            <Link key={lesson.id} href={`/modules/${lesson.moduleId}/lessons/${lesson.id}`} data-testid={`link-video-lesson-${lesson.id}`} className="inline-flex items-center gap-2 rounded-md text-xs font-semibold text-[#8b1a2f] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
                              <Film className="h-3.5 w-3.5" /> {lesson.title} <span className="font-normal text-[#8c857b]">{lesson.duration}</span>
                            </Link>
                          ))}
                        </div>
                      ) : <span className="text-xs text-[#9a9388]">No published video linked</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="sticky bottom-3 z-10 mt-7 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7]/95 p-4 shadow-[0_10px_30px_rgba(45,37,29,.12)] backdrop-blur sm:flex-row sm:items-center sm:px-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2e8e5] text-[#8b1a2f]"><BookOpen className="h-5 w-5" /></span><div><div className="text-sm font-bold">{selectedChapters.length} {selectedChapters.length === 1 ? "chapter" : "chapters"} · {questionCount} {questionCount === 1 ? "question" : "questions"}</div><div className="text-xs text-[#777168]">Only chapters with questions can be selected.</div></div></div>
          <button type="button" disabled={!selectedChapters.length || !questionCount} onClick={startSession} data-testid="button-start-qflow-session" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#8b1a2f] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f] disabled:cursor-not-allowed disabled:opacity-45">Start practice <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </QFlowFrame>
  );
}

function QFlowFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#f6f3ed] text-[#252522]"><header className="border-b border-[#e5dfd4] bg-[#fbfaf7]"><div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/qflow/practice" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b1a2f] font-serif text-lg font-bold text-white">P</span><span><span className="block font-serif text-base font-bold leading-tight">PreClinik</span><span className="font-mono text-[9px] uppercase tracking-[.2em] text-[#8b1a2f]">QFLOW</span></span></Link><span className="hidden text-xs font-semibold text-[#716b62] sm:block">Focused question practice</span></div></header><main className="px-5 py-7 sm:px-8 sm:py-9">{children}</main></div>;
}
