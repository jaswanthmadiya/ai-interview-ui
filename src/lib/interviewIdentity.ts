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

export type StoredAssessmentMode = "structured_qa" | "situational_simulation";

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function getStoredAssessmentId(): string | null {
  if (!isClient()) return null;
  return sessionStorage.getItem(KEYS.assessmentId);
}

export function setStoredAssessmentId(value: string): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.assessmentId, value);
}

export function getStoredCandidateName(): string | null {
  if (!isClient()) return null;
  return sessionStorage.getItem(KEYS.candidateName);
}

export function setStoredCandidateName(value: string): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.candidateName, value);
}

export function getStoredSessionId(): string | null {
  if (!isClient()) return null;
  return sessionStorage.getItem(KEYS.sessionId);
}

export function setStoredSessionId(value: string): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.sessionId, value);
}

export function getStoredOpeningLine(): string | null {
  if (!isClient()) return null;
  return sessionStorage.getItem(KEYS.openingLine);
}

export function setStoredOpeningLine(value: string): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.openingLine, value);
}

export function getStoredTotalQuestions(): number | null {
  if (!isClient()) return null;
  const raw = sessionStorage.getItem(KEYS.totalQuestions);
  return raw ? Number(raw) : null;
}

export function setStoredTotalQuestions(value: number): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.totalQuestions, String(value));
}

export function getStoredAssessmentMode(): StoredAssessmentMode {
  if (!isClient()) return "structured_qa";
  const raw = sessionStorage.getItem(KEYS.assessmentMode);
  return raw === "situational_simulation" ? "situational_simulation" : "structured_qa";
}

export function setStoredAssessmentMode(value: StoredAssessmentMode): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.assessmentMode, value);
}

export function getStoredCandidateRoleBriefing(): string | null {
  if (!isClient()) return null;
  return sessionStorage.getItem(KEYS.candidateRoleBriefing);
}

export function setStoredCandidateRoleBriefing(value: string): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.candidateRoleBriefing, value);
}

export function getStoredResumeRequired(): boolean {
  if (!isClient()) return false;
  return sessionStorage.getItem(KEYS.resumeRequired) === "true";
}

export function setStoredResumeRequired(value: boolean): void {
  if (!isClient()) return;
  sessionStorage.setItem(KEYS.resumeRequired, String(value));
}
