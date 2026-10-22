import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { classifyArticle, dateBuckets } from './classify.mjs';

const output = resolve('public/data/current-affairs.json');
const key = process.env.NEWS_API_KEY;
const dayMs = 86400000;
const defaults = { from: new Date(Date.now()-3*dayMs).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) };
function date(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  return value;
}
function cleanUrl(value) {
  try {
    const u = new URL(value); u.hash = '';
    for (const k of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid']) u.searchParams.delete(k);
    return u.toString();
  } catch { return String(value ?? '').trim(); }
}
if (!key) { console.error('Missing NEWS_API_KEY. Add it to GitHub Actions secrets; never put it in source code.'); process.exit(1); }
const from = date(process.env.CURRENT_AFFAIRS_FROM || defaults.from);
const to = date(process.env.CURRENT_AFFAIRS_TO || defaults.to);
if (from > to) throw new Error('Start date must be on or before end date.');

let existing = { schemaVersion:1, generatedAt:null, articles:[] };
try { existing = JSON.parse(await readFile(output,'utf8')); } catch {}
const map = new Map((existing.articles || []).map(a => [a.id || cleanUrl(a.url), a]));
const maxPages = Math.max(1, Math.min(10, Number.parseInt(process.env.CURRENT_AFFAIRS_MAX_PAGES || '3',10) || 3));
const query = process.env.CURRENT_AFFAIRS_QUERY || '(India OR Indian OR parliament OR Supreme Court OR RBI OR climate OR diplomacy OR election OR government scheme OR ISRO OR economy)';
let fetched = 0, totalResults = 0;

for (let page=1; page<=maxPages; page++) {
  const url = new URL('https://newsapi.org/v2/everything');
  Object.entries({ q:query, from, to, language:'en', sortBy:'publishedAt', pageSize:'100', page:String(page) }).forEach(([k,v]) => url.searchParams.set(k,v));
  const response = await fetch(url, { headers:{'X-Api-Key':key} });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status !== 'ok') throw new Error(`NewsAPI error ${response.status}: ${payload.message || response.statusText}`);
  totalResults = payload.totalResults || 0;
  const items = Array.isArray(payload.articles) ? payload.articles : [];
  if (!items.length) break;
  for (const raw of items) {
    if (!raw.title || raw.title === '[Removed]' || !raw.url) continue;
    const urlClean = cleanUrl(raw.url);
    const buckets = dateBuckets(raw.publishedAt);
    const item = {
      id:urlClean, title:String(raw.title).trim(), description:String(raw.description || '').trim().slice(0,800),
      source:String(raw.source?.name || 'Unknown source'), url:urlClean, publishedAt:raw.publishedAt || '',
      retrievedAt:new Date().toISOString(), ...buckets, ...classifyArticle(raw)
    };
    const prior = map.get(item.id);
    map.set(item.id, prior ? { ...prior, ...item, retrievedAt:prior.retrievedAt } : item);
    fetched++;
  }
  if (items.length < 100 || page*100 >= totalResults) break;
}
const articles = [...map.values()].filter(a => a.title && a.url).sort((a,b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
await mkdir(dirname(output), { recursive:true });
await writeFile(output, JSON.stringify({ schemaVersion:1, generatedAt:new Date().toISOString(), provider:'NewsAPI.org', requestedRange:{from,to}, fetchedThisRun:fetched, providerReportedTotal:totalResults, articles },null,2)+'\n');
console.log(`Updated ${fetched} articles for ${from} through ${to}; archive has ${articles.length}. Provider reported ${totalResults}.`);
if (totalResults > maxPages*100) console.warn(`Results capped at ${maxPages*100}. Use smaller date ranges or increase max pages within your API quota.`);
