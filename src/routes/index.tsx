import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlignLeft, Clock, Mic, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AssessmentPublicInfo } from "@/lib/api";
import { setStoredAssessmentId, setStoredCandidateName } from "@/lib/interviewIdentity";

const searchSchema = z.object({
  assessment_id: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Welcome — PAI" },
      {
        name: "description",
        content:
          "Speak or type your answers to a technical simulation and review every answer before it's sent.",
      },
      { property: "og:title", content: "AI Chat Simulation — Before you Begin" },
      {
        property: "og:description",
        content:
          "Speak or type your answers to a technical simulation and review every answer before it's sent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-10 py-24">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Logo size={44} />
        <p className="text-lg font-semibold tracking-tight">AI Chat Simulation</p>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/4 animate-[loading_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}

function Facts({ info, className = "" }: { info: AssessmentPublicInfo; className?: string }) {
  const facts = [
    {
      icon: Clock,
      label: info.time_budget_minutes ? `${info.time_budget_minutes} minutes` : "Untimed",
    },
    { icon: AlignLeft, label: `${info.num_questions} Questions` },
    { icon: Mic, label: "Speak or type, switch anytime." },
  ];
  return (
    <ul className={className}>
      {facts.map(({ icon: Icon, label }, i) => (
        <li
          key={label}
          className={`flex items-center gap-3 py-4 ${i < facts.length - 1 ? "border-b border-border" : ""
            }`}
        >
          <Icon className="size-5 shrink-0 text-foreground" strokeWidth={1.75} />
          <span className={i === 0 ? "text-[15px] font-medium" : "text-[15px] font-semibold"}>
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Note({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-xl bg-secondary px-4 py-3 text-[13px] leading-relaxed text-muted-foreground ${className}`}
    >
      Find a quiet place. Audio is never stored, only your final test answers are share with the
      team.
    </p>
  );
}

function NameField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor="candidate-name" className="mb-2 block text-[13px] text-muted-foreground">
        Your full name
      </Label>
      <Input
        id="candidate-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Priya Sharma"
        className="h-12 rounded-2xl px-4 text-[15px]"
        autoComplete="name"
      />
    </div>
  );
}

function MissingLinkNotice() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <TriangleAlert className="size-10 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Missing assessment link</h2>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          This page needs an assessment link to get started — please use the link from your invite
          email.
        </p>
      </main>
    </div>
  );
}

function Landing() {
  const { assessment_id: assessmentId } = Route.useSearch();
  const navigate = useNavigate();

  const [splashDone, setSplashDone] = useState(false);
  const [info, setInfo] = useState<AssessmentPublicInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!assessmentId) return;
    setStoredAssessmentId(assessmentId);
    api
      .getAssessmentPublicInfo(assessmentId)
      .then(setInfo)
      .catch(() => setLoadError(true));
  }, [assessmentId]);

  const handleStart = () => {
    if (!name.trim()) return;
    setStoredCandidateName(name.trim());
    void navigate({ to: "/microphone" });
  };

  if (!assessmentId) return <MissingLinkNotice />;
  if (!splashDone || (!info && !loadError)) return <Splash />;

  const canStart = name.trim().length > 0;

  const StartButton = (
    <button
      type="button"
      disabled={!canStart}
      onClick={handleStart}
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Get Started
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      {/* Mobile */}
      <main className="flex flex-1 flex-col px-4 pb-6 pt-6 md:hidden">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight">Before you Begin</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {info ? info.job_title : "Speak or type and review every answer before its sent."}
        </p>
        {info ? <Facts info={info} className="mt-6" /> : null}
        <NameField value={name} onChange={setName} className="mt-6" />
        <div className="flex-1" />
        <Note className="mb-4" />
        {StartButton}
      </main>

      {/* Desktop */}
      <main className="hidden flex-1 items-center justify-center px-8 md:flex">
        <div className="w-full max-w-[1050px] pb-16">
          <div className="grid grid-cols-2 gap-16">
            <div>
              <h2 className="text-[40px] font-bold leading-tight tracking-tight">
                Before you Begin
              </h2>
              <p className="mt-2 max-w-sm text-base leading-relaxed text-muted-foreground">
                {info ? info.job_title : "Speak or type and review every answer before its sent."}
              </p>
              <Note className="mt-6 max-w-sm" />
            </div>
            {info ? <Facts info={info} className="pt-2" /> : null}
          </div>
          <div className="mx-auto mt-10 max-w-[400px]">
            <NameField value={name} onChange={setName} className="mb-4" />
            {StartButton}
          </div>
        </div>
      </main>
    </div>
  );
}
