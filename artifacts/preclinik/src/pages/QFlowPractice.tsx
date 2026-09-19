import { useMemo } from "react";
import { ArrowRight, BarChart3, BookOpen, Check, ChevronRight, Flame, LayoutDashboard, Library, ListChecks, LogOut, Menu, Play, Settings2, Target, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useListModules } from "@workspace/api-client-react";
import { trackEvent } from "@/lib/googleAnalytics";
import { readQFlowProfile } from "./QFlowSetup";

const fallbackColors = [
  "linear-gradient(135deg, #8b1a2f, #b9852e)",
  "linear-gradient(135deg, #b9852e, #d6b96c)",
  "linear-gradient(135deg, #536f64, #9aaf8c)",
  "linear-gradient(135deg, #7b4d68, #c58c9d)",
];

export default function QFlowPractice() {
  const [, setLocation] = useLocation();
  const profile = useMemo(() => readQFlowProfile(), []);
  const { data: modules, isLoading } = useListModules({ published: true });
  const visibleModules = modules?.slice(0, 6) ?? [];

  const displayName = profile?.university ? profile.university.replace("University of ", "") : "your medical school";
  const currentUnit = profile?.unit ?? "your current unit";

  const beginPractice = (label: string) => {
    trackEvent("qflow_practice_started", { practice_type: label, unit: currentUnit });
    setLocation(`/qflow/practice?mode=${encodeURIComponent(label)}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#1a1211]">
      <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#e8ddd5] bg-white/90 px-5 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-4">
          <Link href="/qflow" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#b9852e] font-serif text-xl font-bold text-white shadow-sm">P</div>
            <div className="hidden sm:block">
              <div className="font-serif text-lg font-bold leading-tight">PreClinik</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">QFLOW</div>
            </div>
          </Link>
          <div className="hidden h-7 w-px bg-border sm:block" />
          <div className="hidden items-center gap-2 text-sm font-semibold text-muted-foreground sm:flex">
            <span>Q-bank home</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">Practice</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/qflow/setup" className="hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary sm:inline-flex">
            <Settings2 className="h-3.5 w-3.5" />
            Edit profile
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
            <UserRound className="h-4 w-4" />
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="hidden w-[230px] shrink-0 border-r border-[#e8ddd5] bg-white px-4 py-6 lg:block">
          <div className="mb-7 px-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Your QFLOW</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{displayName}</p>
          </div>
          <nav className="space-y-1">
            <PracticeNavItem icon={LayoutDashboard} label="Home" active />
            <PracticeNavItem icon={ListChecks} label="Question bank" />
            <PracticeNavItem icon={BarChart3} label="My progress" />
            <PracticeNavItem icon={BookOpen} label="Saved questions" />
          </nav>
          <div className="mt-auto border-t border-border pt-5">
            <Link href="/qflow" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Exit QFLOW
            </Link>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-8 lg:px-10">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="h-2 w-2 rounded-full bg-[#3f7d5b]" />
                QFLOW is ready
              </div>
              <h1 className="mt-3 font-serif text-3xl font-bold leading-tight sm:text-4xl">Welcome back to your practice.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Keep your momentum going with a focused mix for <span className="font-semibold text-foreground">{currentUnit}</span>.
              </p>
            </div>
            <button type="button" className="rounded-xl border border-border bg-white p-2.5 text-muted-foreground lg:hidden" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <section className="relative overflow-hidden rounded-[24px] bg-primary p-6 text-white shadow-lg shadow-primary/15 sm:p-8">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/15" />
            <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-[#b9852e]/25 blur-2xl" />
            <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Daily mix · 10 questions</div>
                <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">Start with a small win.</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                  A balanced session built to keep your recall sharp without taking over your day.
                </p>
                <button type="button" onClick={() => beginPractice("Daily mix")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary transition-all hover:-translate-y-0.5 hover:bg-[#fffaf4]">
                  Start daily mix
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <PracticeStat icon={Flame} value="0" label="day streak" />
                <PracticeStat icon={Target} value="0%" label="accuracy" />
                <PracticeStat icon={Check} value="0" label="answered" />
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Choose your path</p>
                <h2 className="mt-2 font-serif text-2xl font-bold">Continue your learning</h2>
              </div>
              <Link href="/catalog" className="hidden items-center gap-1 text-sm font-bold text-primary hover:underline sm:flex">
                Browse modules <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {isLoading && [1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-[22px] border border-border bg-white" />)}
              {!isLoading && visibleModules.map((module, index) => (
                <PracticeModuleCard
                  key={module.id}
                  title={module.title}
                  meta={`${module.category} · ${module.lessonCount ?? 0} lessons`}
                  summary={module.summary}
                  gradient={module.gradient || fallbackColors[index % fallbackColors.length]}
                  onStart={() => beginPractice(module.title)}
                />
              ))}
              {!isLoading && visibleModules.length === 0 && (
                <div className="col-span-full rounded-[22px] border border-dashed border-border bg-white p-10 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <h3 className="mt-3 font-serif text-xl font-bold">Your question paths are being prepared</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Published modules will appear here as soon as they are available.</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function PracticeNavItem({ icon: Icon, label, active = false }: { icon: typeof BookOpen; label: string; active?: boolean }) {
  return (
    <button type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function PracticeStat({ icon: Icon, value, label }: { icon: typeof Flame; value: string; label: string }) {
  return (
    <div className="min-w-[78px] rounded-2xl border border-white/15 bg-white/10 p-3 sm:min-w-[100px] sm:p-4">
      <Icon className="h-4 w-4 text-[#d7b86a]" />
      <div className="mt-4 font-serif text-2xl font-bold">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

function PracticeModuleCard({
  title,
  meta,
  summary,
  gradient,
  onStart,
}: {
  title: string;
  meta: string;
  summary?: string;
  gradient: string;
  onStart: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-28 overflow-hidden p-5 text-white" style={{ background: gradient }}>
        <div className="absolute -right-4 -top-8 h-28 w-28 rounded-full border border-white/20" />
        <div className="relative flex h-full flex-col justify-between">
          <BookOpen className="h-6 w-6 opacity-85" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{meta}</p>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-lg font-bold leading-snug">{title}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{summary || "Practice focused questions and build confidence one answer at a time."}</p>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Not started</span>
          <button type="button" onClick={onStart} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-primary hover:text-white">
            Practice <Play className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}