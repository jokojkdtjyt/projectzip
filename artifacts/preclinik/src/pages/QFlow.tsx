import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Layers3,
  Sparkles,
  Target,
} from "lucide-react";
import { trackEvent } from "@/lib/googleAnalytics";

const benefits = [
  {
    icon: Target,
    title: "Exam-focused practice",
    description:
      "Train with carefully written questions that reflect the pace and pressure of medical exams.",
  },
  {
    icon: Sparkles,
    title: "Learn from every answer",
    description:
      "Understand why an option is right, not just whether you got it right.",
  },
  {
    icon: Flame,
    title: "Build your momentum",
    description:
      "Keep your streak alive, spot weak areas, and turn small sessions into real progress.",
  },
];

const sampleQuestions = [
  { label: "Anatomy", count: "420 questions", tone: "bg-[#f6e7e9] text-primary" },
  { label: "Physiology", count: "680 questions", tone: "bg-[#f7f3ec] text-primary" },
  { label: "Biochemistry", count: "350 questions", tone: "bg-[#f6e7e9] text-primary" },
];

export default function QFlow() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f3ec] text-[#1a1211]">
      <header className="relative z-10 border-b border-[#e8ddd5] bg-white/90 px-6 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f7f3ec] to-primary font-serif text-xl font-bold text-primary shadow-lg shadow-white/10 transition-transform group-hover:scale-105">
              P
            </div>
            <div className="hidden sm:block">
              <div className="font-serif text-lg font-bold leading-tight">PreClinik</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                QFLOW by PreClinik
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Back to PreClinik
            </Link>
            <Link
              href="/sign-up"
              onClick={() =>
                trackEvent("qflow_cta_click", {
                  cta_location: "qflow_header",
                  page_path: "/qflow",
                })
              }
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate">
          <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-24 h-[480px] w-[480px] rounded-full bg-white/80 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:pb-32 lg:pt-28">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                The PreClinik question bank
              </div>
              <h1 className="max-w-2xl font-serif text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-7xl">
                Make every question{" "}
                <span className="text-primary">move you forward.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                QFLOW is the focused medical Q-bank for students who want less
                guessing and more progress. Practice, review, repeat — until
                the answer feels instinctive.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  onClick={() =>
                    trackEvent("qflow_cta_click", {
                      cta_location: "qflow_hero",
                      page_path: "/qflow",
                    })
                  }
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  Start practicing free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e8ddd5] bg-white px-6 py-3.5 font-bold text-foreground transition-colors hover:border-primary/30 hover:bg-[#f7f3ec]"
                >
                  Explore modules
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Five-option questions</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Detailed explanations</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-5 rounded-[32px] border border-primary/10 bg-white/60 rotate-3" />
              <div className="relative rounded-[28px] border border-[#e8ddd5] bg-white p-5 shadow-2xl shadow-[#8b1a2f]/10">
                <div className="flex items-center justify-between border-b border-[#e8ddd5] pb-4">
                  <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">QFLOW / DAILY MIX</div>
                    <div className="mt-1 font-serif text-xl font-bold">Keep your flow</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Flame className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-[#e8ddd5] bg-[#f7f3ec] p-4">
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>QUESTION 08 / 20</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> 01:24</span>
                  </div>
                  <p className="mt-5 font-serif text-lg font-bold leading-snug">
                    Which structure is primarily responsible for the filtration of blood in the renal corpuscle?
                  </p>
                  <div className="mt-5 space-y-2">
                    {["The glomerular capillaries", "The loop of Henle", "The collecting duct", "The renal pelvis"].map((answer, index) => (
                      <div key={answer} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${index === 0 ? "border-primary/40 bg-primary/5 text-foreground" : "border-[#e8ddd5] bg-white/70 text-muted-foreground"}`}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs ${index === 0 ? "bg-primary text-white" : "bg-[#e8ddd5] text-muted-foreground"}`}>
                          {String.fromCharCode(65 + index)}
                        </span>
                        {answer}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" /> Renal physiology</span>
                  <span className="flex items-center gap-1 text-primary">Answer saved <Check className="h-3 w-3" /></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e8ddd5] bg-white px-6 py-8">
          <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
            {sampleQuestions.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[#e8ddd5] bg-[#f7f3ec] px-4 py-3">
                <span className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${item.tone}`}>{item.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
              <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Built for the long game</div>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-5xl">A better rhythm for medical revision.</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              QFLOW turns scattered revision into a clear daily practice. Every session gives you feedback you can use next time.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="rounded-[22px] border border-[#e8ddd5] bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-bold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#f7f3ec] px-6 py-16 text-center text-[#211218]">
          <h2 className="font-serif text-4xl font-bold">Your next right answer starts here.</h2>
          <p className="mx-auto mt-4 max-w-lg text-[#211218]/70">Join PreClinik and build a question practice that compounds every day.</p>
           <Link
             href="/sign-up"
             onClick={() =>
               trackEvent("qflow_cta_click", {
                 cta_location: "qflow_footer",
                 page_path: "/qflow",
               })
             }
             className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-bold text-white transition-colors hover:bg-primary/90"
           >
            Enter QFLOW <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="mx-auto mt-12 flex max-w-6xl items-center justify-center gap-4 border-t border-[#211218]/15 pt-5 font-mono text-xs text-[#211218]/55">
            <span>© {new Date().getFullYear()} PreClinik</span>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#211218]">Terms & Privacy</Link>
          </div>
        </section>
      </main>
    </div>
  );
}