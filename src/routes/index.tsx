import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { Logo } from "@/components/Logo";
import {
  getStoredCandidateName,
  setStoredAssessmentId,
  setStoredAssessmentMode,
  setStoredCandidateName,
  setStoredCandidateRoleBriefing,
  setStoredResumeRequired,
} from "@/lib/interviewIdentity";
import { api, type AssessmentPublicInfo } from "@/lib/api";

const searchSchema = z.object({
  assessment_id: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Welcome — AI Chat Simulation" },
      {
        name: "description",
        content:
          "Participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation.",
      },
      { property: "og:title", content: "AI Business Simulation — AI Chat Simulation" },
      {
        property: "og:description",
        content:
          "Participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingFlow,
});

/** Centered Loading Animation with thin line progress bar per reference design */
function LoadingAnimation({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center justify-center text-center">
        {/* Centered Logo */}
        <Logo size={68} />

        {/* Title */}
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[32px]">
          AI Chat Simulation
        </h1>

        {/* Thin Line Progress Bar */}
        <div className="mt-12 h-1 w-[280px] overflow-hidden rounded-full bg-secondary/80 sm:w-[380px] md:w-[420px]">
          <div
            className="h-full rounded-full bg-primary transition-all duration-75 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const CHECKLIST_ITEMS_SITUATIONAL = [
  "Respond as you would in a real professional conversation.",
  "Ask questions whenever you need more information.",
  "There may be no single correct answer.",
  "This is not a test of English fluency or accent.",
];

const CHECKLIST_ITEMS_STRUCTURED = [
  "Speak or type — you can switch anytime.",
  "Review and edit your answer before it's sent.",
  "Take your time; there's no penalty for pausing to think.",
  "This is not a test of English fluency or accent.",
];

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

export function OnboardingFlow() {
  const search = useSearch({ strict: false }) as { assessment_id?: string };
  const assessmentId = search.assessment_id;
  const navigate = useNavigate();

  // Step order: 0 = First Loading Animation, 1 = Landing Page, 2 = Your Scenario Page
  // (step 2 only ever applies to situational_simulation assessments — structured_qa
  // goes straight from step 1 to /microphone, since its per-question context is
  // shown progressively in the chat sidebar instead of a single upfront briefing).
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [publicInfo, setPublicInfo] = useState<AssessmentPublicInfo | null>(null);
  const [candidateName, setCandidateName] = useState(() => getStoredCandidateName() ?? "");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    setStoredAssessmentId(assessmentId);
    api
      .getAssessmentPublicInfo(assessmentId)
      .then((info) => {
        setPublicInfo(info);
        // Every downstream screen (scenario briefing, resume step, chat sidebar)
        // branches on these — set them once here from the authoritative source
        // instead of leaving them unset or re-derived ad hoc per screen.
        setStoredAssessmentMode(
          info.assessment_mode === "situational_simulation"
            ? "situational_simulation"
            : "structured_qa",
        );
        setStoredResumeRequired(Boolean(info.resume_required));
        if (info.candidate_role_briefing) {
          setStoredCandidateRoleBriefing(info.candidate_role_briefing);
        }
      })
      .catch(() => null);
  }, [assessmentId]);

  const isSituational = publicInfo?.assessment_mode === "situational_simulation";

  // Backend only guarantees a single free-text briefing field, not a fixed
  // "role / situation / task" structure — split on blank lines rather than
  // fabricating section headings that aren't guaranteed to apply.
  const briefingParagraphs = useMemo(() => {
    const text = publicInfo?.candidate_role_briefing ?? "";
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [publicInfo?.candidate_role_briefing]);

  // Initial Loading Animation ticker (runs FIRST when visiting /)
  useEffect(() => {
    if (step !== 0) return;
    setLoadingProgress(0);
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep(1), 150); // Move to Step 1 (Landing Page)
          return 100;
        }
        return prev + 5;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [step]);

  const canProceed = candidateName.trim().length > 0;

  // "Get Started" commits the candidate's name once, then branches by mode:
  // situational_simulation shows the scenario briefing step first; structured_qa
  // has no equivalent upfront briefing (its per-question context appears
  // progressively in the chat sidebar), so it skips straight to mic permission.
  const handleGetStarted = () => {
    if (!canProceed) {
      setNameTouched(true);
      return;
    }
    setStoredCandidateName(candidateName.trim());
    if (isSituational) {
      setStep(2);
    } else {
      void navigate({ to: "/microphone" });
    }
  };

  const handleStartConversation = () => {
    void navigate({ to: "/microphone" });
  };

  if (!assessmentId) return <MissingLinkNotice />;
  if (step === 0) return <LoadingAnimation progress={loadingProgress} />;

  const nameField = (
    <div className="mt-6">
      <label
        htmlFor="candidate-name"
        className="mb-1.5 block text-xs font-semibold text-muted-foreground"
      >
        Your full name
      </label>
      <input
        id="candidate-name"
        type="text"
        value={candidateName}
        onChange={(e) => setCandidateName(e.target.value)}
        onBlur={() => setNameTouched(true)}
        placeholder="e.g. Priya Sharma"
        className="h-12 w-full rounded-xl border border-border bg-background px-4 text-[15px] outline-none transition-colors focus:border-primary"
      />
      {nameTouched && !canProceed ? (
        <p className="mt-1.5 text-xs text-destructive">Enter your name to continue.</p>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      {step === 1 ? (
        /* STEP 1: LANDING PAGE */
        <main className="flex flex-1 flex-col justify-between px-5 pb-8 pt-6 md:justify-center md:px-8 md:py-12">
          <div className="mx-auto w-full max-w-5xl">
            {/* Desktop grid & Mobile stacked */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-14 lg:gap-16 items-start">
              {/* Left Column */}
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[34px] leading-tight">
                  {publicInfo?.job_title ? publicInfo.job_title : "AI Chat Simulation"}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px] max-w-md">
                  {isSituational
                    ? "You will participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation."
                    : "You will answer a short series of interview questions by voice or text, with an AI interviewer."}
                </p>

                {/* Name field */}
                <div className="max-w-md">{nameField}</div>

                {/* Desktop Note */}
                <div className="hidden mt-8 max-w-md rounded-xl bg-secondary/70 p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed md:block">
                  Please use a quiet environment and check your microphone before starting.
                </div>

                {/* Desktop Button */}
                <div className="hidden mt-8 md:block">
                  <button
                    type="button"
                    onClick={handleGetStarted}
                    className="flex h-12 items-center justify-center rounded-xl bg-primary px-10 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Get Started
                  </button>
                </div>
              </div>

              {/* Right Column: Checklist */}
              <div className="flex flex-col border-t border-border/60 pt-4 md:border-t-0 md:pt-0">
                <ul className="w-full">
                  {(() => {
                    const items = isSituational
                      ? CHECKLIST_ITEMS_SITUATIONAL
                      : CHECKLIST_ITEMS_STRUCTURED;
                    return items.map((item, idx) => (
                      <li
                        key={idx}
                        className={`flex items-start gap-3 py-3.5 ${
                          idx < items.length - 1 ? "border-b border-border/60" : ""
                        }`}
                      >
                        <Check className="mt-0.5 size-4.5 shrink-0 text-primary stroke-[2.5]" />
                        <span className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                          {item}
                        </span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            </div>

            {/* Mobile Note & Button */}
            <div className="mt-8 flex flex-col md:hidden">
              <div className="rounded-xl bg-secondary/70 p-4 text-xs leading-relaxed text-muted-foreground">
                Find a quiet place. Audio is never stored, only your final answers are shared with
                the team.
              </div>
              <button
                type="button"
                onClick={handleGetStarted}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Get Started
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* STEP 2: YOUR SCENARIO PAGE — situational_simulation only.
           Rendered entirely from AssessmentPublicInfo.candidate_role_briefing,
           the real per-assessment text the recruiter authored in Assessment
           Studio — never hardcoded demo copy. */
        <main className="flex flex-1 flex-col px-5 pb-10 pt-6 md:px-8 md:py-12">
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[32px] mb-8">
              Your Scenario
            </h1>

            {briefingParagraphs.length > 0 ? (
              <div className="flex flex-col gap-4">
                {briefingParagraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground"
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
                You'll be having a live voice conversation as part of this assessment. Ask questions
                whenever you need more information, and respond as you would in a real professional
                conversation.
              </p>
            )}

            {/* Start Conversation Button */}
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleStartConversation}
                className="flex h-12 w-full sm:w-auto sm:px-14 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                Start Conversation
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
