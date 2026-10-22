import { loadBundledCampaigns } from '../content/bundled';
import { db } from './database';

export async function seedBundledCampaigns(): Promise<number> {
  const campaigns = loadBundledCampaigns();

  return db.transaction('rw', db.campaigns, async () => {
    const existingCampaigns = await db.campaigns.bulkGet(campaigns.map((campaign) => campaign.id));
    const existingIds = new Set(existingCampaigns.flatMap((campaign) => campaign ? [campaign.id] : []));
    const missingCampaigns = campaigns.filter((campaign) => !existingIds.has(campaign.id));
    if (missingCampaigns.length) await db.campaigns.bulkAdd(missingCampaigns);
    return missingCampaigns.length;
  });
}
