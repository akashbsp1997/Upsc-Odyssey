# Campaign JSON Schema (Version 1)

The importer validates data using Zod in `src/content/schema.ts`. The root value must be one JSON object. Property names are case-sensitive. Unknown properties are currently ignored by Zod's default object behavior; do not depend on them being retained after import.

## Campaign object

| Property | Type | Rules |
| --- | --- | --- |
| `schemaVersion` | integer | Must be `1`. |
| `id` | string | Required, non-empty, stable and unique across imported campaigns. |
| `title` | string | Required, non-empty display title. |
| `day` | integer | Required, greater than zero; used for ordering. |
| `subject` | string | Required, non-empty subject/region name. |
| `topics` | string array | At least one non-empty topic. |
| `estimatedDurationMinutes` | integer | 1 to 480; honest overall estimate, not used to pad a session. |
| `objectives` | string array | At least one learning objective. |
| `lessons` | lesson array | May be empty. |
| `activities` | activity array | At least one activity. |

All lesson and activity `id` values must be unique within the campaign. IDs are namespaced by campaign ID in progress storage.

## Lesson object

- `id`, `title`, `topic`: non-empty strings.
- `durationMinutes`: positive integer.
- `sections`: one or more `{ "heading": string, "body": string }` entries; both strings are non-empty.
- `keyTakeaways`: string array; optional and defaults to `[]`.

## Activity object

Required for every activity:

- `id`, `title`, `topic`, `prompt`, `hint`, `answer`, and `explanation`: non-empty strings.
- `type`: one of `recall`, `mcq`, `multi-statement`, `assertion-reason`, `comparison`, `case-based`, `mains`, `revision`, `timed-test`, or `boss`.
- `durationMinutes`: positive integer.
- `points`: positive number; optional and defaults to `10`.

Optional fields:

- `options`: array of `{ "id": non-empty string, "text": non-empty string }`.
- `statements`: array of non-empty strings.
- `caseStudy`: string.
- `modelAnswer`: string.
- `rubric`: array of `{ "criterion": non-empty string, "points": positive number }`.
- `acceptedAnswers`: array of strings used for normalized exact-match written recall.

Conditional validation:

- Choice activities (`mcq`, `multi-statement`, `assertion-reason`, `timed-test`, `boss`) need at least two options. `answer` must equal one option's `id`.
- `multi-statement` needs at least two `statements`.
- `case-based` needs `caseStudy`.
- `case-based`, `mains`, and `comparison` need at least one rubric criterion.
- Supply an answer, hint, and explanation for every activity, including written prompts. `modelAnswer` is strongly recommended for written activities. Written comparison/case/Mains activities without `acceptedAnswers` are submitted using learner self-assessment against the rubric.

## Example shape

```json
{
  "schemaVersion": 1,
  "id": "upsc-polity-day-01",
  "title": "Foundations of the Republic",
  "day": 1,
  "subject": "Polity",
  "topics": ["Constitutional history", "Preamble"],
  "estimatedDurationMinutes": 60,
  "objectives": ["Distinguish adoption from commencement."],
  "lessons": [
    {
      "id": "lesson-assembly",
      "title": "The Constituent Assembly",
      "topic": "Constitutional history",
      "durationMinutes": 10,
      "sections": [{ "heading": "Dates", "body": "The Constitution was adopted in 1949 and commenced in 1950." }],
      "keyTakeaways": ["Adoption and commencement are distinct events."]
    }
  ],
  "activities": [
    {
      "id": "mcq-adoption",
      "type": "mcq",
      "title": "Adoption date",
      "topic": "Constitutional history",
      "durationMinutes": 2,
      "prompt": "When was the Constitution adopted?",
      "hint": "It was in November 1949.",
      "options": [
        { "id": "nov-1949", "text": "26 November 1949" },
        { "id": "jan-1950", "text": "26 January 1950" }
      ],
      "answer": "nov-1949",
      "explanation": "The Assembly adopted the Constitution on 26 November 1949.",
      "points": 10
    }
  ]
}
```

The complete sample package with all supported learning styles is [../src/content/day-01.json](../src/content/day-01.json). Importers should preserve one package per day so duplicate detection and campaign completion remain clear.
