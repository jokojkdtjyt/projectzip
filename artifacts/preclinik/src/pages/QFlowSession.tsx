import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Check, Clipboard, Flag, Lightbulb, List, Loader2, Pause, Play, RotateCcw, Timer, X, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getGetModuleQueryKey, getListQflowChaptersQueryKey, listQflowChapterQuestions, type Question, useGetModule, useListQflowChapters } from "@workspace/api-client-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/googleAnalytics";
import { readQFlowProfile } from "./QFlowSetup";

const SAVED_QUESTIONS_KEY = "preclinik_qflow_saved_questions";

type SessionQuestion = Question & { lessonTitle: string };

export default function QFlowSession() {
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const moduleId = params.get("module") ?? "";
  const lessonIds = (params.get("lessons") ?? "").split(",").filter(Boolean);
  const profile = useMemo(() => readQFlowProfile(), []);
  const { data: module } = useGetModule(moduleId, { query: { enabled: !!moduleId, queryKey: getGetModuleQueryKey(moduleId) } });
  const { data: lessons } = useListQflowChapters(moduleId, { query: { enabled: !!moduleId, queryKey: getListQflowChaptersQueryKey(moduleId) } });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [savedIds, setSavedIds] = useState<number[]>(() => readSavedIds());
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [completed, setCompleted] = useState(false);

  const questionQuery = useQuery({
    queryKey: ["/qflow/session/questions", moduleId, ...lessonIds],
    enabled: !!moduleId && lessonIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(lessonIds.map((lessonId) => listQflowChapterQuestions(moduleId, lessonId)));
      const titleMap = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]));
      return results.flat().map((question) => ({ ...question, lessonTitle: titleMap.get(question.lessonId) ?? "Selected chapter" }));
    },
  });
  const questions = questionQuery.data ?? [];
  const currentQuestion = questions[questionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const hasAnsweredCurrent = currentAnswer !== undefined;
  const correctCount = Object.entries(answers).filter(([id, answer]) => questions.find((question) => question.id === Number(id))?.correct === answer).length;
  const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  useEffect(() => {
    if (questions.length && !secondsLeft) setSecondsLeft(Math.max(300, questions.length * 90));
  }, [questions.length, secondsLeft]);

  useEffect(() => {
    if (timerPaused || completed || secondsLeft <= 0) return;
    const interval = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timerPaused, completed, secondsLeft]);

  useEffect(() => {
    setSelectedAnswer(currentAnswer ?? null);
  }, [currentQuestion?.id, currentAnswer]);

  if (questionQuery.isLoading) return <SessionFrame><div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Building your question set…</div></SessionFrame>;
  if (questionQuery.isError || !questions.length) return <SessionFrame><div className="mx-auto max-w-xl py-20 text-center"><Zap className="mx-auto h-10 w-10 text-[#b9852e]" /><h1 className="mt-5 font-serif text-3xl font-bold">No questions found</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">The selected chapters do not have available questions yet. Choose another set to continue.</p><Link href={`/qflow/practice/module/${moduleId}`} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">Change chapters</Link></div></SessionFrame>;
  if (completed) return <CompletionView moduleTitle={module?.title ?? "QFLOW"} questions={questions} correctCount={correctCount} percent={percent} onBack={() => setLocation("/qflow/practice")} onRetry={() => { setQuestionIndex(0); setAnswers({}); setCompleted(false); setSecondsLeft(Math.max(300, questions.length * 90)); }} />;

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const saved = currentQuestion ? savedIds.includes(currentQuestion.id) : false;

  const submitAnswer = () => {
    if (selectedAnswer === null || !currentQuestion || hasAnsweredCurrent) return;
    setAnswers((current) => ({ ...current, [currentQuestion.id]: selectedAnswer }));
    trackEvent("qflow_question_answered", { question_id: currentQuestion.id, module_id: moduleId, correct: selectedAnswer === currentQuestion.correct });
  };

  const nextQuestion = () => {
    if (!hasAnsweredCurrent) return;
    if (questionIndex === questions.length - 1) {
      setCompleted(true);
      trackEvent("qflow_session_completed", { module_id: moduleId, question_count: questions.length, correct_count: correctCount });
    } else {
      setQuestionIndex((index) => index + 1);
    }
  };

  const toggleSaved = () => {
    if (!currentQuestion) return;
    setSavedIds((current) => {
      const next = current.includes(currentQuestion.id) ? current.filter((id) => id !== currentQuestion.id) : [...current, currentQuestion.id];
      window.localStorage.setItem(SAVED_QUESTIONS_KEY, JSON.stringify(next));
      return next;
    });
    toast.success(saved ? "Question removed from saved" : "Question saved for later");
  };

  const copyQuestion = async () => {
    if (!currentQuestion) return;
    await navigator.clipboard?.writeText(`${currentQuestion.question}\n\n${currentQuestion.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}`);
    toast.success("Question copied to clipboard");
  };

  return (
    <SessionFrame>
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/qflow/practice/module/${moduleId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="h-4 w-4" /> Change chapters</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTimerPaused((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${timerPaused ? "border-[#b9852e]/30 bg-[#fff8e9] text-[#8b6421]" : "border-border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary"}`}>
              {timerPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{timerPaused ? "Resume" : "Pause"}
            </button>
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-xs font-bold ${secondsLeft < 60 ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-white text-foreground"}`}><Timer className="h-3.5 w-3.5" /> {minutes}:{seconds}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{module?.title ?? "QFLOW"} · {currentQuestion.lessonTitle}</p>
                <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">Question {questionIndex + 1} <span className="font-sans text-base font-normal text-muted-foreground">of {questions.length}</span></h1>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-border">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Your progress</div>
                <div className="mt-1 text-sm font-bold text-foreground">{Object.keys(answers).length} answered · {percent}% correct</div>
              </div>
            </div>

            <div className="rounded-[26px] border border-border bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> Single best answer</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{profile?.year ?? "Medical school"}</div>
              </div>
              <h2 className="mt-7 max-w-4xl font-serif text-xl font-bold leading-relaxed sm:text-2xl">{currentQuestion.question}</h2>
              <div className="mt-7 space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = currentQuestion.correct === index;
                  const isWrongSelection = hasAnsweredCurrent && isSelected && !isCorrect;
                  return (
                    <button type="button" key={`${currentQuestion.id}-${index}`} disabled={hasAnsweredCurrent} onClick={() => setSelectedAnswer(index)} className={`group flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all sm:p-4 ${hasAnsweredCurrent && isCorrect ? "border-[#3f7d5b]/45 bg-[#3f7d5b]/10" : isWrongSelection ? "border-red-300 bg-red-50" : isSelected ? "border-primary/45 bg-primary/5 shadow-sm" : "border-border bg-[#f7f3ec]/45 hover:border-primary/25 hover:bg-primary/[0.03]"}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold ${hasAnsweredCurrent && isCorrect ? "bg-[#3f7d5b] text-white" : isWrongSelection ? "bg-red-500 text-white" : isSelected ? "bg-primary text-white" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                        {hasAnsweredCurrent && isCorrect ? <Check className="h-4 w-4" /> : isWrongSelection ? <X className="h-4 w-4" /> : String.fromCharCode(65 + index)}
                      </span>
                      <span className="pt-1 text-sm leading-relaxed text-foreground">{option}</span>
                    </button>
                  );
                })}
              </div>

              {hasAnsweredCurrent && (
                <div className={`mt-6 rounded-2xl border p-4 ${currentAnswer === currentQuestion.correct ? "border-[#3f7d5b]/30 bg-[#3f7d5b]/10" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center gap-2 text-sm font-bold">{currentAnswer === currentQuestion.correct ? <Check className="h-4 w-4 text-[#3f7d5b]" /> : <X className="h-4 w-4 text-red-600" />}{currentAnswer === currentQuestion.correct ? "Correct answer" : "Review this one"}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentQuestion.comment || "Keep the reasoning in mind as you move to the next question."}</p>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <ToolButton icon={saved ? Check : Bookmark} label={saved ? "Saved" : "Save"} active={saved} onClick={toggleSaved} />
                  <ToolButton icon={Clipboard} label="Copy" onClick={copyQuestion} />
                  <ToolButton icon={Flag} label="Report" onClick={() => toast.success("Thanks — we’ll review this question")} />
                </div>
                {hasAnsweredCurrent ? (
                  <button type="button" onClick={nextQuestion} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90">
                    {questionIndex === questions.length - 1 ? "Finish session" : "Next question"} <ArrowRightIcon />
                  </button>
                ) : (
                  <button type="button" disabled={selectedAnswer === null} onClick={submitAnswer} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">
                    Check answer <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </main>

          <aside className="h-fit rounded-[22px] border border-border bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold"><List className="h-4 w-4 text-primary" /> Questions</div>
              <span className="font-mono text-[10px] text-muted-foreground">{Object.keys(answers).length}/{questions.length}</span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {questions.map((question, index) => {
                const answered = answers[question.id] !== undefined;
                const correct = answered && answers[question.id] === question.correct;
                return <button type="button" key={question.id} onClick={() => setQuestionIndex(index)} className={`flex h-9 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${index === questionIndex ? "bg-primary text-white ring-2 ring-primary/20" : answered && correct ? "bg-[#3f7d5b]/15 text-[#3f7d5b]" : answered ? "bg-red-50 text-red-600" : "bg-secondary/70 text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}>{index + 1}</button>;
              })}
            </div>
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-start gap-3 rounded-xl bg-[#f7f3ec] p-3"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#b9852e]" /><p className="text-xs leading-relaxed text-muted-foreground">Read the explanation after every answer. Understanding the why is what makes the recall stick.</p></div>
            </div>
          </aside>
        </div>
      </div>
    </SessionFrame>
  );
}

function SessionFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f7f3ec] text-[#1a1211]"><header className="border-b border-[#e8ddd5] bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between"><Link href="/qflow/practice" className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#b9852e] font-serif text-xl font-bold text-white shadow-sm">P</div><div><div className="font-serif text-lg font-bold leading-tight">PreClinik</div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">QFLOW</div></div></Link><div className="hidden items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground sm:flex"><Zap className="h-4 w-4 text-[#b9852e]" /> Focus mode</div></div></header><main className="px-5 py-7 sm:px-8 sm:py-10">{children}</main></div>;
}

function ToolButton({ icon: Icon, label, onClick, active = false }: { icon: typeof Bookmark; label: string; onClick: () => void; active?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-white text-muted-foreground hover:border-primary/25 hover:text-primary"}`}><Icon className="h-3.5 w-3.5" /> {label}</button>;
}

function CompletionView({ moduleTitle, questions, correctCount, percent, onBack, onRetry }: { moduleTitle: string; questions: SessionQuestion[]; correctCount: number; percent: number; onBack: () => void; onRetry: () => void }) {
  return <SessionFrame><div className="mx-auto max-w-2xl py-10 text-center sm:py-16"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3f7d5b]/15 text-[#3f7d5b]"><Check className="h-8 w-8" /></div><p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Session complete</p><h1 className="mt-3 font-serif text-4xl font-bold">Nice work. Keep the flow.</h1><p className="mt-3 text-muted-foreground">{moduleTitle} · {questions.length} questions reviewed</p><div className="mt-8 grid grid-cols-3 gap-3"><SummaryStat value={`${percent}%`} label="score" /><SummaryStat value={`${correctCount}/${questions.length}`} label="correct" /><SummaryStat value={`${questions.length}`} label="reviewed" /></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 py-3 text-sm font-bold text-foreground hover:border-primary/30 hover:text-primary"><RotateCcw className="h-4 w-4" /> Try again</button><button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90">Back to Q-bank <ArrowLeft className="h-4 w-4" /></button></div></div></SessionFrame>;
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="font-serif text-2xl font-bold text-foreground">{value}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}

function readSavedIds(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_QUESTIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}