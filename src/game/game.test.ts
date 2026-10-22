import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { previewCampaignText } from '../content/importer';
import { campaignSchema } from '../content/schema';
import dayOne from '../content/day-01.json';
import { exportProgress, restoreProgressBackup } from '../db/backup';
import { addCampaigns, db, getProgress, recordActivityResult, recordLessonCompletion } from '../db/database';
import { areVisitedCampaignsComplete, buildSession, isCampaignComplete } from './campaignBuilder';
import { progressItemId } from './ids';
import { isReviewDue, scheduleReview } from './revision';
import { calculateXp, scoreAnswer } from './scoring';

const campaign = campaignSchema.parse(dayOne);

beforeEach(async () => {
  await db.transaction('rw', db.campaigns, db.progress, db.reviews, db.attempts, async () => {
    await Promise.all([db.campaigns.clear(), db.progress.clear(), db.reviews.clear(), db.attempts.clear()]);
  });
});

afterAll(async () => { await db.delete(); });

describe('campaign content', () => {
  it('previews valid campaigns with counts and estimated duration', () => {
    const preview = previewCampaignText(JSON.stringify(dayOne));
    expect(preview.campaign.title).toBe('Foundations of the Republic');
    expect(preview.questionCount).toBe(campaign.activities.length);
    expect(preview.estimatedDurationMinutes).toBeGreaterThan(0);
  });

  it('explains invalid JSON and schema errors', () => {
    expect(() => previewCampaignText('{not json')).toThrow(/Could not read this JSON file/);
    expect(() => previewCampaignText(JSON.stringify({ schemaVersion: 1 }))).toThrow(/Campaign validation failed/);
  });

  it('rejects duplicate campaign IDs without partially importing a batch', async () => {
    const second = { ...campaign, id: 'second-campaign' };
    await addCampaigns([campaign]);
    await expect(addCampaigns([second, campaign])).rejects.toThrow(/already imported/);
    expect(await db.campaigns.count()).toBe(1);
  });
});

describe('progression', () => {
  it('scores MCQs and applies hint-adjusted XP', () => {
    const mcq = campaign.activities.find((activity) => activity.type === 'mcq')!;
    expect(scoreAnswer(mcq, mcq.answer).correct).toBe(true);
    expect(scoreAnswer(mcq, 'wrong').correct).toBe(false);
    expect(calculateXp(10, true, true)).toBe(7);
    expect(calculateXp(10, false)).toBe(2);
  });

  it('persists progress and awards XP for completed lessons', async () => {
    await recordLessonCompletion(campaign.id, campaign.lessons[0].id);
    expect(await getProgress()).toMatchObject({ xp: 15, streak: 1, achievements: ['First Light'] });
  });

  it('does not award repeat XP for replayed completed challenges', async () => {
    const activity = campaign.activities.find((entry) => entry.type === 'mcq')!;
    const attempt = { activityId: activity.id, campaignId: campaign.id, topic: activity.topic, correct: true, confidence: 4, usedHint: false, points: activity.points };
    await recordActivityResult(attempt);
    const firstXp = (await getProgress()).xp;
    await recordActivityResult(attempt);
    expect((await getProgress()).xp).toBe(firstXp);
    expect(await db.attempts.count()).toBe(2);
  });

  it('creates due dates for missed answers and advances successful reviews', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    const missed = scheduleReview(undefined, 1, now);
    expect(missed.intervalDays).toBe(1);
    expect(isReviewDue(missed, new Date('2026-10-21T12:00:00.000Z'))).toBe(true);
    const recalled = scheduleReview(missed, 5, now);
    expect(recalled.repetitions).toBe(1);
    expect(new Date(recalled.dueAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it('marks a campaign complete only after all items are recorded', () => {
    expect(isCampaignComplete(campaign, [])).toBe(false);
    const allIds = [...campaign.lessons, ...campaign.activities].map((item) => progressItemId(campaign.id, item.id));
    expect(isCampaignComplete(campaign, allIds)).toBe(true);
  });

  it('does not call a mixed multi-campaign session fully cleared', () => {
    const secondCampaign = { ...campaign, id: 'second-campaign' };
    const firstCampaignCompletion = [...campaign.lessons, ...campaign.activities]
      .map((item) => progressItemId(campaign.id, item.id));
    expect(areVisitedCampaignsComplete([campaign, secondCampaign], [campaign.id, secondCampaign.id], firstCampaignCompletion)).toBe(false);
    expect(areVisitedCampaignsComplete([campaign], [campaign.id], firstCampaignCompletion)).toBe(true);
  });

  it('builds sessions from unique unfinished content without inflating duration', () => {
    const built = buildSession([campaign], 15);
    expect(built.estimatedMinutes).toBeLessThanOrEqual(15);
    expect(built.items.length).toBeGreaterThan(0);
    expect(new Set(built.items.map((entry) => entry.item.id)).size).toBe(built.items.length);
  });

  it('re-admits only due completed activities for revision sessions', () => {
    const review = campaign.activities[0];
    const reviewId = progressItemId(campaign.id, review.id);
    const completedActivities = campaign.activities.map((activity) => progressItemId(campaign.id, activity.id));
    const built = buildSession([campaign], 8, completedActivities, [reviewId]);
    expect(built.items.filter((item) => item.kind === 'activity').map((item) => item.item.id)).toEqual([review.id]);
  });

  it('keeps due reviews isolated when campaigns reuse activity IDs', () => {
    const firstReview = campaign.activities[0];
    const secondCampaign = { ...campaign, id: 'second-campaign' };
    const allActivityIds = [campaign, secondCampaign].flatMap((entry) => entry.activities.map((activity) => progressItemId(entry.id, activity.id)));
    const dueId = progressItemId(campaign.id, firstReview.id);
    const built = buildSession([campaign, secondCampaign], 8, allActivityIds, [dueId]);
    expect(built.items.filter((item) => item.kind === 'activity').map((item) => `${item.campaignId}:${item.item.id}`)).toEqual([dueId]);
  });

  it('prioritizes weak topics after due review items', () => {
    const built = buildSession([campaign], 4, [], [], ['Preamble']);
    expect(built.items[0].item.topic).toBe('Preamble');
  });

  it('exports and restores campaigns, progress, reviews, and attempts', async () => {
    await db.campaigns.add(campaign);
    const mcq = campaign.activities.find((activity) => activity.type === 'mcq')!;
    await recordActivityResult({ activityId: mcq.id, campaignId: campaign.id, topic: mcq.topic, correct: false, confidence: 2, usedHint: true, points: mcq.points });
    const backup = await exportProgress();
    await db.transaction('rw', db.campaigns, db.progress, db.reviews, db.attempts, async () => {
      await Promise.all([db.campaigns.clear(), db.progress.clear(), db.reviews.clear(), db.attempts.clear()]);
    });
    await restoreProgressBackup(JSON.stringify(backup));
    expect(await db.campaigns.get(campaign.id)).toBeDefined();
    expect(await getProgress()).toMatchObject({ hintsUsed: 1, achievements: ['First Light'] });
    expect(await db.reviews.count()).toBe(1);
    expect(await db.attempts.count()).toBe(1);
  });
});