export interface ReviewState {
  repetitions: number;
  intervalDays: number;
  ease: number;
  dueAt: string;
}

export function scheduleReview(previous: ReviewState | undefined, quality: number, now = new Date()): ReviewState {
  const score = Math.max(0, Math.min(5, Math.round(quality)));
  const repetitions = score < 3 ? 0 : (previous?.repetitions ?? 0) + 1;
  const ease = Math.max(1.3, (previous?.ease ?? 2.5) + 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
  const intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round((previous?.intervalDays ?? 3) * ease));
  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  return { repetitions, intervalDays, ease, dueAt: due.toISOString() };
}

export function isReviewDue(review: ReviewState | undefined, now = new Date()): boolean {
  return Boolean(review && new Date(review.dueAt).getTime() <= now.getTime());
}