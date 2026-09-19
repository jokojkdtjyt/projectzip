import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, ListChecks, Loader2, Sparkles } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useGetModule, useListLessons } from "@workspace/api-client-react";
import { trackEvent } from "@/lib/googleAnalytics";
import { readQFlowProfile } from "./QFlowSetup";

export default function QFlowModuleSelection() {
  const { moduleId = "" } = useParams<{ moduleId: string }>();
  const [, setLocation] = useLocation();
  const profile = useMemo(() => readQFlowProfile(), []);
  const { data: module, isLoading: moduleLoading } = useGetModule(moduleId, { query: { enabled: !!moduleId } });
  const { data: lessons, isLoading: lessonsLoading } = useListLessons(moduleId, { query: { enabled: !!moduleId } });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!lessons) return;
    setSelectedIds(lessons.filter((lesson) => (lesson.questionCount ?? 0) > 0).map((lesson) => lesson.id));
  }, [lessons]);

  const selectedLessons = lessons?.filter((lesson) => selectedIds.includes(lesson.id)) ?? [];
  const questionCount = selectedLessons.reduce((total, lesson) => total + (lesson.questionCount ?? 0), 0);
  const isLoading = moduleLoading || lessonsLoading;

  const toggleLesson = (lessonId: string) => {
    setSelectedIds((current) => current.includes(lessonId) ? current.filter((id) => id !== lessonId) : [...current, lessonId]);
  };

  const startSession = () => {
    if (!selectedIds.length || !questionCount) return;
    trackEvent("qflow_lesson_selection_completed", {
      module_id: moduleId,
      lesson_count: selectedIds.length,
      question_count: questionCount,
    });
    setLocation(`/qflow/session?module=${encodeURIComponent(moduleId)}&lessons=${selectedIds.join(",")}`);
  };

  if (isLoading) {
    return <QFlowFrame><div className="flex min-h-[55vh] items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading lessons…</div></QFlowFrame>;
  }

  if (!module) {
    return <QFlowFrame><EmptyState title="Module not found" message="This QFLOW module is no longer available." /></QFlowFrame>;
  }

  return (
    <QFlowFrame>
      <div className="mx-auto max-w-5xl">
        <Link href="/qflow/practice" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Q-bank home
        </Link>

        <div className="mt-7 overflow-hidden rounded-[26px] bg-primary p-6 text-white shadow-lg shadow-primary/15 sm:p-8">
          <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-[#d7b86a]" />
                Build your practice session
              </div>
              <h1 className="mt-3 max-w-2xl font-serif text-3xl font-bold leading-tight sm:text-4xl">{module.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                Pick the chapters you want to revise. QFLOW will combine their questions into one focused session.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <CircleHelp className="h-5 w-5 text-[#d7b86a]" />
              <div>
                <div className="font-serif text-xl font-bold">{questionCount}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/60">questions selected</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Choose chapters</p>
            <h2 className="mt-2 font-serif text-2xl font-bold">What do you want to be tested on?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile?.year ? `${profile.year} · ` : ""}{selectedLessons.length} of {lessons?.length ?? 0} chapters selected
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelectedIds(lessons?.filter((lesson) => (lesson.questionCount ?? 0) > 0).map((lesson) => lesson.id) ?? [])} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary">Select all</button>
            <button type="button" onClick={() => setSelectedIds([])} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary">Clear</button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {(lessons ?? []).map((lesson, index) => {
            const selected = selectedIds.includes(lesson.id);
            const hasQuestions = (lesson.questionCount ?? 0) > 0;
            return (
              <button
                type="button"
                key={lesson.id}
                disabled={!hasQuestions}
                onClick={() => toggleLesson(lesson.id)}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5 ${selected ? "border-primary/35 bg-primary/[0.045] shadow-sm" : "border-border bg-white hover:border-primary/20 hover:shadow-sm"} ${!hasQuestions ? "cursor-not-allowed opacity-55" : ""}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-bold ${selected ? "border-primary bg-primary text-white" : "border-border bg-secondary/50 text-muted-foreground"}`}>
                  {selected ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-base font-bold text-foreground sm:text-lg">{lesson.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{lesson.summary || "Questions focused on this chapter."}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
                  <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> {lesson.duration}</span>
                  <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-primary" /> {hasQuestions ? `${lesson.questionCount} questions` : "No questions yet"}</span>
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selected ? "text-primary" : "text-muted-foreground/50"}`} />
              </button>
            );
          })}
        </div>

        {!lessons?.length && <EmptyState title="No chapters available" message="This module does not have published chapters yet." />}

        <div className="sticky bottom-4 z-10 mt-8 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-border bg-white/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
            <div>
              <div className="font-bold text-foreground">{selectedLessons.length} chapters · {questionCount} questions</div>
              <div className="text-xs text-muted-foreground">You can change this selection anytime.</div>
            </div>
          </div>
          <button type="button" disabled={!selectedLessons.length || !questionCount} onClick={startSession} className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
            Start Q-bank <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </QFlowFrame>
  );
}

function QFlowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f3ec] text-[#1a1211]">
      <header className="border-b border-[#e8ddd5] bg-white/90 px-5 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between">
          <Link href="/qflow/practice" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#b9852e] font-serif text-xl font-bold text-white shadow-sm transition-transform group-hover:scale-105">P</div>
            <div><div className="font-serif text-lg font-bold leading-tight">PreClinik</div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">QFLOW</div></div>
          </Link>
          <span className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex"><BookOpen className="h-4 w-4 text-primary" /> Focused question practice</span>
        </div>
      </header>
      <main className="px-5 py-7 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="mt-8 rounded-[22px] border border-dashed border-border bg-white p-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" /><h2 className="mt-3 font-serif text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p></div>;
}