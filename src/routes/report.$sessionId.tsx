import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { api, type InterviewReport } from "@/lib/api";

export const Route = createFileRoute("/report/$sessionId")({
  head: () => ({
    meta: [{ title: "Candidate Report — PAI" }],
  }),
  component: ReportPage,
});

// ─── style maps ───────────────────────────────────────────────────────────────

const TIER_STYLE: Record<string, string> = {
  strong: "border-l-primary",
  adequate: "border-l-muted-foreground",
  weak: "border-l-timer",
  red_flag: "border-l-destructive",
  no_answer: "border-l-border",
};

const TIER_LABEL: Record<string, string> = {
  strong: "Strong",
  adequate: "Adequate",
  weak: "Weak",
  red_flag: "Red flag",
  no_answer: "No answer",
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-timer/10 text-timer",
  low: "bg-secondary text-secondary-foreground",
};

// ─── shared section wrapper ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

function ReportPage() {
  const { sessionId } = Route.useParams();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getReport(sessionId)
      .then(setReport)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Report is not available yet."),
      )
      .finally(() => setLoading(false));
  }, [sessionId]);


  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        {/* breadcrumb */}
        <Link
          to="/assessments"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to assessments
        </Link>

        <h1 className="text-2xl font-bold tracking-tight">Candidate Report</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{sessionId}</p>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Synthesizing the report…</p>
          </div>
        ) : error ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
            <TriangleAlert className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link
              to="/assessments"
              className="mt-1 flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" /> Back to assessments
            </Link>
          </div>
        ) : report ? (
          <div className="mt-6 space-y-5">
            {/* hero card */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] text-muted-foreground">Candidate</p>
                <h2 className="mt-0.5 text-xl font-bold">{report.candidate_name ?? "—"}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{report.job_title}</p>
              </div>
              {report.recommendation ? (
                <div className="mt-3 rounded-xl border border-border bg-background px-4 py-3 sm:mt-0 sm:max-w-[55%]">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recommendation</p>
                  <p className="mt-1 text-[14px] leading-relaxed">{report.recommendation}</p>
                </div>
              ) : null}
            </div>

            {/* flags */}
            {report.flags.length > 0 ? (
              <Section title="Flags">
                <div className="flex flex-wrap gap-2">
                  {report.flags.map((f, i) => (
                    <span
                      key={`${f.flag_type}-${i}`}
                      title={f.description}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${SEVERITY_STYLE[f.severity] ?? "bg-secondary text-secondary-foreground"
                        }`}
                    >
                      <AlertTriangle className="size-3.5" />
                      {f.label}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {/* summary */}
            <Section title="Overall summary">
              <p className="text-[15px] leading-relaxed">{report.overall_summary}</p>
            </Section>

            {/* strengths + concerns */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Section title="Strengths">
                <ul className="space-y-2 text-[14px] leading-relaxed">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-primary">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Areas of concern">
                <ul className="space-y-2 text-[14px] leading-relaxed">
                  {report.areas_of_concern.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-timer">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            {/* competency breakdown */}
            <Section title="Competency breakdown">
              <div className="space-y-4">
                {report.competency_breakdown.map((c, i) => (
                  <div
                    key={i}
                    className={`border-l-4 pl-4 ${TIER_STYLE[c.rating] ?? "border-l-border"}`}
                  >
                    <p className="text-[14px] font-semibold">
                      {c.competency}{" "}
                      <span className="font-normal text-muted-foreground">— {c.rating}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5 text-[13px] text-muted-foreground">
                      {c.evidence.map((e, ei) => (
                        <li key={ei}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            {/* grammar */}
            {report.grammar_assessment ? (
              <Section title="English grammar & fluency">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold">{report.grammar_assessment.score}</span>
                  <span className="text-muted-foreground">/&nbsp;10</span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {report.grammar_assessment.fluency_notes}
                </p>
              </Section>
            ) : null}

            {/* per-question */}
            <Section title="Per-question evaluation">
              <div className="space-y-4">
                {report.per_question_evaluation.map((q) => (
                  <div
                    key={q.question_id}
                    className={`border-l-4 pl-4 ${TIER_STYLE[q.tier] ?? "border-l-border"}`}
                  >
                    <p className="text-[14px] font-medium">{q.question}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      <span className="font-semibold uppercase">
                        {TIER_LABEL[q.tier] ?? q.tier}
                      </span>{" "}
                      — {q.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* back button */}
            <div className="pb-4 pt-2">
              <Link
                to="/assessments"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to assessments
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
