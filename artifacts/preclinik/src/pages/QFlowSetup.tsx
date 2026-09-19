import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, GraduationCap, Layers3, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trackEvent } from "@/lib/googleAnalytics";

export type QFlowProfile = {
  university: string;
  field: string;
  year: string;
  unit: string;
  examDate: string;
};

export const QFLOW_PROFILE_KEY = "preclinik_qflow_profile";

const initialProfile: QFlowProfile = {
  university: "",
  field: "",
  year: "",
  unit: "",
  examDate: "",
};

const universities = [
  "University of Algiers 1",
  "University of Blida 1",
  "University of Constantine 3",
  "University of Oran 1",
  "Other university",
];

const fields = ["Medicine", "Dentistry", "Pharmacy"];
const years = ["First year", "Second year", "Third year", "Fourth year", "Fifth year", "Sixth year"];
const units = [
  "Cardiovascular physiology",
  "Neuroanatomy essentials",
  "Biochemistry & metabolism",
  "Renal physiology",
  "Medical histology",
];

export function readQFlowProfile(): QFlowProfile | null {
  try {
    const saved = window.localStorage.getItem(QFLOW_PROFILE_KEY);
    if (!saved) return null;
    return { ...initialProfile, ...(JSON.parse(saved) as Partial<QFlowProfile>) };
  } catch {
    return null;
  }
}

export default function QFlowSetup() {
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<QFlowProfile>(initialProfile);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const saved = readQFlowProfile();
    if (saved) setProfile(saved);
  }, []);

  const completion = useMemo(() => {
    const fieldsComplete = [profile.university, profile.field, profile.year, profile.unit].filter(Boolean).length;
    return Math.round((fieldsComplete / 4) * 100);
  }, [profile]);

  const update = (key: keyof QFlowProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setSubmitted(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!profile.university || !profile.field || !profile.year || !profile.unit) return;

    window.localStorage.setItem(QFLOW_PROFILE_KEY, JSON.stringify(profile));
    trackEvent("qflow_setup_completed", {
      university: profile.university,
      study_field: profile.field,
      study_year: profile.year,
    });
    setLocation("/qflow/practice");
  };

  return (
    <div className="min-h-screen bg-[#f7f3ec] text-[#1a1211]">
      <header className="border-b border-[#e8ddd5] bg-white/90 px-5 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between">
          <Link href="/qflow" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#b9852e] font-serif text-xl font-bold text-white shadow-sm transition-transform group-hover:scale-105">
              P
            </div>
            <div>
              <div className="font-serif text-lg font-bold leading-tight">PreClinik</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">QFLOW</div>
            </div>
          </Link>
          <Link href="/qflow" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
            Back to QFLOW
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-stretch gap-6 px-5 py-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[28px] bg-primary p-7 text-white shadow-xl shadow-primary/15 sm:p-10 lg:min-h-[680px]">
          <div className="absolute -right-28 -top-20 h-72 w-72 rounded-full border border-white/15" />
          <div className="absolute -bottom-32 -left-28 h-96 w-96 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
                <Sparkles className="h-3.5 w-3.5" />
                QFLOW setup
              </div>
              <h1 className="mt-8 max-w-md font-serif text-4xl font-bold leading-[1.05] sm:text-5xl">
                Personalise your practice.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
                Tell us where you are in medical school and we&apos;ll make your question-bank home feel relevant from the first session.
              </p>
            </div>

            <div className="mt-12">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-white/65">
                <span>Profile progress</span>
                <span>{completion}% complete</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-black/20">
                <div className="h-full rounded-full bg-[#d7b86a] transition-all duration-300" style={{ width: `${Math.max(completion, 8)}%` }} />
              </div>
              <div className="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-2 lg:grid-cols-1">
                <SetupBenefit icon={GraduationCap} text="Built around your university and year" />
                <SetupBenefit icon={Layers3} text="Find the right unit faster" />
                <SetupBenefit icon={BookOpen} text="Start with a focused free mix" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e8ddd5] bg-white p-6 shadow-sm sm:p-10 lg:p-12">
          <div className="mx-auto max-w-2xl">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">01 / 01 · Your study profile</div>
            <h2 className="mt-4 font-serif text-3xl font-bold leading-tight sm:text-4xl">Where should we start?</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              These details shape your QFLOW home. You can update them later.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <SetupSelect
                  label="Institution / university"
                  icon={GraduationCap}
                  value={profile.university}
                  onChange={(value) => update("university", value)}
                  options={universities}
                  placeholder="Select your university"
                />
                <SetupSelect
                  label="Field of study"
                  icon={BookOpen}
                  value={profile.field}
                  onChange={(value) => update("field", value)}
                  options={fields}
                  placeholder="Select your field"
                />
              </div>
              <SetupSelect
                label="Year of study"
                icon={GraduationCap}
                value={profile.year}
                onChange={(value) => update("year", value)}
                options={years}
                placeholder="Select your year"
              />
              <SetupSelect
                label="Current unit"
                icon={Layers3}
                value={profile.unit}
                onChange={(value) => update("unit", value)}
                options={units}
                placeholder="Select your current unit"
              />
              <div>
                <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
                  Planned exam date <span className="font-sans font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <input
                    type="date"
                    value={profile.examDate}
                    onChange={(event) => update("examDate", event.target.value)}
                    className="h-12 w-full rounded-xl border border-[#e8ddd5] bg-[#f7f3ec]/60 pl-11 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {submitted && (!profile.university || !profile.field || !profile.year || !profile.unit) && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  Choose your university, field, year, and current unit to continue.
                </p>
              )}

              <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-[#e8ddd5] pt-6 sm:flex-row sm:items-center">
                <Link href="/qflow" className="text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:text-left">
                  I&apos;ll do this later
                </Link>
                <button type="submit" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90">
                  Continue to QFLOW
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function SetupBenefit({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[#d7b86a]" />
      <span>{text}</span>
    </div>
  );
}

function SetupSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  icon: typeof BookOpen;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full appearance-none rounded-xl border border-[#e8ddd5] bg-[#f7f3ec]/60 pl-11 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}