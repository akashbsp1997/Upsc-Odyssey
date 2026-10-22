import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { previewCampaignText } from './importer';
import { loadBundledCampaigns } from './bundled';
import { addCampaigns, db, getProgress, initialProgress, type ReviewRecord } from '../db/database';
import { seedBundledCampaigns } from '../db/seed';

const bundledCampaigns = loadBundledCampaigns();

beforeEach(async () => {
  await db.transaction('rw', db.campaigns, db.progress, db.reviews, db.attempts, async () => {
    await Promise.all([db.campaigns.clear(), db.progress.clear(), db.reviews.clear(), db.attempts.clear()]);
  });
});

afterAll(async () => { await db.delete(); });

describe('bundled campaign library', () => {
  it('validates all campaign content and covers each day from 1 through 180 exactly once', () => {
    expect(bundledCampaigns).toHaveLength(180);
    expect(bundledCampaigns.map((campaign) => campaign.day)).toEqual(Array.from({ length: 180 }, (_, index) => index + 1));
    expect(new Set(bundledCampaigns.map((campaign) => campaign.id)).size).toBe(180);
  });

  it('seeds missing campaigns without replacing campaigns or changing study records', async () => {
    const originalDayOne = { ...bundledCampaigns[0], title: 'Saved campaign title' };
    const userCampaign = { ...bundledCampaigns[0], id: 'user-imported-campaign', day: 181, title: 'User campaign' };
    await db.campaigns.bulkAdd([originalDayOne, userCampaign]);

    const savedProgress = { ...initialProgress, xp: 120, completedItemIds: ['saved-completion'], activeSeconds: 540 };
    await db.progress.put(savedProgress);
    const savedReview: ReviewRecord = {
      id: 'saved-review',
      topic: 'Saved topic',
      campaignId: originalDayOne.id,
      repetitions: 2,
      intervalDays: 3,
      ease: 2.5,
      dueAt: '2026-10-24T12:00:00.000Z',
    };
    await db.reviews.add(savedReview);
    await db.attempts.add({
      activityId: 'saved-activity',
      campaignId: originalDayOne.id,
      topic: 'Saved topic',
      correct: true,
      confidence: 4,
      usedHint: false,
      answeredAt: '2026-10-21T12:00:00.000Z',
    });

    expect(await seedBundledCampaigns()).toBe(179);
    expect(await db.campaigns.count()).toBe(181);
    expect(await db.campaigns.get(originalDayOne.id)).toEqual(originalDayOne);
    expect(await db.campaigns.get(userCampaign.id)).toEqual(userCampaign);
    expect(await getProgress()).toEqual(savedProgress);
    expect(await db.reviews.get(savedReview.id)).toEqual(savedReview);
    expect(await db.attempts.count()).toBe(1);

    expect(await seedBundledCampaigns()).toBe(0);
    expect(await db.campaigns.count()).toBe(181);
  });

  it('keeps campaign references through manual JSON import', async () => {
    const campaign = { ...bundledCampaigns[1], id: 'manual-import-day-181', day: 181 };
    const preview = previewCampaignText(JSON.stringify(campaign));

    expect(preview.campaign.sourceReferences).toEqual(campaign.sourceReferences);
    expect(preview.campaign.pyqReferences).toEqual(campaign.pyqReferences);
    await addCampaigns([preview.campaign]);
    expect(await db.campaigns.get(campaign.id)).toEqual(campaign);
  });
});
