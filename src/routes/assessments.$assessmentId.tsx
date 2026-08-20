import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  api,
  type AssessmentCandidatesResponse,
  type CandidateEntry,
  type CandidateStatus,
} from "@/lib/api";

export const Route = createFileRoute("/assessments/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Candidates — AI Chat Simulation" },
      { name: "description", content: "Live candidate status for this assessment." },
    ],
  }),
  component: CandidatesPage,
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ─── progress bar ─────────────────────────────────────────────────────────────

function ProgressPill({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {current}/{total}
      </span>
    </div>
  );
}

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CandidateStatus }) {
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
        <CheckCircle2 className="size-3.5 text-primary" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/40" />
      Not started
    </span>
  );
}

// ─── candidate card ───────────────────────────────────────────────────────────

function CandidateCard({ candidate }: { candidate: CandidateEntry }) {
  const {
    session_id,
    candidate_name,
    has_resume,
    status,
    current_question_index,
    total_questions,
    started_at,
    report_available,
  } = candidate;

  // Active if status is completed OR report_available is true
  const isReportActive = status === "completed" || report_available;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
      {/* left */}
      <div className="flex flex-1 flex-col gap-2 min-w-0">
        {/* name + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{candidate_name}</span>
          <StatusBadge status={status} />
          {has_resume ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
              Resume
            </span>
          ) : null}
        </div>

        {/* progress + meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {status === "in_progress" && total_questions > 0 ? (
            <ProgressPill current={current_question_index} total={total_questions} />
          ) : null}
          {started_at ? (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Started {timeAgo(started_at)}
            </span>
          ) : null}
          <span className="font-mono opacity-60">{session_id.slice(0, 14)}…</span>
        </div>
      </div>

      {/* right — report action */}
      {isReportActive ? (
        <Link
          to="/report/$sessionId"
          params={{ sessionId: session_id }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <FileText className="size-4" />
          View Report
        </Link>
      ) : (
        <span className="flex h-9 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground opacity-50">
          <FileText className="size-4" />
          Report pending
        </span>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;

function CandidatesPage() {
  const { assessmentId } = Route.useParams();
  const [data, setData] = useState<AssessmentCandidatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCandidates = () => {
    api
      .listCandidates(assessmentId)
      .then((res) => {
        setData(res);
        setLastRefreshed(new Date());
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load candidates."),
      );
  };

  // Initial fetch
  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Auto-poll every 15s while any candidate is in_progress
  useEffect(() => {
    const hasLive = data?.candidates.some((c) => c.status === "in_progress") ?? false;

    if (hasLive) {
      intervalRef.current = setInterval(fetchCandidates, POLL_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const candidates = data?.candidates ?? [];
  const liveCount = candidates.filter((c) => c.status === "in_progress").length;
  const completedCount = candidates.filter((c) => c.status === "completed").length;
  const totalCount = data?.count ?? candidates.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        {/* breadcrumb */}
        <Link
          to="/assessments"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All assessments
        </Link>

        {/* heading — uses job_title from response once loaded */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data?.job_title ?? "Candidates"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {assessmentId}
            </p>
          </div>

          {/* live indicator */}
          {liveCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {liveCount} live · auto-refreshing
            </span>
          ) : lastRefreshed ? (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        {/* stats strip */}
        {data && candidates.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              { label: "Total", value: totalCount, icon: Users, accent: false },
              { label: "In progress", value: liveCount, icon: Clock, accent: liveCount > 0 },
              { label: "Completed", value: completedCount, icon: CheckCircle2, accent: false },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className={`flex flex-1 items-center gap-3 rounded-xl border p-4 ${
                  accent ? "border-primary/20 bg-primary/5" : "border-border bg-background"
                }`}
              >
                <Icon className={`size-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* content */}
        {data === null && !error ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading candidates…</p>
          </div>
        ) : error ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
            <TriangleAlert className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
            <Users className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-semibold">No candidates yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share the assessment link to start collecting responses.
              </p>
            </div>
            <Link
              to="/assessments"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" />
              Back to assessments
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {/* sort: in_progress first → not_started → completed */}
            {[...candidates]
              .sort((a, b) => {
                const order: Record<string, number> = {
                  in_progress: 0,
                  not_started: 1,
                  completed: 2,
                };
                return (order[a.status] ?? 3) - (order[b.status] ?? 3);
              })
              .map((c) => (
                <CandidateCard key={c.session_id} candidate={c} />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}