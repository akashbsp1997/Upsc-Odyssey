import { z } from 'zod';
import { campaignSchema } from '../content/schema';
import { db, getProgress, type ActivityAttempt, type PlayerProgress, type ReviewRecord } from './database';

const backupSchema = z.object({
  backupVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  campaigns: z.array(campaignSchema),
  progress: z.object({
    id: z.literal('player'),
    xp: z.number().nonnegative(),
    completedItemIds: z.array(z.string()),
    activeSeconds: z.number().nonnegative(),
    streak: z.number().int().nonnegative(),
    lastStudyDate: z.string().optional(),
    achievements: z.array(z.string()),
    confidenceByTopic: z.record(z.number()),
    hintsUsed: z.number().int().nonnegative(),
  }),
  reviews: z.array(z.object({
    id: z.string(), topic: z.string(), campaignId: z.string(), repetitions: z.number().int(),
    intervalDays: z.number().int(), ease: z.number(), dueAt: z.string().datetime(),
  })),
  attempts: z.array(z.object({
    id: z.number().int().optional(), activityId: z.string(), campaignId: z.string(), topic: z.string(),
    correct: z.boolean(), confidence: z.number().int().min(1).max(5), usedHint: z.boolean(), answeredAt: z.string().datetime(),
  })),
});

export type ProgressBackup = {
  backupVersion: 1;
  exportedAt: string;
  campaigns: Awaited<ReturnType<typeof db.campaigns.toArray>>;
  progress: PlayerProgress;
  reviews: ReviewRecord[];
  attempts: ActivityAttempt[];
};

export async function exportProgress(): Promise<ProgressBackup> {
  return {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    campaigns: await db.campaigns.toArray(),
    progress: await getProgress(),
    reviews: await db.reviews.toArray(),
    attempts: await db.attempts.toArray(),
  };
}

export async function restoreProgressBackup(text: string): Promise<void> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not read backup JSON: ${error instanceof Error ? error.message : 'Invalid JSON syntax.'}`);
  }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Backup validation failed: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }

  await db.transaction('rw', db.campaigns, db.progress, db.reviews, db.attempts, async () => {
    await db.campaigns.bulkPut(parsed.data.campaigns);
    await db.progress.put(parsed.data.progress);
    await db.reviews.clear();
    await db.reviews.bulkPut(parsed.data.reviews);
    await db.attempts.clear();
    await db.attempts.bulkAdd(parsed.data.attempts);
  });
}