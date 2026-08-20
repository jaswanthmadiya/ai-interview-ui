import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, LoaderCircle, Mic } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/api";
import {
  getStoredAssessmentId,
  getStoredCandidateName,
  setStoredOpeningLine,
  setStoredSessionId,
  setStoredTotalQuestions,
} from "@/lib/interviewIdentity";

export const Route = createFileRoute("/microphone")({
  head: () => ({
    meta: [
      { title: "Microphone Setup — PAI" },
      {
        name: "description",
        content:
          "Allow microphone access so the simulation can turn your speech into text. Audio is never recorded or stored.",
      },
      { property: "og:title", content: "Turn on your Mic — AI Chat Simulation" },
      {
        property: "og:description",
        content:
          "Allow microphone access so the simulation can turn your speech into text. Audio is never recorded or stored.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Microphone,
});

const POINTS = [
  "Listens only while the mic is on",
  "Audio is never recorded or stored",
  "Only final text answers are saved",
];

function Body() {
  return (
    <>
      <div className="flex size-[72px] items-center justify-center rounded-full bg-accent">
        <Mic className="size-6 text-primary" strokeWidth={1.75} />
      </div>
      <h2 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">Turn on your Mic</h2>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
        Test uses your microphone to turn speech into test while you answer.
      </p>
      <ul className="mt-8 w-full">
        {POINTS.map((p, i) => (
          <li
            key={p}
            className={`flex items-center gap-4 py-4 ${i < POINTS.length - 1 ? "border-b border-border" : ""
              }`}
          >
            <Check className="size-5 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="text-[15px] font-semibold">{p}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ContinueButton({
  onClick,
  loading,
  error,
}: {
  onClick: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {loading ? "Preparing your interview…" : "Continue"}
      </button>
      {error ? <p className="mt-3 text-center text-[13px] text-destructive">{error}</p> : null}
    </>
  );
}

function Microphone() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const assessmentId = getStoredAssessmentId();
    const candidateName = getStoredCandidateName();
    if (!assessmentId || !candidateName) {
      void navigate({ to: "/" });
      return;
    }

    setLoading(true);
    setError(null);

    void (async () => {
      // Requesting mic access here (even though the actual recording
      // happens per-question on the chat screen) surfaces the permission
      // prompt at the point the copy on this screen promises it, and lets
      // us proceed gracefully via the chat screen's typing fallback if the
      // candidate declines rather than getting stuck.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Declined or unavailable — chat screen still supports typing.
      }

      try {
        const res = await api.startCandidateSession(assessmentId, candidateName);
        setStoredSessionId(res.session_id);
        setStoredOpeningLine(res.opening_line);
        setStoredTotalQuestions(res.total_questions_planned);
        void navigate({ to: "/chat" });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start the interview — please try again.",
        );
        setLoading(false);
      }
    })();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      {/* Mobile */}
      <main className="flex flex-1 flex-col px-4 pb-6 pt-14 md:hidden">
        <Body />
        <div className="flex-1" />
        <ContinueButton onClick={handleContinue} loading={loading} error={error} />
      </main>

      {/* Desktop */}
      <main className="hidden flex-1 justify-center px-8 md:flex">
        <div className="w-full max-w-[400px] pt-24">
          <Body />
          <div className="mt-10">
            <ContinueButton onClick={handleContinue} loading={loading} error={error} />
          </div>
        </div>
      </main>
    </div>
  );
}
