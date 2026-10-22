import Dexie, { type EntityTable } from 'dexie';
import type { Campaign } from '../content/schema';
import { progressItemId } from '../game/ids';
import { scheduleReview, type ReviewState } from '../game/revision';
import { calculateXp } from '../game/scoring';

export interface PlayerProgress {
  id: 'player';
  xp: number;
  completedItemIds: string[];
  activeSeconds: number;
  streak: number;
  lastStudyDate?: string;
  achievements: string[];
  confidenceByTopic: Record<string, number>;
  hintsUsed: number;
}

export interface ReviewRecord extends ReviewState {
  id: string;
  topic: string;
  campaignId: string;
}

export interface ActivityAttempt {
  id?: number;
  activityId: string;
  campaignId: string;
  topic: string;
  correct: boolean;
  confidence: number;
  usedHint: boolean;
  answeredAt: string;
}

class OdysseyDatabase extends Dexie {
  campaigns!: EntityTable<Campaign, 'id'>;
  progress!: EntityTable<PlayerProgress, 'id'>;
  reviews!: EntityTable<ReviewRecord, 'id'>;
  attempts!: EntityTable<ActivityAttempt, 'id'>;

  constructor() {
    super('upsc-odyssey');
    this.version(1).stores({
      campaigns: 'id, subject, day',
      progress: 'id',
      reviews: 'id, topic, dueAt',
      attempts: '++id, activityId, campaignId, topic, answeredAt',
    });
  }
}

export const db = new OdysseyDatabase();

export const initialProgress: PlayerProgress = {
  id: 'player',
  xp: 0,
  completedItemIds: [],
  activeSeconds: 0,
  streak: 0,
  achievements: [],
  confidenceByTopic: {},
  hintsUsed: 0,
};

export async function getProgress(): Promise<PlayerProgress> {
  const stored = await db.progress.get('player');
  if (stored) return stored;
  await db.progress.put({ ...initialProgress });
  return { ...initialProgress };
}

export async function addCampaign(campaign: Campaign): Promise<void> {
  if (await db.campaigns.get(campaign.id)) throw new Error(`Campaign ID "${campaign.id}" is already imported.`);
  await db.campaigns.add(campaign);
}

export async function addCampaigns(campaigns: Campaign[]): Promise<void> {
  const ids = new Set<string>();
  for (const campaign of campaigns) {
    if (ids.has(campaign.id) || await db.campaigns.get(campaign.id)) {
      throw new Error(`Campaign ID "${campaign.id}" is already imported.`);
    }
    ids.add(campaign.id);
  }
  await db.transaction('rw', db.campaigns, async () => {
    await db.campaigns.bulkAdd(campaigns);
  });
}

function updateStudyStreak(progress: PlayerProgress, now: Date): void {
  const today = now.toISOString().slice(0, 10);
  if (progress.lastStudyDate === today) return;
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  progress.streak = progress.lastStudyDate === yesterday.toISOString().slice(0, 10) ? progress.streak + 1 : 1;
  progress.lastStudyDate = today;
}

export async function recordLessonCompletion(campaignId: string, lessonId: string): Promise<PlayerProgress> {
  return db.transaction('rw', db.progress, async () => {
    const progress = await getProgress();
    const completionId = progressItemId(campaignId, lessonId);
    if (!progress.completedItemIds.includes(completionId)) {
      progress.completedItemIds.push(completionId);
      progress.xp += 15;
      updateStudyStreak(progress, new Date());
      if (!progress.achievements.includes('First Light')) progress.achievements.push('First Light');
      await db.progress.put(progress);
    }
    return progress;
  });
}

export async function recordActivityResult(input: Omit<ActivityAttempt, 'id' | 'answeredAt'> & { points: number }): Promise<PlayerProgress> {
  const now = new Date();
  return db.transaction('rw', db.progress, db.reviews, db.attempts, async () => {
    const progress = await getProgress();
    const reviewId = progressItemId(input.campaignId, input.activityId);
    const existingReview = await db.reviews.get(reviewId);
    const review = scheduleReview(existingReview, input.correct ? input.confidence + 2 : 1, now);
    await db.reviews.put({ ...review, id: reviewId, topic: input.topic, campaignId: input.campaignId });
    await db.attempts.add({ ...input, answeredAt: now.toISOString() });
    const completionId = progressItemId(input.campaignId, input.activityId);
    const firstCompletion = !progress.completedItemIds.includes(completionId);
    if (firstCompletion) progress.completedItemIds.push(completionId);
    if (firstCompletion) progress.xp += calculateXp(input.points, input.correct, input.usedHint);
    if (input.usedHint) progress.hintsUsed += 1;
    progress.confidenceByTopic[input.topic] = input.confidence;
    updateStudyStreak(progress, now);
    if (!progress.achievements.includes('First Light')) progress.achievements.push('First Light');
    if (input.correct && input.points >= 25 && !progress.achievements.includes('Boss Slayer')) progress.achievements.push('Boss Slayer');
    await db.progress.put(progress);
    return progress;
  });
}

export async function addActiveStudyTime(seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  await db.transaction('rw', db.progress, async () => {
    const progress = await getProgress();
    progress.activeSeconds += Math.floor(seconds);
    await db.progress.put(progress);
  });
}