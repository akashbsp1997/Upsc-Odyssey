import type { Activity } from '../content/schema';

export interface ScoreResult {
  correct: boolean;
  xp: number;
}

export function scoreAnswer(activity: Activity, response: string, usedHint = false): ScoreResult {
  const normalized = response.trim().toLocaleLowerCase();
  const accepted = [activity.answer, ...(activity.acceptedAnswers ?? [])].map((answer) => answer.trim().toLocaleLowerCase());
  const correct = accepted.includes(normalized);
  return { correct, xp: calculateXp(activity.points, correct, usedHint) };
}

export function calculateXp(points: number, correct: boolean, usedHint = false): number {
  if (!correct) return 2;
  return Math.max(5, Math.round(points * (usedHint ? 0.7 : 1)));
}