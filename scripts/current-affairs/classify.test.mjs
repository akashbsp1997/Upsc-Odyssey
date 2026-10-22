import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyArticle, dateBuckets } from './classify.mjs';

test('classifies climate policy for GS-III', () => {
  const r = classifyArticle({ title:'India announces renewable energy targets', description:'Climate change and emissions policy.' });
  assert.ok(r.tags.includes('environment')); assert.ok(r.papers.includes('GS-III')); assert.equal(r.reviewStatus,'rule-matched');
});
test('does not invent a match for unrelated news', () => {
  const r = classifyArticle({ title:'Football final ends in a draw', description:'Local club match.' });
  assert.equal(r.reviewStatus,'needs-review'); assert.deepEqual(r.tags,[]); assert.equal(r.relevanceScore,0);
});
test('classifies international relations for PSIR-II', () => {
  const r = classifyArticle({ title:'Strategic autonomy in a multipolar international order', description:'Foreign policy and balance of power.' });
  assert.ok(r.papers.includes('PSIR-II')); assert.ok(r.tags.includes('world-politics'));
});
test('creates date buckets', () => {
  assert.deepEqual(dateBuckets('2026-10-22T04:00:00Z'),{day:'2026-10-22',month:'2026-10',year:'2026'});
  assert.deepEqual(dateBuckets('invalid'),{day:'',month:'',year:''});
});
