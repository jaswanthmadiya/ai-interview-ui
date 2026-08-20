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
} as const;

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
