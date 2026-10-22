import { z } from 'zod';

export const activityTypes = [
  'recall',
  'mcq',
  'multi-statement',
  'assertion-reason',
  'comparison',
  'case-based',
  'mains',
  'revision',
  'timed-test',
  'boss',
] as const;

const optionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });
const rubricItemSchema = z.object({ criterion: z.string().min(1), points: z.number().positive() });

export const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  sections: z.array(z.object({ heading: z.string().min(1), body: z.string().min(1) })).min(1),
  keyTakeaways: z.array(z.string().min(1)).default([]),
});

export const activitySchema = z.object({
  id: z.string().min(1),
  type: z.enum(activityTypes),
  title: z.string().min(1),
  topic: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  prompt: z.string().min(1),
  hint: z.string().min(1),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  options: z.array(optionSchema).optional(),
  statements: z.array(z.string().min(1)).optional(),
  caseStudy: z.string().optional(),
  modelAnswer: z.string().optional(),
  rubric: z.array(rubricItemSchema).optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  points: z.number().positive().default(10),
}).superRefine((activity, context) => {
  const choiceTypes = ['mcq', 'multi-statement', 'assertion-reason', 'timed-test', 'boss'];
  if (choiceTypes.includes(activity.type)) {
    if (!activity.options || activity.options.length < 2) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Choice challenges need at least two options.' });
    } else if (!activity.options.some((option) => option.id === activity.answer)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['answer'], message: 'Answer must match an option id.' });
    }
  }
  if (activity.type === 'multi-statement' && (!activity.statements || activity.statements.length < 2)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['statements'], message: 'Multiple-statement challenges need at least two statements.' });
  }
  if (activity.type === 'case-based' && !activity.caseStudy) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['caseStudy'], message: 'Case-based challenges need a case study.' });
  }
  if (['case-based', 'mains', 'comparison'].includes(activity.type) && (!activity.rubric || activity.rubric.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['rubric'], message: 'Written challenges need a scoring rubric.' });
  }
});

export const campaignSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  day: z.number().int().positive(),
  subject: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  estimatedDurationMinutes: z.number().int().positive().max(480),
  objectives: z.array(z.string().min(1)).min(1),
  lessons: z.array(lessonSchema),
  activities: z.array(activitySchema).min(1),
  sourceReferences: z.array(z.object({
    title: z.string().min(1),
    scope: z.string().min(1),
  })).optional(),
  pyqReferences: z.array(z.object({
    reference: z.string().min(1),
    url: z.string().url(),
    paper: z.string().min(1),
    mappingStatus: z.string().min(1),
    note: z.string().min(1),
  })).optional(),
  unlockRequiresDay: z.number().int().positive().optional(),
  planDate: z.string().date().optional(),
}).superRefine((campaign, context) => {
  const ids = new Set<string>();
  for (const item of [...campaign.lessons, ...campaign.activities]) {
    if (ids.has(item.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['lessons'], message: `Duplicate lesson/activity id: ${item.id}` });
    ids.add(item.id);
  }
});

export type Lesson = z.infer<typeof lessonSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Campaign = z.infer<typeof campaignSchema>;