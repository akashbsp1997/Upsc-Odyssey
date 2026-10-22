import { campaignSchema, type Campaign } from './schema';

export type ImportPreview = {
  campaign: Campaign;
  questionCount: number;
  estimatedDurationMinutes: number;
};

export function previewCampaignText(text: string): ImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid JSON syntax.';
    throw new Error(`Could not read this JSON file: ${detail}`);
  }

  const result = campaignSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.length ? issue.path.join('.') : 'campaign'}: ${issue.message}`);
    throw new Error(`Campaign validation failed:\n${details.join('\n')}`);
  }

  const campaign = result.data;
  return {
    campaign,
    questionCount: campaign.activities.length,
    estimatedDurationMinutes: [...campaign.lessons, ...campaign.activities].reduce((total, item) => total + item.durationMinutes, 0),
  };
}

export async function readCampaignFile(file: File): Promise<ImportPreview> {
  return previewCampaignText(await file.text());
}