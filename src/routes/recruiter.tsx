import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Loader2, Plus, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  api,
  type AssessmentModule,
  type ConfigOptions,
  type InterviewPlan,
  type PlannedQuestion,
} from "@/lib/api";
import { bucket3 } from "@/lib/metricsBucket";

export const Route = createFileRoute("/recruiter")({
  head: () => ({
    meta: [
      { title: "Assessment Studio — PAI" },
      {
        name: "description",
        content: "Configure and publish a new interview simulation assessment.",
      },
    ],
  }),
  component: RecruiterStudio,
});

const STEPS = ["Role & Scope", "Metrics", "Structure", "Publish"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center rounded-2xl border border-border bg-secondary/40 px-5 py-4">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < current
                  ? "bg-primary/20 text-primary"
                  : i === current
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
            >
              {i < current ? <CheckCircle2 className="size-4" /> : i + 1}
            </span>
            <span
              className={`hidden text-sm font-medium sm:inline ${i === current ? "text-foreground" : "text-muted-foreground"
                }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 ? <div className="mx-3 h-px flex-1 bg-border" /> : null}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="mb-2 block text-[13px] font-medium text-foreground">{children}</Label>;
}

function MetricSlider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="font-mono text-sm font-semibold text-primary">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={([v]) => onChange(v ?? 0)}
      />
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-accent ${className}`}
    >
      {children}
    </button>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <SecondaryButton onClick={add} className="h-9 px-3">
          <Plus className="size-4" />
        </SecondaryButton>
      </div>
      {value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
            >
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_MODULES: AssessmentModule[] = [
  { name: "System Design", weight_pct: 30, target_depth: "deep" },
  { name: "Coding & APIs", weight_pct: 30, target_depth: "deep" },
  { name: "Domain Knowledge", weight_pct: 20, target_depth: "medium" },
  { name: "Behavioral", weight_pct: 20, target_depth: "foundational" },
];

function RecruiterStudio() {
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<ConfigOptions | null>(null);

  // Step 1
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [experienceBand, setExperienceBand] = useState("Senior (5-8 yrs)");
  const [numQuestions, setNumQuestions] = useState(5);
  const [timeBudget, setTimeBudget] = useState<string>("");
  const [resumeRequired, setResumeRequired] = useState(true);

  // Step 2
  const [personaName, setPersonaName] = useState("Aanya");
  const [formality, setFormality] = useState(50);
  const [difficulty, setDifficulty] = useState(50);
  const [followUp, setFollowUp] = useState(35);
  const [pace, setPace] = useState(50);
  const [strictness, setStrictness] = useState(50);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [maxOffTopicStrikes, setMaxOffTopicStrikes] = useState(3);
  const [offLimitTopics, setOffLimitTopics] = useState<string[]>([]);
  const [mustCoverTopics, setMustCoverTopics] = useState<string[]>([]);
  const [companyContext, setCompanyContext] = useState("");
  const [recruiterNotes, setRecruiterNotes] = useState("");

  // Step 3
  const [modules, setModules] = useState<AssessmentModule[]>(DEFAULT_MODULES);
  const [questions, setQuestions] = useState<PlannedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Step 4
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getConfigOptions()
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  const canProceedStep1 = jobTitle.trim().length > 0 && jobDescription.trim().length > 0;

  const buildStyleAndGuardrails = () => ({
    interview_style: {
      interviewer_persona_name: personaName || "Aanya",
      formality: bucket3(formality, ["casual", "professional", "formal"] as const),
      difficulty: bucket3(difficulty, ["easy", "calibrated", "hard"] as const),
      follow_up_intensity: bucket3(followUp, ["none", "light", "thorough"] as const),
      pace: bucket3(pace, ["relaxed", "standard", "brisk"] as const),
      allow_clarification_requests: true,
    },
    guardrails: {
      prompt_injection_action: "decline_and_redirect" as const,
      vague_answer_tolerance: 1,
      confidence_threshold: confidenceThreshold / 100,
      strictness_level: bucket3(strictness, ["lenient", "moderate", "strict"] as const),
      off_limit_topics: offLimitTopics,
      max_off_topic_strikes: maxOffTopicStrikes,
      max_repeat_requests: null,
    },
    topic_constraints: {
      must_cover_topics: mustCoverTopics,
      off_limit_topics: [],
      company_context: companyContext || null,
      recruiter_notes: recruiterNotes || null,
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { interview_style, guardrails, topic_constraints } = buildStyleAndGuardrails();
      const res = await api.generateStructure({
        job_title: jobTitle,
        job_description: jobDescription,
        experience_band: experienceBand,
        num_questions: numQuestions,
        time_budget_minutes: timeBudget ? Number(timeBudget) : null,
        interview_style,
        guardrails,
        topic_constraints,
        resume_required: resumeRequired,
      });
      setModules(res.modules.length > 0 ? res.modules : DEFAULT_MODULES);
      setQuestions(res.questions);
      setStep(2);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate structure.");
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (id: string, patch: Partial<PlannedQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const totalWeight = modules.reduce((sum, m) => sum + m.weight_pct, 0);

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const { interview_style, guardrails, topic_constraints } = buildStyleAndGuardrails();
      const assessment_config = {
        job_title: jobTitle,
        job_description: jobDescription,
        experience_band: experienceBand,
        num_questions: numQuestions,
        time_budget_minutes: timeBudget ? Number(timeBudget) : null,
        modules,
        category_distribution: { intro: 1, resume: 2, role: 1, resume_role: 1, domain: 1 },
        interview_style,
        guardrails,
        topic_constraints,
        resume_required: resumeRequired,
        response_deadline_seconds: null,
        max_answer_duration_seconds: null,
      };
      const plan: InterviewPlan = { questions };
      const res = await api.publishAssessment(
        {
          job_title: jobTitle,
          job_description: jobDescription,
          experience_band: experienceBand,
          num_questions: numQuestions,
          assessment_config,
        },
        plan,
      );
      setShareableLink(res.shareable_link);
      setStep(3);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to publish assessment.");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = () => {
    if (!shareableLink) return;
    void navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assessment Studio</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Configure and publish a new interview simulation.
            </p>
          </div>
          <Link
            to="/assessments"
            className="flex h-10 shrink-0 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            View created assessments
          </Link>
        </div>

        <Stepper current={step} />

        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <FieldLabel>Job title</FieldLabel>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
              />
            </div>
            <div>
              <FieldLabel>Job description</FieldLabel>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={6}
                placeholder="Paste the job description and requirements…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Experience band</FieldLabel>
                <Select value={experienceBand} onValueChange={setExperienceBand}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      options?.experience_bands ?? [
                        "Junior (0-2 yrs)",
                        "Mid-Level (3-5 yrs)",
                        "Senior (5-8 yrs)",
                        "Principal / Staff (8+ yrs)",
                      ]
                    ).map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Question count</FieldLabel>
                <Input
                  type="number"
                  min={3}
                  max={15}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value) || 5)}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Time budget — minutes (optional)</FieldLabel>
              <Input
                type="number"
                value={timeBudget}
                onChange={(e) => setTimeBudget(e.target.value)}
                placeholder="e.g. 25"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-[14px] font-medium">Resume required</p>
                <p className="text-xs text-muted-foreground">
                  If off, no resume is collected — questions never assume candidate background.
                </p>
              </div>
              <Switch checked={resumeRequired} onCheckedChange={setResumeRequired} />
            </div>
            <div className="flex justify-end pt-2">
              <PrimaryButton disabled={!canProceedStep1} onClick={() => setStep(1)}>
                Continue <ChevronRight className="size-4" />
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <FieldLabel>Interviewer name</FieldLabel>
              <Input
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricSlider
                label="Formality"
                value={formality}
                onChange={setFormality}
                hint="0 casual — 100 formal"
              />
              <MetricSlider
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                hint="0 easy — 100 hard"
              />
              <MetricSlider
                label="Follow-up intensity"
                value={followUp}
                onChange={setFollowUp}
                hint="0 never probes — 100 always probes"
              />
              <MetricSlider
                label="Pace"
                value={pace}
                onChange={setPace}
                hint="0 relaxed — 100 brisk"
              />
            </div>

            <h3 className="pt-2 text-sm font-semibold">Guardrails</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricSlider
                label="Enforcement sensitivity"
                value={strictness}
                onChange={setStrictness}
              />
              <MetricSlider
                label="Confidence threshold"
                value={confidenceThreshold}
                onChange={setConfidenceThreshold}
                hint={`= ${(confidenceThreshold / 100).toFixed(2)}`}
              />
            </div>
            <div>
              <FieldLabel>Max off-topic strikes before auto-close</FieldLabel>
              <Input
                type="number"
                min={1}
                max={10}
                value={maxOffTopicStrikes}
                onChange={(e) => setMaxOffTopicStrikes(Number(e.target.value) || 3)}
                className="max-w-xs"
              />
            </div>
            <div>
              <FieldLabel>Off-limit topics</FieldLabel>
              <TagInput
                value={offLimitTopics}
                onChange={setOffLimitTopics}
                placeholder="e.g. salary negotiation"
              />
            </div>
            <div>
              <FieldLabel>Must-cover topics</FieldLabel>
              <TagInput
                value={mustCoverTopics}
                onChange={setMustCoverTopics}
                placeholder="e.g. system design tradeoffs"
              />
            </div>
            <div>
              <FieldLabel>Company / role context (optional)</FieldLabel>
              <Textarea
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <FieldLabel>Notes for the question planner (optional)</FieldLabel>
              <Textarea
                value={recruiterNotes}
                onChange={(e) => setRecruiterNotes(e.target.value)}
                rows={3}
              />
            </div>

            {generateError ? <p className="text-sm text-destructive">{generateError}</p> : null}

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => setStep(0)}>
                <ChevronLeft className="size-4" /> Back
              </SecondaryButton>
              <PrimaryButton onClick={() => void handleGenerate()} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : null}
                {generating ? "Generating…" : "Generate structure"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">
                Modules
                <span className={totalWeight === 100 ? "text-primary" : "text-destructive"}>
                  {totalWeight}% weighted
                </span>
              </h3>
              <div className="space-y-2">
                {modules.map((m, i) => (
                  <div
                    key={`${m.name}-${i}`}
                    className="flex items-center gap-2 rounded-xl border border-border p-3"
                  >
                    <Input
                      value={m.name}
                      onChange={(e) =>
                        setModules((ms) =>
                          ms.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={m.weight_pct}
                      onChange={(e) =>
                        setModules((ms) =>
                          ms.map((x, xi) =>
                            xi === i ? { ...x, weight_pct: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <button
                      type="button"
                      onClick={() => setModules((ms) => ms.filter((_, xi) => xi !== i))}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <SecondaryButton
                onClick={() =>
                  setModules((ms) => [...ms, { name: "", weight_pct: 10, target_depth: "medium" }])
                }
                className="mt-2 h-9 px-3"
              >
                <Plus className="size-4" /> Add module
              </SecondaryButton>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Questions ({questions.length})</h3>
              <Accordion type="single" collapsible className="rounded-xl border border-border">
                {questions.map((q, i) => (
                  <AccordionItem key={q.id} value={q.id} className="px-4 last:border-b-0">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2 text-left">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase text-secondary-foreground">
                          {q.category}
                        </span>
                        <span className="line-clamp-1 text-[14px]">
                          Q{i + 1}. {q.question}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <div>
                        <FieldLabel>Question</FieldLabel>
                        <Textarea
                          value={q.question}
                          onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FieldLabel>Module</FieldLabel>
                          <Input
                            value={q.module_name}
                            onChange={(e) => updateQuestion(q.id, { module_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <FieldLabel>Rationale</FieldLabel>
                          <Input
                            value={q.rationale}
                            onChange={(e) => updateQuestion(q.id, { rationale: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["strong_signals", "Strong (3)"],
                            ["adequate_signals", "Adequate (2)"],
                            ["weak_signals", "Weak (1)"],
                            ["red_flags", "Red flag (0)"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key}>
                            <FieldLabel>{label}</FieldLabel>
                            <Textarea
                              rows={2}
                              value={q.rubric[key].join("\n")}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  rubric: {
                                    ...q.rubric,
                                    [key]: e.target.value.split("\n").filter(Boolean),
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" /> Back
              </SecondaryButton>
              <PrimaryButton onClick={() => setStep(3)} disabled={questions.length === 0}>
                Continue to publish <ChevronRight className="size-4" />
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            {!shareableLink ? (
              <>
                <div className="rounded-xl border border-border bg-secondary/40 p-5">
                  <h3 className="text-lg font-semibold tracking-tight">{jobTitle}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {experienceBand} · {questions.length} questions
                    {timeBudget ? ` · ~${timeBudget} min` : ""}
                    {resumeRequired ? "" : " · no resume needed"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modules.map((m) => (
                      <span
                        key={m.name}
                        className="rounded-full bg-background px-3 py-1 text-xs font-medium"
                      >
                        {m.name} · {m.weight_pct}%
                      </span>
                    ))}
                  </div>
                </div>
                {publishError ? <p className="text-sm text-destructive">{publishError}</p> : null}
                <div className="flex justify-between pt-2">
                  <SecondaryButton onClick={() => setStep(2)}>
                    <ChevronLeft className="size-4" /> Back
                  </SecondaryButton>
                  <PrimaryButton onClick={() => void handlePublish()} disabled={publishing}>
                    {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
                    {publishing ? "Publishing…" : "Publish assessment"}
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center">
                <CheckCircle2 className="mx-auto size-10 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">Assessment published</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share this link with candidates.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                  <Input readOnly value={shareableLink} className="border-none shadow-none" />
                  <SecondaryButton onClick={copyLink} className="h-9 shrink-0 px-3">
                    <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
                  </SecondaryButton>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
