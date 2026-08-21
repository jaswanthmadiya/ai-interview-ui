// Typed client for the Python FastAPI interview backend. The backend is a
// separate service (see DEPLOYMENT.md in the backend repo) — this frontend
// never implements interview/scoring logic itself, it only calls out to it.

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://15.207.99.31:8000").replace(/\/$/, "");

export function wsBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return API_BASE.replace(/^http/, "ws");
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { formData?: FormData }): Promise<T> {
  const { formData, ...rest } = init ?? {};
  const headers: HeadersInit = formData
    ? (rest.headers ?? {})
    : { "Content-Type": "application/json", ...(rest.headers ?? {}) };
  const finalInit: RequestInit = { ...rest, headers };
  if (formData) finalInit.body = formData;

  const res = await fetch(`${API_BASE}${path}`, finalInit);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------
// Types mirroring app/schemas.py — kept intentionally close to the backend
// field names so drift is easy to spot.
// ---------------------------------------------------------------------

export type AssessmentMode = "structured_qa" | "situational_simulation";

export interface AssessmentPublicInfo {
  assessment_id: string;
  job_title: string;
  job_description: string;
  experience_band: string;
  num_questions: number;
  time_budget_minutes: number | null;
  interviewer_persona_name: string;
  company_context: string | null;
  modules: AssessmentModule[];
  resume_required: boolean;
  assessment_mode?: AssessmentMode;
  candidate_role_briefing?: string | null;
}

export interface AssessmentModule {
  name: string;
  weight_pct: number;
  target_depth: string;
}

export interface CandidateStartResponse {
  session_id: string;
  assessment_id: string;
  opening_line: string;
  total_questions_planned: number;
  candidate_name: string;
  has_resume: boolean;
}

export interface CategoryDistribution {
  intro: number;
  resume: number;
  role: number;
  resume_role: number;
  domain: number;
}

export interface GuardrailConfig {
  prompt_injection_action: "decline_and_redirect" | "terminate_immediately";
  vague_answer_tolerance: number;
  confidence_threshold: number;
  strictness_level: "lenient" | "moderate" | "strict";
  off_limit_topics: string[];
  max_off_topic_strikes: number;
  max_repeat_requests: number | null;
}

export interface InterviewStyleConfig {
  interviewer_persona_name: string;
  formality: "casual" | "professional" | "formal";
  difficulty: "easy" | "calibrated" | "hard";
  follow_up_intensity: "none" | "light" | "thorough";
  allow_clarification_requests: boolean;
  pace: "relaxed" | "standard" | "brisk";
}

export interface TopicConstraints {
  must_cover_topics: string[];
  off_limit_topics: string[];
  company_context: string | null;
  recruiter_notes: string | null;
}

export interface EvaluationRubric {
  strong_signals: string[];
  adequate_signals: string[];
  weak_signals: string[];
  red_flags: string[];
}

export interface PlannedQuestion {
  id: string;
  category: "intro" | "resume" | "role" | "resume_role" | "domain";
  module_name: string;
  question: string;
  rationale: string;
  max_follow_ups: number;
  rubric: EvaluationRubric;
}

export interface InterviewPlan {
  questions: PlannedQuestion[];
}

export interface AssessmentGenerateRequest {
  job_title: string;
  job_description: string;
  experience_band: string;
  num_questions: number;
  time_budget_minutes: number | null;
  interview_style: InterviewStyleConfig;
  guardrails: GuardrailConfig;
  topic_constraints: TopicConstraints;
  resume_required: boolean;
}

export interface AssessmentGenerateResponse {
  modules: AssessmentModule[];
  category_distribution: CategoryDistribution;
  questions: PlannedQuestion[];
}

export interface AssessmentConfig extends AssessmentGenerateRequest {
  modules: AssessmentModule[];
  category_distribution: CategoryDistribution;
  response_deadline_seconds: number | null;
  max_answer_duration_seconds: number | null;
}

export interface JobConfig {
  job_title: string;
  job_description: string;
  experience_band: string;
  num_questions: number;
  assessment_config: AssessmentConfig;
  assessment_mode?: AssessmentMode;
  scenario?: ScenarioConfig;
}

// ---------------------------------------------------------------------
// Situational Simulation Types
// ---------------------------------------------------------------------

export interface ScenarioHiddenFact {
  id: string;
  trigger_description: string;
  content: string;
}

export interface ScenarioPhaseGuide {
  id: string;
  name: string;
  guidance: string;
  scripted_line?: string | null;
  min_meaningful_turn: number;
}

export interface ScenarioCompetency {
  name: string;
  description: string;
}

export interface ScenarioConfig {
  persona_name: string;
  persona_role: string;
  persona_traits: string[];
  situation_briefing: string;
  candidate_role_briefing: string;
  opening_statement: string;
  hidden_facts: ScenarioHiddenFact[];
  phases: ScenarioPhaseGuide[];
  competencies: ScenarioCompetency[];
  forbidden_topics?: string[];
  never_say_phrases?: string[];
  min_meaningful_turns?: number;
  target_meaningful_turns?: number;
  hard_max_turns?: number;
  ending_guidance?: string;
  max_off_topic_strikes?: number;
}

export interface PublishScenarioAssessmentRequest {
  job_config: {
    job_title: string;
    job_description: string;
    experience_band: string;
    assessment_mode: "situational_simulation";
    scenario: ScenarioConfig;
    [key: string]: unknown;
  };
}

export interface PublishScenarioAssessmentResponse {
  assessment_id: string;
  shareable_link: string;
  snapshot_version: string;
  sha256_hash: string;
  opening_line: string;
  persona_name: string;
  candidate_role_briefing: string;
}

export interface PublishAssessmentResponse {
  assessment_id: string;
  shareable_link: string;
  snapshot_version: string;
  sha256_hash: string;
  pregenerated_audio_count: number;
  opening_line: string;
  total_questions: number;
}

export interface InterviewFlag {
  flag_type: string;
  label: string;
  description: string;
  severity: "low" | "medium" | "high";
  source: "system" | "llm";
}

export interface QuestionEvaluation {
  question_id: string;
  question: string;
  category: string;
  tier: string;
  rationale: string;
  evidence_quote: string | null;
}

export interface CompetencyAssessment {
  competency: string;
  rating: string;
  evidence: string[];
}

export interface GrammarAssessment {
  score: number;
  fluency_notes: string;
  error_examples: string[];
}

export interface ScenarioReport {
  conversation_summary: string;
  facts_uncovered: string[];
  final_proposal_summary: string;
}

export interface InterviewReport {
  candidate_name: string | null;
  job_title: string;
  overall_summary: string;
  strengths: string[];
  areas_of_concern: string[];
  competency_breakdown: CompetencyAssessment[];
  per_question_evaluation: QuestionEvaluation[];
  grammar_assessment: GrammarAssessment | null;
  flags: InterviewFlag[];
  recommendation: string;
  assessment_mode?: AssessmentMode;
  scenario_report?: ScenarioReport | null;
}

export interface AssessmentSummary {
  assessment_id: string;
  job_title: string;
  job_description: string;
  experience_band: string;
  num_questions: number;
  total_questions_planned: number;
  resume_required: boolean;
  snapshot_version: string;
  sha256_hash: string;
  created_at: number;           // unix epoch seconds (float)
  shareable_link: string;
  module_names?: string[];      // optional — not returned by current backend
  assessment_mode?: AssessmentMode;
}

export interface AssessmentListResponse {
  assessments: AssessmentSummary[];
  count: number;
}

export type CandidateStatus = "not_started" | "in_progress" | "completed";

export interface CandidateEntry {
  session_id: string;
  candidate_name: string;          // always a string per backend
  has_resume: boolean;
  status: CandidateStatus;
  current_question_index: number;  // live progress inside the interview
  total_questions: number;
  started_at: number;              // unix epoch seconds
  report_available: boolean;
  meaningful_turns_completed?: number | null;
}

export interface AssessmentCandidatesResponse {
  assessment_id: string;
  job_title: string;
  candidates: CandidateEntry[];
  count: number;
}

export interface ConfigOptions {
  experience_bands: string[];
  formality: string[];
  difficulty: string[];
  follow_up_intensity: string[];
  pace: string[];
  prompt_injection_action: string[];
  strictness_level: string[];
  default_modules: AssessmentModule[];
  default_category_distribution: CategoryDistribution;
  default_guardrails: GuardrailConfig;
  default_interview_style: InterviewStyleConfig;
  avg_minutes_per_question: number;
}

// ---------------------------------------------------------------------
// Candidate-facing calls
// ---------------------------------------------------------------------

export const api = {
  getAssessmentPublicInfo: (assessmentId: string) =>
    request<AssessmentPublicInfo>(`/interview/assessment/${assessmentId}`),

  startCandidateSession: (assessmentId: string, candidateName: string, resumeFile?: File) => {
    const formData = new FormData();
    formData.append("candidate_name", candidateName);
    if (resumeFile) formData.append("resume_file", resumeFile);
    return request<CandidateStartResponse>(`/interview/assessment/${assessmentId}/start`, {
      method: "POST",
      formData,
    });
  },

  getReport: (sessionId: string) => request<InterviewReport>(`/interview/${sessionId}/report`),

  // -------------------------------------------------------------------
  // Recruiter-facing calls
  // -------------------------------------------------------------------

  getConfigOptions: () => request<ConfigOptions>("/interview/config-options"),

  listAssessments: () => request<AssessmentListResponse>("/interview/assessments"),

  listCandidates: (assessmentId: string) =>
    request<AssessmentCandidatesResponse>(
      `/interview/assessment/${assessmentId}/candidates`,
    ),

  generateStructure: (body: AssessmentGenerateRequest) =>
    request<AssessmentGenerateResponse>("/interview/assessment/generate-structure", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  publishAssessment: (jobConfig: JobConfig, plan: InterviewPlan) =>
    request<PublishAssessmentResponse>("/interview/assessment/publish", {
      method: "POST",
      body: JSON.stringify({ job_config: jobConfig, plan }),
    }),

  publishScenarioAssessment: (payload: PublishScenarioAssessmentRequest) =>
    request<PublishScenarioAssessmentResponse>("/interview/assessment/publish-scenario", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { ApiError, API_BASE };
