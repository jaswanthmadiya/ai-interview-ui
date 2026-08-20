import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  Mic,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  api,
  type AssessmentCandidatesResponse,
  type AssessmentSummary,
  type CandidateEntry,
  type CandidateStatus,
} from "@/lib/api";

export const Route = createFileRoute("/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments — PAI" },
      { name: "description", content: "Browse every assessment that's been published so far." },
    ],
  }),
  component: AssessmentsPage,
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function timeAgo(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(epochSeconds);
}

// ─── copy link button ─────────────────────────────────────────────────────────

function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${path}`;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Copy className="size-3.5" />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

// ─── candidate status badge ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: CandidateStatus }) {
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
        <CheckCircle2 className="size-3 text-primary" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      Not started
    </span>
  );
}

// ─── progress pill ────────────────────────────────────────────────────────────

function ProgressPill({ current, total }: { current: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
        <span
          className="block h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[11px] text-muted-foreground">
        {current}/{total}
      </span>
    </span>
  );
}

// ─── candidate row inside modal ───────────────────────────────────────────────

function CandidateRow({
  candidate,
  onViewReport,
}: {
  candidate: CandidateEntry;
  onViewReport: (sessionId: string) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const { session_id, candidate_name, has_resume, status, current_question_index, total_questions, started_at } = candidate;

  const handleReport = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Trigger report generation on the backend; wait for it to complete
      await api.getReport(session_id);
    } catch {
      // Even on error, navigate — the report page shows a proper error state
    } finally {
      setGenerating(false);
    }
    onViewReport(session_id);
  };

  // Button active for any completed interview (report_available is the post-generation flag)
  const isCompleted = status === "completed";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* left */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold">{candidate_name}</span>
          <StatusBadge status={status} />
          {has_resume ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              <Mic className="size-2.5" /> Resume
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {status === "in_progress" && total_questions > 0 ? (
            <ProgressPill current={current_question_index} total={total_questions} />
          ) : null}
          {started_at ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" /> Started {timeAgo(started_at)}
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {session_id.slice(0, 16)}…
          </span>
        </div>
      </div>

      {/* right */}
      {isCompleted ? (
        <button
          type="button"
          onClick={() => void handleReport()}
          disabled={generating}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
        >
          {generating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileText className="size-3.5" />
          )}
          {generating ? "Generating…" : "View Report"}
        </button>
      ) : (
        <span className="flex h-8 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground opacity-40">
          <FileText className="size-3.5" />
          {status === "in_progress" ? "In progress" : "Not started"}
        </span>
      )}
    </div>
  );
}


// ─── candidates modal (slide-over) ────────────────────────────────────────────

const POLL_MS = 15_000;

function CandidatesModal({
  assessment,
  onClose,
  onViewReport,
}: {
  assessment: AssessmentSummary;
  onClose: () => void;
  onViewReport: (sessionId: string) => void;
}) {
  const [data, setData] = useState<AssessmentCandidatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCandidates = () => {
    api
      .listCandidates(assessment.assessment_id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load candidates."));
  };

  useEffect(() => {
    fetchCandidates();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.assessment_id]);

  // Auto-poll while any candidate is live
  useEffect(() => {
    const hasLive = data?.candidates.some((c) => c.status === "in_progress") ?? false;
    if (hasLive) {
      intervalRef.current = setInterval(fetchCandidates, POLL_MS);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const candidates = data?.candidates ?? [];
  const liveCount = candidates.filter((c) => c.status === "in_progress").length;
  const sorted = [...candidates].sort((a, b) => {
    const order: Record<string, number> = { in_progress: 0, not_started: 1, completed: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Candidates"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{data?.job_title ?? assessment.job_title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {assessment.experience_band} · {assessment.total_questions_planned ?? assessment.num_questions} questions
            </p>
            {liveCount > 0 ? (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                {liveCount} live · auto-refreshing
              </span>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* stats row */}
        {data && candidates.length > 0 ? (
          <div className="flex gap-px border-b border-border bg-secondary/40">
            {[
              { label: "Total", value: data.count },
              { label: "Live", value: liveCount },
              { label: "Done", value: candidates.filter((c) => c.status === "completed").length },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-1 flex-col items-center py-3">
                <span className="text-xl font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {data === null && !error ? (
            <div className="flex flex-col items-center gap-3 pt-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Loading candidates…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
              <TriangleAlert className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
              <Users className="size-10 text-muted-foreground/40" />
              <p className="font-semibold">No candidates yet</p>
              <p className="text-sm text-muted-foreground">
                Share the assessment link to start collecting responses.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((c) => (
                <CandidateRow
                  key={c.session_id}
                  candidate={c}
                  onViewReport={onViewReport}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

function AssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<AssessmentSummary | null>(null);

  useEffect(() => {
    api
      .listAssessments()
      .then((res) => setAssessments(res.assessments))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assessments."));
  }, []);

  const handleViewReport = (sessionId: string) => {
    void navigate({ to: "/report/$sessionId", params: { sessionId } });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Created Assessments</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Every assessment published so far, newest first.
            </p>
          </div>
          <Link
            to="/recruiter"
            className="flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            New assessment
          </Link>
        </div>

        {assessments === null && !error ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading assessments…</p>
          </div>
        ) : error ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
            <TriangleAlert className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : assessments && assessments.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No assessments published yet — create your first one.
            </p>
            <Link
              to="/recruiter"
              className="mt-2 flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {assessments?.map((a) => (
              <div
                key={a.assessment_id}
                className="rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-sm"
              >
                {/* top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{a.job_title}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {a.experience_band} · {a.total_questions_planned ?? a.num_questions} questions
                      {a.resume_required ? "" : " · no resume"} · published {formatDate(a.created_at)}
                    </p>
                  </div>
                  <CopyLinkButton path={a.shareable_link} />
                </div>

                {/* metadata chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    v{a.snapshot_version}
                  </span>
                  {a.resume_required ? (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      Resume required
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                      No resume
                    </span>
                  )}
                  {(a.module_names ?? []).map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                {/* shareable link */}
                <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  {a.shareable_link}
                </p>

                {/* footer */}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveAssessment(a)}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Users className="size-4" />
                    View candidates
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* modal */}
      {activeAssessment ? (
        <CandidatesModal
          assessment={activeAssessment}
          onClose={() => setActiveAssessment(null)}
          onViewReport={handleViewReport}
        />
      ) : null}
    </div>
  );
}
