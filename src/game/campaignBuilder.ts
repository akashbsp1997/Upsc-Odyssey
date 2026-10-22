import type { Activity, Campaign, Lesson } from '../content/schema';
import { progressItemId } from './ids';

export type SessionItem =
  | { kind: 'lesson'; campaignId: string; item: Lesson }
  | { kind: 'activity'; campaignId: string; item: Activity };

export interface BuiltSession {
  items: SessionItem[];
  estimatedMinutes: number;
  targetMinutes: number;
  complete: boolean;
}

export function isCampaignComplete(campaign: Campaign, completedIds: string[]): boolean {
  const completed = new Set(completedIds);
  const items = [...campaign.lessons, ...campaign.activities];
  return items.length > 0 && items.every((item) => completed.has(progressItemId(campaign.id, item.id)));
}

export function areVisitedCampaignsComplete(campaigns: Campaign[], visitedIds: Iterable<string>, completedIds: string[]): boolean {
  const ids = new Set(visitedIds);
  if (ids.size === 0) return false;
  const visited = campaigns.filter((campaign) => ids.has(campaign.id));
  return visited.length === ids.size && visited.every((campaign) => isCampaignComplete(campaign, completedIds));
}

export function buildSession(
  campaigns: Campaign[],
  targetMinutes: number,
  completedIds: string[] = [],
  dueActivityIds: string[] = [],
  prioritizedTopics: string[] = [],
): BuiltSession {
  const target = Math.max(1, Math.min(480, Math.floor(targetMinutes)));
  const done = new Set(completedIds);
  const due = new Set(dueActivityIds);
  const priorities = new Map(prioritizedTopics.map((topic, index) => [topic, index]));
  const pool: SessionItem[] = campaigns.flatMap((campaign) => [
    ...campaign.lessons.map((item) => ({ kind: 'lesson' as const, campaignId: campaign.id, item })),
    ...campaign.activities.map((item) => ({ kind: 'activity' as const, campaignId: campaign.id, item })),
  ]).filter(({ campaignId, item, kind }) => {
    const itemId = progressItemId(campaignId, item.id);
    const dueReview = kind === 'activity' && due.has(itemId);
    return dueReview || (!done.has(item.id) && !done.has(itemId));
  });

  pool.sort((left, right) => {
    const leftDue = left.kind === 'activity' && due.has(progressItemId(left.campaignId, left.item.id)) ? 1 : 0;
    const rightDue = right.kind === 'activity' && due.has(progressItemId(right.campaignId, right.item.id)) ? 1 : 0;
    if (leftDue !== rightDue) return rightDue - leftDue;
    return (priorities.get(left.item.topic) ?? Number.MAX_SAFE_INTEGER) - (priorities.get(right.item.topic) ?? Number.MAX_SAFE_INTEGER);
  });

  const items: SessionItem[] = [];
  let estimatedMinutes = 0;
  for (const candidate of pool) {
    const duration = candidate.item.durationMinutes;
    if (estimatedMinutes + duration <= target) {
      items.push(candidate);
      estimatedMinutes += duration;
    }
  }

  return { items, estimatedMinutes, targetMinutes: target, complete: estimatedMinutes >= target };
}