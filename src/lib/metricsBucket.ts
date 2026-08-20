// Presented to recruiters as plain 0-100 metrics rather than qualitative
// labels (a deliberate choice — see the backend's assessment docs), then
// bucketed into the three-tier strings the prompts actually branch on.
export function bucket3<T extends string>(value: number, labels: readonly [T, T, T]): T {
  if (value < 34) return labels[0];
  if (value < 67) return labels[1];
  return labels[2];
}
