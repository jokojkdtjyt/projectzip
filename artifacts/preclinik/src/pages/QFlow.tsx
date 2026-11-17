import { Link } from "wouter";
import { ArrowRight, Check, ChevronRight, CircleHelp, Layers3, Target, Video } from "lucide-react";
import { trackEvent } from "@/lib/googleAnalytics";

const principles = [
  { icon: Target, title: "Practice by chapter", description: "Choose a module, select the chapters you need, and bring their questions into one session." },
  { icon: CircleHelp, title: "Understand the answer", description: "Review the explanation after each response, so practice becomes a useful part of revision." },
  { icon: Video, title: "Return to the teaching", description: "Open published video lessons linked to a chapter when you want to revisit the topic." },
];

export default function QFlow() {
  const trackCta = (location: string) => trackEvent("qflow_cta_click", { cta_location: location, page_path: "/qflow" });

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#f6f3ed] text-[#252522]">
      <header className="relative z-10 border-b border-[#e5dfd4] bg-[#fbfaf7]/95 px-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b1a2f] font-serif text-lg font-bold text-white">P</span>
            <span><span className="block font-serif text-base font-bold leading-tight">PreClinik</span><span className="font-mono text-[9px] uppercase tracking-[.2em] text-[#8b1a2f]">QFLOW</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-sm text-[#716b62] hover:text-[#252522] sm:block">Back to PreClinik</Link>
            <Link href="/sign-up" onClick={() => trackCta("qflow_header")} className="rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full border border-[#8b1a2f]/10" />
          <div className="pointer-events-none absolute -right-36 top-20 h-[460px] w-[460px] rounded-full bg-[#ded6c9]/45 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c8bb] bg-[#fbfaf7] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#8b1a2f]"><span className="h-1.5 w-1.5 rounded-full bg-[#8b1a2f]" /> The PreClinik question bank</div>
              <h1 className="mt-7 max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-[-.04em] sm:text-7xl">Make every question <span className="text-[#8b1a2f]">move you forward.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#716b62] sm:text-lg">QFLOW gives medical students a direct way to practice by module and chapter. Answer, review the explanation, and return to a linked teaching video when you need it.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/qflow/practice" onClick={() => trackCta("qflow_hero")} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#8b1a2f] px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">Browse QFLOW modules <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
                <Link href="/catalog" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#ded8cd] bg-[#fbfaf7] px-6 py-3 font-bold text-[#39352f] transition-colors hover:border-[#c8b7a7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">Explore courses</Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-wide text-[#716b62]"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#8b1a2f]" /> Practice selected chapters</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#8b1a2f]" /> Review answer explanations</span></div>
            </div>

            <div className="relative mx-auto w-full max-w-[470px]">
              <div className="absolute -inset-4 rotate-2 rounded-[28px] border border-[#d8c8bb] bg-[#eee8df]" />
              <div className="relative rounded-[24px] border border-[#e3ddd2] bg-[#fbfaf7] p-5 shadow-[0_24px_60px_rgba(45,37,29,.12)] sm:p-6">
                <div className="flex items-center justify-between border-b border-[#e9e3d9] pb-4">
                  <div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#8b1a2f]">QFLOW · How it works</p><h2 className="mt-1 font-serif text-xl font-semibold">A clear path through revision</h2></div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2e8e5] text-[#8b1a2f]"><Layers3 className="h-5 w-5" /></span>
                </div>
                <div className="mt-5 space-y-3">
                  {[["01", "Choose a module", "Start from the subject you are revising."], ["02", "Select chapters", "Include the question sets you want to practice."], ["03", "Review & reconnect", "Read feedback or open a linked video lesson."]].map(([number, title, text]) => (
                    <div key={number} className="flex items-start gap-3 rounded-xl border border-[#e9e3d9] bg-[#f7f4ee] p-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#8b1a2f] font-mono text-[10px] font-bold text-white">{number}</span>
                      <div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#777168]">{text}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-[#777168]"><span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-[#8b1a2f]" /> Video lessons can link to chapters</span><span className="font-mono text-[9px] uppercase tracking-wide">QFLOW</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e5dfd4] bg-[#fbfaf7] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8b1a2f]">Simple by design</p><h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Keep practice connected to what you are learning.</h2><p className="mt-4 text-sm leading-6 text-[#716b62] sm:text-base">The chapter is the bridge: questions for active recall, with related teaching close at hand.</p></div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {principles.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className={`rounded-2xl border border-[#e3ddd2] bg-[#f7f4ee] p-5 sm:p-6 ${index === 1 ? "md:translate-y-5" : ""}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2e8e5] text-[#8b1a2f]"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 font-serif text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#716b62]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 text-center sm:px-8 sm:py-20">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8b1a2f]">Start with a chapter</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">Your next revision session starts with a clear choice.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#716b62]">Browse the currently published QFLOW modules and choose where to begin.</p>
          <Link href="/qflow/practice" onClick={() => trackCta("qflow_footer")} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8b1a2f] px-6 py-3 font-bold text-white transition-colors hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]">Browse modules <ChevronRight className="h-4 w-4" /></Link>
          <footer className="mx-auto mt-14 flex max-w-7xl flex-wrap items-center justify-center gap-4 border-t border-[#ddd6ca] pt-5 font-mono text-[10px] text-[#777168]"><span>© {new Date().getFullYear()} PreClinik</span><span aria-hidden="true">·</span><Link href="/terms" className="hover:text-[#252522]">Terms & Privacy</Link></footer>
        </section>
      </main>
    </div>
  );
}
