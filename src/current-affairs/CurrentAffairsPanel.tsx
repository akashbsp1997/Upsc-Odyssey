import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, RefreshCw, Search } from 'lucide-react';
import './current-affairs.css';

type Article = {
  id:string; title:string; description:string; source:string; url:string; publishedAt:string;
  day:string; month:string; year:string; tags:string[]; categories:string[]; papers:string[];
  relevanceScore:number; reviewStatus:string;
};
type Archive = { schemaVersion:number; generatedAt:string|null; articles:Article[] };
type Period = 'daily'|'monthly'|'annual'|'historical';
const today = () => new Date().toISOString().slice(0,10);
function periodDefault(p:Period) { return p==='monthly' ? today().slice(0,7) : p==='annual' ? today().slice(0,4) : today(); }
function prettyDate(s:string) { const d=new Date(s); return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }

export default function CurrentAffairsPanel() {
  const [archive,setArchive]=useState<Archive>({schemaVersion:1,generatedAt:null,articles:[]});
  const [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [period,setPeriod]=useState<Period>('daily'), [selected,setSelected]=useState(today());
  const [query,setQuery]=useState(''), [paper,setPaper]=useState('all'), [includeReview,setIncludeReview]=useState(false);
  async function reload() {
    setLoading(true); setError('');
    try {
      const response=await fetch(`${import.meta.env.BASE_URL}data/current-affairs.json`,{cache:'no-store'});
      if(!response.ok) throw new Error(`Archive request failed (${response.status}).`);
      const data=await response.json();
      setArchive({schemaVersion:data.schemaVersion||1,generatedAt:data.generatedAt||null,articles:Array.isArray(data.articles)?data.articles:[]});
    } catch(e) { setError(e instanceof Error?e.message:'Could not load archive.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void reload(); },[]);
  const filtered=useMemo(()=>archive.articles.filter(a=>{
    const date=a.publishedAt||'';
    const key=period==='daily'?date.slice(0,10):period==='monthly'?date.slice(0,7):date.slice(0,4);
    const matchesDate=period==='historical' ? (!selected || a.year < selected.slice(0,4)) : key===selected;
    const text=`${a.title} ${a.description} ${a.source} ${(a.categories||[]).join(' ')} ${(a.tags||[]).join(' ')}`.toLowerCase();
    return matchesDate && (!query.trim()||text.includes(query.trim().toLowerCase())) && (paper==='all'||(a.papers||[]).includes(paper)) && (includeReview||a.reviewStatus==='rule-matched');
  }).sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt))),[archive.articles,period,selected,query,paper,includeReview]);
  const papers=['Prelims','GS-I','GS-II','GS-III','GS-IV','PSIR-I','PSIR-II','Essay'];
  return <section className="screen-section ca-panel">
    <div className="section-heading"><div><p className="eyebrow">SOURCE-LINKED · RULE-CLASSIFIED</p><h2>Current affairs</h2></div><button className="secondary-action" disabled={loading} onClick={()=>void reload()}><RefreshCw size={14}/>{loading?'Loading…':'Reload archive'}</button></div>
    <p className="ca-intro">News metadata and short descriptions mapped to UPSC topics. The rule-based score is a triage aid, not a guarantee of exam relevance. Verify facts using the original source.</p>
    <div className="ca-filters">
      <label>Period<select value={period} onChange={e=>{const p=e.target.value as Period;setPeriod(p);setSelected(periodDefault(p));}}><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="historical">Historical (before year)</option></select></label>
      <label>{period==='daily'?'Date':period==='monthly'?'Month':period==='annual'?'Year':'Before year'}<input type={period==='daily'?'date':period==='monthly'?'month':'number'} min={period==='annual'||period==='historical'?'1900':undefined} max={period==='annual'||period==='historical'?String(new Date().getFullYear()):undefined} value={selected} onChange={e=>setSelected(e.target.value)}/></label>
      <label>UPSC paper<select value={paper} onChange={e=>setPaper(e.target.value)}><option value="all">All papers</option>{papers.map(p=><option key={p}>{p}</option>)}</select></label>
      <label className="ca-search">Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Topic, title or source"/></label>
      <label className="ca-check"><input type="checkbox" checked={includeReview} onChange={e=>setIncludeReview(e.target.checked)}/> Include items needing review</label>
    </div>
    <div className="ca-status"><span><CalendarDays size={14}/> {filtered.length} articles</span><span>{archive.generatedAt?`Updated ${new Date(archive.generatedAt).toLocaleString()}`:'Archive not populated yet'}</span></div>
    {error&&<div className="error-box" role="alert">{error}</div>}
    {!loading&&!error&&!filtered.length&&<div className="empty-quest"><CalendarDays size={20}/><div><b>No articles match these filters.</b><span>Run the Current Affairs workflow in GitHub Actions, then reload this panel.</span></div></div>}
    <div className="ca-articles">{filtered.map(a=><article className="ca-article" key={a.id}>
      <div className="ca-article-meta"><span>{a.source}</span><span>{prettyDate(a.publishedAt)}</span><span>Rule score {a.relevanceScore}/100</span></div>
      <h3><a href={a.url} target="_blank" rel="noreferrer">{a.title} <ExternalLink size={13}/></a></h3>
      {a.description&&<p>{a.description}</p>}
      <div className="ca-tags">{(a.categories||[]).map(c=><span key={c}>{c}</span>)}{(a.papers||[]).map(p=><span key={p}>{p}</span>)}</div>
      {a.reviewStatus!=='rule-matched'&&<p className="ca-review">Needs manual UPSC relevance review.</p>}
    </article>)}</div>
  </section>;
}
