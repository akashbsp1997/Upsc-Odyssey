import dayOne from './day-01.json';
import { campaignSchema, type Campaign } from './schema';

const campaignFiles = import.meta.glob<unknown>('./campaigns/*.json', {
  eager: true,
  import: 'default',
});

function describeIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => `${issue.path.length ? issue.path.join('.') : 'campaign'}: ${issue.message}`).join('\n');
}

export function loadBundledCampaigns(): Campaign[] {
  const entries: [string, unknown][] = [
    ['./day-01.json', dayOne],
    ...Object.entries(campaignFiles),
  ];
  const campaigns: { file: string; campaign: Campaign }[] = [];
  const errors: string[] = [];

  for (const [file, value] of entries) {
    const result = campaignSchema.safeParse(value);
    if (result.success) campaigns.push({ file, campaign: result.data });
    else errors.push(`${file}:\n${describeIssues(result.error.issues)}`);
  }

  const days = new Map<number, string>();
  const ids = new Map<string, string>();
  for (const { file, campaign } of campaigns) {
    const duplicateDay = days.get(campaign.day);
    if (duplicateDay) errors.push(`${file}: duplicate campaign day ${campaign.day} (also in ${duplicateDay}).`);
    else days.set(campaign.day, file);

    const duplicateId = ids.get(campaign.id);
    if (duplicateId) errors.push(`${file}: duplicate campaign ID "${campaign.id}" (also in ${duplicateId}).`);
    else ids.set(campaign.id, file);
  }

  const missingDays = Array.from({ length: 180 }, (_, index) => index + 1).filter((day) => !days.has(day));
  if (missingDays.length) errors.push(`Missing campaign days: ${missingDays.join(', ')}.`);
  const unexpectedDays = [...days.keys()].filter((day) => day < 1 || day > 180);
  if (unexpectedDays.length) errors.push(`Unexpected campaign days: ${unexpectedDays.join(', ')}.`);

  if (errors.length) throw new Error(`Invalid bundled campaign set:\n${errors.join('\n')}`);
  return campaigns.map(({ campaign }) => campaign).sort((left, right) => left.day - right.day);
}
