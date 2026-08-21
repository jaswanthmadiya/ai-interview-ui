import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import {
  getStoredCandidateName,
  setStoredAssessmentId,
  setStoredCandidateName,
} from "@/lib/interviewIdentity";
import { api, type AssessmentPublicInfo } from "@/lib/api";

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

const CHECKLIST_ITEMS = [
  "Respond as you would in a real professional conversation.",
  "Ask questions whenever you need more information.",
  "There may be no single correct answer.",
  "No specialized knowledge of finance or markets is required.",
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [candidateName, setCandidateName] = useState("");
  const [publicInfo, setPublicInfo] = useState<AssessmentPublicInfo | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    setStoredAssessmentId(assessmentId);
    const storedName = getStoredCandidateName();
    if (storedName) {
      setCandidateName(storedName);
    }
    api
      .getAssessmentPublicInfo(assessmentId)
      .then(setPublicInfo)
      .catch(() => null);
  }, [assessmentId]);

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

  const handleGetStarted = () => {
    const finalName = candidateName.trim() || "Management Trainee";
    setStoredCandidateName(finalName);
    setStep(2);
  };

  const handleStartConversation = () => {
    void navigate({ to: "/microphone" });
  };

  if (!assessmentId) return <MissingLinkNotice />;
  if (step === 0) return <LoadingAnimation progress={loadingProgress} />;

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
                  AI Business Simulation
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px] max-w-md">
                  You will participate in a 10–15 minute voice conversation with an AI character
                  based on a realistic workplace situation.
                </p>

                {/* Candidate Name Input Field */}
                <div className="mt-6 max-w-md">
                  <label htmlFor="candidate-name" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Your Name
                  </label>
                  <Input
                    id="candidate-name"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 rounded-xl text-[15px]"
                  />
                </div>

                {/* Environment Note */}
                <div className="mt-6 max-w-md rounded-xl bg-secondary/70 p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Please use a quiet environment and check your microphone before starting.
                </div>

                {/* Desktop Button */}
                <div className="hidden mt-8 md:block">
                  <button
                    type="button"
                    onClick={handleGetStarted}
                    className="flex h-12 items-center justify-center rounded-xl bg-primary px-10 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.99]"
                  >
                    Get Started
                  </button>
                </div>
              </div>

              {/* Right Column: Checklist */}
              <div className="flex flex-col border-t border-border/60 pt-4 md:border-t-0 md:pt-0">
                <ul className="w-full">
                  {CHECKLIST_ITEMS.map((item, idx) => (
                    <li
                      key={idx}
                      className={`flex items-start gap-3 py-3.5 ${
                        idx < CHECKLIST_ITEMS.length - 1 ? "border-b border-border/60" : ""
                      }`}
                    >
                      <Check className="mt-0.5 size-4.5 shrink-0 text-primary stroke-[2.5]" />
                      <span className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Mobile Button */}
            <div className="mt-8 flex flex-col md:hidden">
              <button
                type="button"
                onClick={handleGetStarted}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                Get Started
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* STEP 2: YOUR SCENARIO PAGE (STATIC UI MATCHING DESIGNS) */
        <main className="flex flex-1 flex-col px-5 pb-10 pt-6 md:px-8 md:py-12">
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[32px] mb-8">
              Your Scenario
            </h1>

            {/* Section 1: YOUR ROLE */}
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                YOUR ROLE
              </span>
              <p className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground">
                You are a Management Trainee working with a team that manages an important corporate client.
              </p>
            </div>

            <div className="my-6 h-px w-full bg-border/60 sm:my-8" />

            {/* Section 2: SITUATION */}
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                SITUATION
              </span>
              <p className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground mb-3">
                A critical report promised to the client yesterday has not been delivered. The client is unhappy and has requested an urgent conversation.
              </p>
              <p className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground">
                The senior colleague who normally manages the account is unavailable, and you have been asked to speak with the client.
              </p>
            </div>

            <div className="my-6 h-px w-full bg-border/60 sm:my-8" />

            {/* Section 3: YOUR TASK */}
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                YOUR TASK
              </span>
              <p className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground mb-3">
                Understand the situation and handle the conversation as you would in a real workplace.
              </p>
              <p className="text-sm sm:text-[15px] font-normal leading-relaxed text-foreground">
                You may ask questions, clarify information, and propose whatever course of action you think is appropriate.
              </p>
            </div>

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
