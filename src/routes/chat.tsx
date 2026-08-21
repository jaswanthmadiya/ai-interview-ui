import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, ArrowUp, CheckCircle2, Keyboard, Mic } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useInterviewSession } from "@/lib/useInterviewSession";
import {
  getStoredAssessmentMode,
  getStoredCandidateRoleBriefing,
  getStoredOpeningLine,
  getStoredSessionId,
  getStoredTotalQuestions,
} from "@/lib/interviewIdentity";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Interview — PAI" },
      {
        name: "description",
        content:
          "Answer the interview simulation by holding the mic to speak, then review and edit the transcript before sending.",
      },
      { property: "og:title", content: "Technical Deep Dive — AI Chat Simulation" },
      {
        property: "og:description",
        content:
          "Answer the interview simulation by holding the mic to speak, then review and edit the transcript before sending.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Chat,
});

const KeyCap = ({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <span
    className={`rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium ${className}`}
  >
    {children}
  </span>
);

function Waveform() {
  return (
    <span className="flex items-end gap-[2px]">
      {[6, 10, 4, 12, 7, 9, 5].map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-primary" style={{ height: h }} />
      ))}
    </span>
  );
}

/** WhatsApp-style three-dot typing animation */
function TypingDots() {
  return (
    <span className="flex items-center gap-[5px] px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-muted-foreground"
          style={{
            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Full-screen loading overlay shown while waiting for the first intro audio */
function IntroLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-3 rounded-full bg-primary"
            style={{
              animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Preparing your interview…</p>
    </div>
  );
}

function MicButton({
  listening,
  disabled,
  onToggle,
  size = 72,
}: {
  listening: boolean;
  disabled?: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={listening ? "Stop speaking" : "Tap to speak"}
      disabled={disabled}
      onClick={onToggle}
      className="relative flex items-center justify-center rounded-full outline-none disabled:opacity-40 select-none transition-transform active:scale-95"
      style={{ width: size, height: size }}
    >
      {listening ? (
        <>
          <span className="absolute inset-[-24px] pointer-events-none rounded-full bg-primary/15 animate-pulse" />
          <span className="absolute inset-[-12px] pointer-events-none rounded-full bg-primary/25" />
        </>
      ) : null}
      <span
        className="relative flex pointer-events-none items-center justify-center rounded-full bg-primary select-none"
        style={{ width: size, height: size }}
      >
        <Mic
          className="text-primary-foreground pointer-events-none select-none"
          style={{ width: size / 2.8, height: size / 2.8 }}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}

function HoldToSpeakPillButton({
  disabled,
  listening,
  onHoldStart,
  onHoldEnd,
  isDesktop = false,
}: {
  disabled?: boolean;
  listening?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  isDesktop?: boolean;
}) {
  const isPressing = useRef(false);

  const startHold = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (disabled || isPressing.current) return;
    isPressing.current = true;
    onHoldStart();
  };

  const endHold = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isPressing.current) return;
    isPressing.current = false;
    onHoldEnd();
  };

  const handleMobileClick = () => {
    if (disabled) return;
    if (listening) {
      onHoldEnd();
    } else {
      onHoldStart();
    }
  };

  if (!isDesktop) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleMobileClick}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 select-none ${
          listening
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-accent text-primary hover:bg-accent/80"
        }`}
      >
        <Mic className="size-4 pointer-events-none select-none" />
        <span className="pointer-events-none select-none">
          {listening ? "Stop Speaking" : "Tap to Speak"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-primary hover:bg-accent/80 transition-colors disabled:opacity-40 select-none touch-none"
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "none",
      }}
    >
      <Mic className="size-4 pointer-events-none select-none" />
      <span className="pointer-events-none select-none">
        Hold <KeyCap className="border-primary/40 text-primary">Space</KeyCap> to Speak
      </span>
    </button>
  );
}

const IconChip = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
  >
    <Keyboard className="size-4" />
  </button>
);

function SendButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Send answer"
      disabled={!active}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-full transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
          : "bg-accent text-primary/40 cursor-not-allowed"
      }`}
    >
      <ArrowUp className="size-5" strokeWidth={2.5} />
    </button>
  );
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Full-screen thank-you screen shown when the interview ends. */
function ThankYouScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      {/* Animated tick circle */}
      <div className="relative flex items-center justify-center">
        <span className="absolute size-36 animate-ping rounded-full bg-primary/10" />
        <span className="relative flex size-28 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-16 text-primary" strokeWidth={1.5} />
        </span>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Thank you!</h2>
        <p className="max-w-xs text-[15px] text-muted-foreground leading-relaxed">
          That's the end of the simulation. Your responses have been recorded.
        </p>
      </div>
    </div>
  );
}

function Chat() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typingMode, setTypingMode] = useState(false);
  const [expandedMsgId, setExpandedMsgId] = useState<number | null>(null);
  const isSituational = useMemo(() => getStoredAssessmentMode() === "situational_simulation", []);
  const candidateRoleBriefing = useMemo(() => getStoredCandidateRoleBriefing(), []);

  // Ref for the live transcription box so we can auto-scroll to the latest words
  const draftScrollRef = useRef<HTMLDivElement>(null);
  // Refs for auto-resizing textareas
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = getStoredSessionId();
    if (!id) {
      void navigate({ to: "/" });
      return;
    }
    setSessionId(id);
  }, [navigate]);

  const session = useInterviewSession(sessionId);
  const {
    messages,
    micState,
    draft,
    setDraft,
    startRecording,
    stopRecording,
    sendAnswer,
    currentQuestionIndex,
    totalQuestions,
    responseDeadlineSeconds,
    finished,
    errorMessage,
    firstAudioReceived,
  } = session;

  const openingLine = useMemo(() => getStoredOpeningLine(), []);
  const totalPlanned = useMemo(() => getStoredTotalQuestions() ?? totalQuestions, [totalQuestions]);
  const displayTotal = totalQuestions || totalPlanned || 0;

  const allMessages = openingLine
    ? [{ id: 0, role: "ai" as const, text: openingLine }, ...messages]
    : messages;

  // Only show the latest AI message and latest user message for a clean,
  // no-scroll view. The "current exchange" is the last AI turn and
  // optionally the last user response if it arrived after the AI message.
  const lastAiMsg = [...allMessages].reverse().find((m) => m.role === "ai");
  const lastUserMsg = [...allMessages].reverse().find((m) => m.role === "user");
  // Only show the user message if it came after the last AI message
  const showLastUser =
    lastUserMsg && lastAiMsg && allMessages.indexOf(lastUserMsg) > allMessages.indexOf(lastAiMsg);

  const busy = micState === "processing" || micState === "ai_speaking";
  const listening = micState === "listening";
  // Show the editable text box whenever typing mode is active, or mic is paused with a draft, or a draft exists
  const showTextarea = typingMode || micState === "paused" || (draft.length > 0 && !listening);

  // Auto-scroll the live transcription box to bottom whenever draft updates
  useEffect(() => {
    if (!draftScrollRef.current) return;
    const el = draftScrollRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [draft, listening]);

  // Auto-resize textareas dynamically based on transcript length
  useEffect(() => {
    const resize = (el: HTMLTextAreaElement | null, minH: number, maxH: number) => {
      if (!el) return;
      el.style.height = "auto";
      const nextH = Math.min(Math.max(el.scrollHeight, minH), maxH);
      el.style.height = `${nextH}px`;
    };
    resize(mobileTextareaRef.current, 52, 130);
    resize(desktopTextareaRef.current, 56, 140);
  }, [draft, showTextarea]);

  const timerLabel = finished
    ? undefined
    : responseDeadlineSeconds !== null
      ? formatTimer(responseDeadlineSeconds)
      : undefined;

  // Releasing PTT keeps draft in the text input box so the user can review & edit
  const handleHoldEnd = () => {
    setTypingMode(true);
    stopRecording();
  };

  // Explicit submit ONLY via Up-arrow button
  const handleSend = () => {
    if (!draft.trim() || busy) return;
    setTypingMode(false);
    sendAnswer();
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
        e.preventDefault();
        if (!busy) startRecording();
      }
    };
    const up = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      if (e.code === "Space") handleHoldEnd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // The conversation display: question bubble, last response, live transcription box in middle
  const recentExchange = (
    <div className="flex flex-col gap-4">
      {lastAiMsg ? (
        <div className="flex">
          <p className="max-w-[85%] rounded-2xl bg-bubble px-4 py-3 text-[15px] font-medium leading-relaxed text-bubble-foreground md:max-w-[70%] md:py-2.5">
            {lastAiMsg.text}
          </p>
        </div>
      ) : null}

      {showLastUser ? (
        <div className="flex justify-end">
          <div className="flex max-w-[85%] flex-col items-end gap-1 md:max-w-[70%]">
            <p
              className={`rounded-2xl bg-primary px-4 py-3 text-[15px] font-medium leading-relaxed text-primary-foreground md:py-2.5 ${
                expandedMsgId === lastUserMsg!.id ? "" : "line-clamp-6"
              }`}
            >
              {lastUserMsg!.text}
            </p>
            {lastUserMsg!.text.length > 300 ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedMsgId(expandedMsgId === lastUserMsg!.id ? null : lastUserMsg!.id)
                }
                className="text-[11px] text-primary/70 hover:text-primary"
              >
                {expandedMsgId === lastUserMsg!.id ? "Show less" : "Show more…"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Live transcription box — aligned at the middle with orange dashed border */}
      {listening ? (
        <div className="my-auto flex w-full flex-col items-center justify-center py-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex w-full max-w-[90%] flex-col items-center gap-2 md:max-w-[78%]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Waveform />
              <span>Live Transcription</span>
            </div>
            <div
              ref={draftScrollRef}
              className="h-28 md:h-32 w-full overflow-y-auto overscroll-contain rounded-2xl border-2 border-dashed border-primary bg-primary/[0.04] p-4 text-[15px] leading-relaxed shadow-xs dark:bg-primary/[0.08]"
            >
              {draft ? (
                <span className="text-foreground">{draft}</span>
              ) : (
                <span className="italic text-muted-foreground">Listening to your voice…</span>
              )}
              <span className="ml-1 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse bg-primary" />
            </div>
            <span className="text-xs text-muted-foreground">
              Release to finish dictating and edit before sending
            </span>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="flex">
          <span className="flex items-center gap-2 rounded-2xl bg-bubble px-4 py-3 text-bubble-foreground">
            {micState === "ai_speaking" ? (
              <span className="text-[13px] text-muted-foreground">Interviewer is speaking…</span>
            ) : (
              <TypingDots />
            )}
          </span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex justify-center">
          <span className="rounded-full bg-destructive/10 px-4 py-2 text-[13px] text-destructive">
            {errorMessage}
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Full-screen intro loader — shown until the first audio utterance fires */}
      {!firstAudioReceived ? <IntroLoader /> : null}

      {/* Full-screen Thank You overlay when interview ends */}
      {finished ? <ThankYouScreen /> : null}

      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <AppHeader {...(timerLabel ? { timer: timerLabel } : {})} />

        {/* ---------- Mobile ---------- */}
        <div className="flex flex-1 flex-col overflow-hidden md:hidden">
          {/* Message area — fixed, no scroll */}
          <div className="flex flex-1 flex-col justify-end gap-4 px-4 pt-4">{recentExchange}</div>

          {/* Sticky bottom input area */}
          <div className="shrink-0 px-4 pb-4 pt-2">
            {showTextarea ? (
              <>
                <div className="rounded-2xl border border-primary bg-card p-3 shadow-xs">
                  <textarea
                    ref={mobileTextareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Edit or type your answer here…"
                    aria-label="Your answer"
                    className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none min-h-[52px] max-h-[130px] overflow-y-auto"
                  />
                  <div className="mt-2.5 flex items-center justify-between gap-3 pt-1 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        if (draft) setDraft("");
                        else setTypingMode(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground px-1 py-1"
                    >
                      {draft ? "Clear" : "Close"}
                    </button>
                    <HoldToSpeakPillButton
                      disabled={busy}
                      listening={listening}
                      onHoldStart={startRecording}
                      onHoldEnd={handleHoldEnd}
                      isDesktop={false}
                    />
                    <SendButton active={draft.trim().length > 0 && !busy} onClick={handleSend} />
                  </div>
                </div>
                <p className="mt-2 text-center text-[12px] text-muted-foreground">
                  Review & edit your transcript above, then tap the arrow button to submit
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                {listening ? (
                  <p className="mb-4 text-sm font-medium text-primary">
                    Tap the mic when done speaking
                  </p>
                ) : (
                  <div className="relative mb-4">
                    <p className="rounded-lg bg-popover px-3 py-2 text-[13px] text-popover-foreground">
                      {busy ? "Please wait…" : "Tap the mic to speak"}
                    </p>
                    <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-popover" />
                  </div>
                )}
                <MicButton
                  listening={listening}
                  disabled={busy || finished}
                  onToggle={() => (listening ? handleHoldEnd() : startRecording())}
                />
                <div className="mt-6 flex w-full items-center justify-between">
                  <IconChip label="Type your answer" onClick={() => setTypingMode(true)} />
                  <SendButton active={false} onClick={handleSend} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Desktop ---------- */}
        <div className="hidden flex-1 overflow-hidden md:flex">
          <aside className="flex w-[380px] shrink-0 flex-col border-r border-border bg-secondary/40 px-8 py-8">
            {isSituational ? (
              <>
                <h2 className="text-lg font-semibold tracking-tight">Your scenario</h2>
                <div className="mt-4 flex-1 overflow-y-auto pr-1">
                  {candidateRoleBriefing ? (
                    candidateRoleBriefing
                      .split(/\n\s*\n/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((para, idx) => (
                        <p key={idx} className="mb-3 text-[14px] leading-relaxed text-foreground">
                          {para}
                        </p>
                      ))
                  ) : (
                    <p className="text-[14px] leading-relaxed text-muted-foreground">
                      Respond as you would in a real professional conversation.
                    </p>
                  )}
                </div>
                {/* No question-count card here by design — this is one continuous
                    conversation, not a fixed list of questions, so a "Question X of Y"
                    counter would be both meaningless (total is always 0) and misleading. */}
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight">Current question</h2>
                <p className="mt-4 text-[15px] leading-relaxed">
                  {lastAiMsg?.text ?? "Loading your first question…"}
                </p>
                <div className="flex-1" />
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AlignLeft className="size-4" strokeWidth={1.75} />
                    Question{" "}
                    {Math.min(
                      currentQuestionIndex + 1,
                      displayTotal || currentQuestionIndex + 1,
                    )}{" "}
                    of {displayTotal || "—"}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    {listening ? (
                      <>
                        <span className="size-2.5 rounded-full bg-primary" />
                        Listening, release <KeyCap>Space</KeyCap> to review & edit.
                      </>
                    ) : showTextarea ? (
                      <>
                        {/* Review and edit your transcript, then click <KeyCap>↑</KeyCap> to submit. */}
                      </>
                    ) : busy ? (
                      <>Please wait for the interviewer.</>
                    ) : (
                      <>
                        <KeyCap>Space</KeyCap> Hold to speak, release to review.
                      </>
                    )}
                  </p>
                </div>
              </>
            )}
          </aside>

          <main className="flex flex-1 flex-col overflow-hidden px-10 py-6">
            {/* Message area — grows to fill, content is anchored at bottom */}
            <div className="flex flex-1 flex-col justify-end gap-4">{recentExchange}</div>

            {/* Sticky bottom input */}
            <div className="shrink-0 pt-4">
              {showTextarea ? (
                <>
                  <div className="rounded-2xl border border-primary bg-card px-5 py-4 shadow-sm">
                    <textarea
                      ref={desktopTextareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Edit or type your answer here…"
                      aria-label="Your answer"
                      className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none min-h-[56px] max-h-[140px] overflow-y-auto"
                    />
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <IconChip label="Type your answer" onClick={() => setTypingMode(true)} />
                        {draft.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDraft("")}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          >
                            Clear text
                          </button>
                        )}
                      </div>
                      <HoldToSpeakPillButton
                        disabled={busy}
                        onHoldStart={startRecording}
                        onHoldEnd={handleHoldEnd}
                        isDesktop={true}
                      />
                      <SendButton active={draft.trim().length > 0 && !busy} onClick={handleSend} />
                    </div>
                  </div>
                  <p className="mt-2.5 text-center text-[13px] text-muted-foreground">
                    Review & edit your transcript above, then click the arrow button{" "}
                    <KeyCap>↑</KeyCap> to submit
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    {listening ? (
                      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
                        Release <KeyCap className="border-primary/40 text-primary">Space</KeyCap> to
                        review & edit
                      </p>
                    ) : (
                      <div className="relative mb-3">
                        <p className="flex items-center gap-2 rounded-lg bg-popover px-3 py-2 text-[13px] text-popover-foreground">
                          {busy ? (
                            "Please wait…"
                          ) : (
                            <>
                              Press and hold{" "}
                              <KeyCap className="border-transparent bg-foreground/80 text-popover-foreground">
                                Space
                              </KeyCap>{" "}
                              while you speak
                            </>
                          )}
                        </p>
                        <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-popover" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border px-5 py-3">
                    <IconChip label="Type your answer" onClick={() => setTypingMode(true)} />
                    <MicButton
                      listening={listening}
                      disabled={busy || finished}
                      onHoldStart={startRecording}
                      onHoldEnd={handleHoldEnd}
                      size={44}
                    />
                    <SendButton active={false} onClick={handleSend} />
                  </div>
                  <p className="mt-3 text-center text-[13px] text-muted-foreground">
                    You can also click the keyboard icon to type your answer
                  </p>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
