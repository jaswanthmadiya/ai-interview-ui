// TanStack Router routes here don't share React state with each other — the
// candidate flow (landing -> microphone -> chat) needs to carry the
// assessment id, the name they typed, and eventually the session id
// forward. sessionStorage is the simplest correct tool for that: it
// survives client-side navigation, and clears itself when the tab closes.

const KEYS = {
  assessmentId: "interview.assessmentId",
  candidateName: "interview.candidateName",
  sessionId: "interview.sessionId",
  openingLine: "interview.openingLine",
  totalQuestions: "interview.totalQuestions",
  assessmentMode: "interview.assessmentMode",
  candidateRoleBriefing: "interview.candidateRoleBriefing",
  resumeRequired: "interview.resumeRequired",
} as const;

// Kept as a plain string union here (rather than importing AssessmentMode from
// lib/api) so this module has zero dependency on the API client — it's pure
// cross-route storage plumbing.
export type StoredAssessmentMode = "structured_qa" | "situational_simulation";

export function getStoredAssessmentId(): string | null {
  return sessionStorage.getItem(KEYS.assessmentId);
}

export function setStoredAssessmentId(value: string): void {
  sessionStorage.setItem(KEYS.assessmentId, value);
}

export function getStoredCandidateName(): string | null {
  return sessionStorage.getItem(KEYS.candidateName);
}

export function setStoredCandidateName(value: string): void {
  sessionStorage.setItem(KEYS.candidateName, value);
}

export function getStoredSessionId(): string | null {
  return sessionStorage.getItem(KEYS.sessionId);
}

export function setStoredSessionId(value: string): void {
  sessionStorage.setItem(KEYS.sessionId, value);
}

export function getStoredOpeningLine(): string | null {
  return sessionStorage.getItem(KEYS.openingLine);
}

export function setStoredOpeningLine(value: string): void {
  sessionStorage.setItem(KEYS.openingLine, value);
}

export function getStoredTotalQuestions(): number | null {
  const raw = sessionStorage.getItem(KEYS.totalQuestions);
  return raw ? Number(raw) : null;
}

export function setStoredTotalQuestions(value: number): void {
  sessionStorage.setItem(KEYS.totalQuestions, String(value));
}

// Set once on the landing page (from AssessmentPublicInfo) and read by every
// downstream screen (scenario briefing, microphone/resume step, chat) so the
// whole candidate flow branches on the same source of truth instead of each
// screen re-deriving or assuming a mode.
export function getStoredAssessmentMode(): StoredAssessmentMode {
  const raw = sessionStorage.getItem(KEYS.assessmentMode);
  return raw === "situational_simulation" ? "situational_simulation" : "structured_qa";
}

export function setStoredAssessmentMode(value: StoredAssessmentMode): void {
  sessionStorage.setItem(KEYS.assessmentMode, value);
}

export function getStoredCandidateRoleBriefing(): string | null {
  return sessionStorage.getItem(KEYS.candidateRoleBriefing);
}

export function setStoredCandidateRoleBriefing(value: string): void {
  sessionStorage.setItem(KEYS.candidateRoleBriefing, value);
}

export function getStoredResumeRequired(): boolean {
  return sessionStorage.getItem(KEYS.resumeRequired) === "true";
}

export function setStoredResumeRequired(value: boolean): void {
  sessionStorage.setItem(KEYS.resumeRequired, String(value));
}
