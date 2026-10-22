import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Compass, Download, Flame, Map as WorldMap, Pause, Play, RotateCcw, Shield, Sparkles, Swords, Upload, X, type LucideIcon } from 'lucide-react';
import { readCampaignFile, type ImportPreview } from '../content/importer';
import type { Activity, Campaign, Lesson } from '../content/schema';
import { exportProgress, restoreProgressBackup } from '../db/backup';
import { addActiveStudyTime, addCampaigns, db, getProgress, recordActivityResult, recordLessonCompletion, type ActivityAttempt, type PlayerProgress, type ReviewRecord } from '../db/database';
import { seedBundledCampaigns } from '../db/seed';
import { areVisitedCampaignsComplete, buildSession, isCampaignComplete, type BuiltSession, type SessionItem } from '../game/campaignBuilder';
import { isReviewDue } from '../game/revision';
import { scoreAnswer } from '../game/scoring';
import { progressItemId } from '../game/ids';

type Page = 'world' | 'quests' | 'arena' | 'vault' | 'profile' | 'import';
type PlayerReview = ReviewRecord & { activityId: string };
const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'world', label: 'World', icon: WorldMap }, { id: 'quests', label: 'Quests', icon: BookOpen },
  { id: 'arena', label: 'Arena', icon: Swords }, { id: 'vault', label: 'Vault', icon: Shield },
];
const colors = ['mint', 'coral', 'blue', 'gold'];

export default function App() {
  const [page, setPage] = useState<Page>('world');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [reviews, setReviews] = useState<PlayerReview[]>([]);
  const [attempts, setAttempts] = useState<ActivityAttempt[]>([]);
  const [session, setSession] = useState<BuiltSession | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [response, setResponse] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [usedHint, setUsedHint] = useState(false);
  const [selfAssessed, setSelfAssessed] = useState(false);
  const [selfAssessmentSet, setSelfAssessmentSet] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [importError, setImportError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  const lastInteractionAt = useRef(Date.now());

  const refresh = async () => {
    const savedCampaigns = await db.campaigns.toArray();
    const [savedProgress, savedReviews, savedAttempts] = await Promise.all([getProgress(), db.reviews.toArray(), db.attempts.toArray()]);
    setCampaigns(savedCampaigns.sort((a, b) => a.day - b.day)); setProgress(savedProgress); setReviews(savedReviews.map((review) => ({ ...review, activityId: review.id.slice(review.campaignId.length + 1) }))); setAttempts(savedAttempts); setLoading(false);
  };
  useEffect(() => {
    async function initialize() {
      try {
        await seedBundledCampaigns();
        await refresh();
      } catch (error) {
        setStartupError(error instanceof Error ? error.message : String(error));
        setLoading(false);
      }
    }
    void initialize();
  }, []);
  useEffect(() => {
    const markInteraction = () => { lastInteractionAt.current = Date.now(); };
    window.addEventListener('pointerdown', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction);
    window.addEventListener('touchstart', markInteraction, { passive: true });
    window.addEventListener('wheel', markInteraction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
      window.removeEventListener('wheel', markInteraction);
    };
  }, []);
  useEffect(() => {
    if (page !== 'arena' || !session || paused || sessionIndex >= session.items.length) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInteractionAt.current <= 60_000) { setElapsed((value) => value + 1); void addActiveStudyTime(1); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [page, session, paused, sessionIndex]);
  useEffect(() => { setResponse(''); setConfidence(3); setUsedHint(false); setSelfAssessed(false); setSelfAssessmentSet(false); setSubmitted(false); }, [sessionIndex, session]);

  const dueReviews = useMemo(() => reviews.filter((review) => isReviewDue(review)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [reviews]);
  const weakTopics = useMemo(() => {
    const totals = new Map<string, { attempts: number; correct: number; confidence: number }>();
    for (const attempt of attempts) {
      const current = totals.get(attempt.topic) ?? { attempts: 0, correct: 0, confidence: 0 };
      current.attempts += 1; current.correct += Number(attempt.correct); current.confidence += attempt.confidence;
      totals.set(attempt.topic, current);
    }
    return [...totals.entries()].sort(([, left], [, right]) => (left.correct / left.attempts) - (right.correct / right.attempts) || (left.confidence / left.attempts) - (right.confidence / right.attempts)).map(([topic]) => topic);
  }, [attempts]);
  const level = Math.floor((progress?.xp ?? 0) / 500) + 1;
  const levelXp = (progress?.xp ?? 0) % 500;
  function beginSession(next: BuiltSession) {
    if (!next.items.length) { setNotice('No unfinished content fits this target. Import more material or choose a longer session.'); return; }
    const prioritized = [...next.items].sort((left, right) => {
      const leftDue = left.kind === 'activity' && dueReviews.some((review) => review.id === progressItemId(left.campaignId, left.item.id));
      const rightDue = right.kind === 'activity' && dueReviews.some((review) => review.id === progressItemId(right.campaignId, right.item.id));
      if (leftDue !== rightDue) return Number(rightDue) - Number(leftDue);
      return (weakTopics.indexOf(left.item.topic) < 0 ? Number.MAX_SAFE_INTEGER : weakTopics.indexOf(left.item.topic))
        - (weakTopics.indexOf(right.item.topic) < 0 ? Number.MAX_SAFE_INTEGER : weakTopics.indexOf(right.item.topic));
    });
    setSession({ ...next, items: prioritized }); setSessionIndex(0); setPaused(false); setElapsed(0); setPage('arena'); setNotice('');
  }
  function beginCampaign(campaign: Campaign) {
    const completedIds = progress?.completedItemIds ?? [];
    beginSession(buildSession([campaign], 480, isCampaignComplete(campaign, completedIds) ? [] : completedIds, dueReviews.map((review) => review.id), weakTopics));
  }
  async function advance() {
    if (session && sessionIndex + 1 >= session.items.length) { setSessionIndex(session.items.length); setNotice('Session complete. Your progress is saved on this device.'); await refresh(); }
    else setSessionIndex((index) => index + 1);
  }
  async function completeLesson(item: Extract<SessionItem, { kind: 'lesson' }>) {
    await recordLessonCompletion(item.campaignId, item.item.id); await refresh(); await advance();
  }
  async function submitActivity(activity: Activity, campaignId: string) {
    if (!response.trim()) return;
    const written = ['comparison', 'case-based', 'mains'].includes(activity.type);
    const scored = scoreAnswer(activity, response, usedHint);
    const correct = written && !activity.acceptedAnswers?.length ? selfAssessed : scored.correct;
    await recordActivityResult({ activityId: activity.id, campaignId, topic: activity.topic, correct, confidence, usedHint, points: activity.points });
    setSubmitted(true); await refresh();
  }
  async function previewFiles(files: FileList | null) {
    setImportError(''); setPreviews([]); if (!files?.length) return;
    const parsed: ImportPreview[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) { try { parsed.push(await readCampaignFile(file)); } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Invalid file.'}`); } }
    const ids = new Set(campaigns.map((campaign) => campaign.id)); const unique: ImportPreview[] = [];
    for (const preview of parsed) {
      if (ids.has(preview.campaign.id)) errors.push(`${preview.campaign.title}: duplicate campaign ID "${preview.campaign.id}".`);
      else { ids.add(preview.campaign.id); unique.push(preview); }
    }
    setPreviews(unique);
    if (errors.length) setImportError(errors.join('\n'));
  }
  async function importCampaigns() {
    try { await addCampaigns(previews.map((preview) => preview.campaign)); setNotice(`${previews.length} campaign${previews.length === 1 ? '' : 's'} imported for offline study.`); setPreviews([]); await refresh(); }
    catch (error) { setImportError(error instanceof Error ? error.message : 'Import failed.'); }
  }
  async function downloadBackup() {
    const backup = await exportProgress(); const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'upsc-odyssey-backup.json'; link.click(); URL.revokeObjectURL(url);
  }
  async function restoreBackup(file?: File) {
    if (!file) return;
    try { await restoreProgressBackup(await file.text()); await refresh(); setNotice('Progress backup restored.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not restore backup.'); }
  }
  function startReview(review: ReviewRecord) {
    const campaign = campaigns.find((entry) => entry.id === review.campaignId); const activity = campaign?.activities.find((entry) => progressItemId(review.campaignId, entry.id) === review.id);
    if (activity && campaign) beginSession({ items: [{ kind: 'activity', campaignId: campaign.id, item: activity }], estimatedMinutes: activity.durationMinutes, targetMinutes: activity.durationMinutes, complete: true });
  }

  function lessonView(item: Extract<SessionItem, { kind: 'lesson' }>) {
    const lesson = item.item as Lesson; const campaign = campaigns.find((entry) => entry.id === item.campaignId)!;
    return <article className="play-card"><div className="play-meta"><span>{campaign.subject} / {lesson.topic}</span><span>{lesson.durationMinutes} MIN</span></div><p className="eyebrow">FIELD LESSON</p><h2>{lesson.title}</h2>{lesson.sections.map((section) => <section className="lesson-section" key={section.heading}><h3>{section.heading}</h3><p>{section.body}</p></section>)}{lesson.keyTakeaways.length > 0 && <div className="takeaways"><b>FIELD NOTES</b><ul>{lesson.keyTakeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul></div>}<button className="primary-action" onClick={() => void completeLesson(item)}>Mark lesson complete <Check size={16} /></button></article>;
  }
  function activityView(item: Extract<SessionItem, { kind: 'activity' }>) {
    const activity = item.item as Activity; const campaign = campaigns.find((entry) => entry.id === item.campaignId)!;
    const written = ['recall', 'comparison', 'case-based', 'mains'].includes(activity.type); const result = scoreAnswer(activity, response, usedHint);
    return <article className="play-card"><div className="play-meta"><span>{campaign.subject} / {activity.topic}</span><span>{activity.durationMinutes} MIN · {activity.points} XP</span></div><p className="eyebrow">{activity.type.replace('-', ' ').toUpperCase()} ENCOUNTER</p><h2>{activity.title}</h2>{activity.caseStudy && <blockquote>{activity.caseStudy}</blockquote>}<p className="challenge-prompt">{activity.prompt}</p>{activity.statements && <ol className="statement-list">{activity.statements.map((statement) => <li key={statement}>{statement}</li>)}</ol>}
      {activity.options?.length ? <div className="choice-list" role="radiogroup" aria-label="Answer options">{activity.options.map((option) => <button className={`choice-option ${response === option.id ? 'chosen' : ''}`} key={option.id} disabled={submitted} onClick={() => setResponse(option.id)} aria-pressed={response === option.id}><span className="choice-mark">{response === option.id && <Check size={14} />}</span>{option.text}</button>)}</div> : <label className="response-label">Your response<textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={activity.type === 'mains' ? 7 : 4} disabled={submitted} placeholder="Write your answer here..." /></label>}
      {activity.rubric && <details className="rubric-details"><summary>View scoring rubric</summary><ul>{activity.rubric.map((criterion) => <li key={criterion.criterion}>{criterion.criterion}<span>{criterion.points} pts</span></li>)}</ul></details>}
      {!submitted && <><button className="hint-button" onClick={() => setUsedHint(true)} aria-expanded={usedHint}><Sparkles size={14} /> {usedHint ? activity.hint : 'Reveal hint'}</button>{written && !activity.acceptedAnswers?.length && <div className="self-check"><span>Did your response meet the rubric?</span><button className={selfAssessmentSet && selfAssessed ? 'selected' : ''} onClick={() => { setSelfAssessed(true); setSelfAssessmentSet(true); }}>Yes</button><button className={selfAssessmentSet && !selfAssessed ? 'selected' : ''} onClick={() => { setSelfAssessed(false); setSelfAssessmentSet(true); }}>Not yet</button></div>}<label className="confidence-label">Confidence <select value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><button className="primary-action" disabled={!response.trim() || (written && !activity.acceptedAnswers?.length && !selfAssessmentSet)} onClick={() => void submitActivity(activity, item.campaignId)}>Submit answer <Swords size={16} /></button></>}
      {submitted && <div className={`answer-feedback ${result.correct || selfAssessed ? 'success' : 'miss'}`}><b>{result.correct || selfAssessed ? 'Encounter cleared' : 'Good attempt. Add this to your revision.'}</b><p>{activity.explanation}</p>{activity.modelAnswer && <details><summary>Compare with model response</summary><p>{activity.modelAnswer}</p></details>}<button className="primary-action" onClick={() => void advance()}>Continue <Play size={15} /></button></div>}</article>;
  }

  if (startupError) return <main className="loading-screen" role="alert"><Compass size={25} /><p>Could not initialize the offline campaign library: {startupError}</p></main>;
  if (loading || !progress) return <main className="loading-screen"><Compass size={25} /> Opening your field journal...</main>;
  const completed = new Set(progress.completedItemIds); const finished = Boolean(session && sessionIndex >= session.items.length);
  const accuracy = attempts.length ? Math.round(attempts.filter((attempt) => attempt.correct).length / attempts.length * 100) : 0;
  const subjects = [...new Set(campaigns.map((campaign) => campaign.subject))];
  const title: Record<Page, string> = { world: 'Your learning world', quests: 'Campaign ledger', arena: 'Battle arena', vault: 'Revision vault', profile: 'Player profile', import: 'Campaign importer' };
  if (page === 'arena' && finished && session) {
    const visitedCampaignIds = new Set(session.items.map((item) => item.campaignId));
    const clearedCampaigns = campaigns.filter((campaign) => visitedCampaignIds.has(campaign.id) && isCampaignComplete(campaign, progress.completedItemIds));
    const campaignCleared = areVisitedCampaignsComplete(campaigns, visitedCampaignIds, progress.completedItemIds);
    return <main className="app-shell"><section className="workspace"><div className="page-content"><div className="completion-screen"><span className="completion-seal"><Check size={26} /></span><p className="eyebrow">{campaignCleared ? 'CAMPAIGN CLEARED' : 'FIELD JOURNAL UPDATED'}</p><h2>{campaignCleared ? 'Campaign cleared.' : 'Session complete.'}</h2><p>{campaignCleared ? `${clearedCampaigns.map((campaign) => campaign.title).join(', ')} is complete. Revisit the campaign ledger whenever you want to practice again.` : `You cleared ${session.items.length} encounters in ${Math.floor(elapsed / 60)} active minutes. Your campaign still has unfinished content.`}</p><div className="stat-row"><div><b>{session.items.length}</b><small>ENCOUNTERS</small></div><div><b>{Math.floor(elapsed / 60)}<span>m</span></b><small>ACTIVE TIME</small></div><div><b>{progress.xp}</b><small>TOTAL XP</small></div></div><button className="primary-action" onClick={() => { setSession(null); setPage(campaignCleared ? 'quests' : 'world'); }}>{campaignCleared ? 'Return to campaigns' : 'Return to world'} <Compass size={16} /></button></div></div></section></main>;
  }
  return <main className="app-shell">
    <aside className="rail" aria-label="Main navigation"><button className="brand-mark" onClick={() => setPage('world')} aria-label="Odyssey home"><Compass size={22} /></button><nav>{navigation.map(({ id, icon: Icon }) => <button key={id} className={`rail-link ${page === id ? 'active' : ''}`} onClick={() => setPage(id)} aria-label={title[id]} title={title[id]}><Icon size={20} /></button>)}<button className={`rail-link ${page === 'import' ? 'active' : ''}`} onClick={() => setPage('import')} aria-label="Import campaigns" title="Import"><Upload size={19} /></button></nav><div className="rail-bottom"><button className="avatar-small" onClick={() => setPage('profile')} aria-label="Player profile">A</button></div></aside>
    <section className="workspace"><header className="topbar"><button className="wordmark wordmark-button" onClick={() => setPage('world')}><span className="wordmark-icon"><Compass size={17} /></span><span>ODYSSEY</span><span className="wordmark-divider">/</span><span className="wordmark-sub">CIVIL SERVICES</span></button><div className="topbar-right"><span className="streak"><Flame size={15} /> {progress.streak} day streak</span><button className="avatar" onClick={() => setPage('profile')} aria-label="Player profile">A</button></div></header>
    <div className="page-content">
      {notice && <div className="notice-banner" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button></div>}
      {page === 'profile' && <p className="accuracy-line">Challenge accuracy <b>{accuracy}%</b> · {attempts.length} recorded attempts</p>}
      {page === 'world' && <><section className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()} <span className="online-dot" /> SAVED ON THIS DEVICE</p><h1>Your next chapter<br /><em>starts here.</em></h1><p className="welcome-copy">A little progress, every day. The summit is closer than it feels.</p></div><div className="level-stamp"><div className="level-ring"><span>{level}</span><small>LVL</small></div><div><b>{level < 5 ? 'Wayfinder' : level < 10 ? 'Pathfinder' : 'Trailblazer'}</b><span>{levelXp} / 500 XP</span><div className="xp-track"><i style={{ width: `${levelXp / 5}%` }} /></div></div></div></section>
        {campaigns[0] ? <section className="daily-quest"><div className="quest-art" aria-hidden="true"><div className="sun-disc" /><div className="ridge ridge-back" /><div className="ridge ridge-front" /><span className="quest-star">✦</span></div><div className="quest-copy"><div className="quest-meta"><span className="tag"><Sparkles size={12} /> DAY {campaigns[0].day} · {campaigns[0].subject.toUpperCase()}</span><span className="quest-time">~ {campaigns[0].estimatedDurationMinutes} MIN</span></div><h2>{campaigns[0].title}</h2><p>{campaigns[0].objectives[0]}</p><div className="quest-footer"><span className="reward">✧ {campaigns[0].activities.reduce((sum, activity) => sum + activity.points, 0)} XP available</span><span className="reward"><Flame size={13} /> {campaigns[0].lessons.length + campaigns[0].activities.length} encounters</span><button className="start-button" onClick={() => beginCampaign(campaigns[0])}>Begin quest <span>↗</span></button></div></div></section> : <div className="empty-quest"><Sparkles size={20} /><div><b>Your map is waiting for its first campaign.</b><span>Import a Day 1 package to begin learning offline.</span></div><button className="start-button" onClick={() => setPage('import')}>Import campaign <Upload size={14} /></button></div>}
        <section className="map-section"><div className="section-heading"><div><p className="eyebrow">YOUR LEARNING WORLD</p><h2>Choose your frontier</h2></div><button className="text-button" onClick={() => setPage('quests')}>All campaigns <span>↗</span></button></div>{subjects.length ? <div className="subject-grid">{subjects.map((subject, index) => { const group = campaigns.filter((campaign) => campaign.subject === subject); const items = group.flatMap((campaign) => [...campaign.lessons, ...campaign.activities]); const done = group.reduce((sum, campaign) => sum + [...campaign.lessons, ...campaign.activities].filter((item) => completed.has(progressItemId(campaign.id, item.id))).length, 0); const mastery = items.length ? Math.round(done / items.length * 100) : 0; return <button className={`subject-card ${colors[index % colors.length]}`} key={subject} onClick={() => setPage('quests')}><span className="region-number">0{index + 1} / REGION</span><span className="region-icon">{['◈', '✷', '⌁', '◉'][index % 4]}</span><h3>{subject}</h3><p>{group.length} campaign{group.length === 1 ? '' : 's'} · {items.length} encounters</p><div className="mastery-row"><div className="mastery-track"><i style={{ width: `${mastery}%` }} /></div><span>{mastery}%</span></div></button>; })}</div> : <p className="empty-copy">Regions appear here when campaigns are imported.</p>}</section>
        <section className="bottom-grid"><article className="feed-panel"><div className="section-heading compact"><div><p className="eyebrow">YOUR STUDY ROUTE</p><h2>Odyssey log</h2></div><span className="quiet-count">{campaigns.length} CAMPAIGNS</span></div><button className="feed-entry feed-button" onClick={() => setPage('quests')}><span className="feed-icon"><BookOpen size={18} /></span><span className="feed-text"><b>{campaigns.reduce((sum, campaign) => sum + campaign.lessons.length, 0)} lessons · {campaigns.reduce((sum, campaign) => sum + campaign.activities.length, 0)} challenges</b><span>Across your imported campaigns</span></span><span className="feed-progress">{progress.xp} XP</span><span className="icon-button">↗</span></button><button className="feed-entry feed-button" onClick={() => setPage('vault')}><span className="feed-icon review"><Shield size={18} /></span><span className="feed-text"><b>Revision vault</b><span>{dueReviews.length} cards ready to revisit</span></span><span className="due-pill">{dueReviews.length ? 'DUE' : 'CLEAR'}</span><span className="icon-button">↗</span></button><button className="feed-entry feed-button" onClick={() => setPage('arena')}><span className="feed-icon"><Swords size={18} /></span><span className="feed-text"><b>Build a study session</b><span>{targetMinutes} minute target · no filler content</span></span><span className="icon-button">↗</span></button></article><article className="profile-panel"><div className="profile-heading"><div><p className="eyebrow">THE LONG GAME</p><h2>Player profile</h2></div><button className="text-button" onClick={() => setPage('profile')}>Open <span>↗</span></button></div><div className="stat-row"><div><b>{(progress.activeSeconds / 3600).toFixed(1)}<span>h</span></b><small>FOCUSED TIME</small></div><div><b>{campaigns.filter((campaign) => isCampaignComplete(campaign, progress.completedItemIds)).length}</b><small>CAMPAIGNS CLEARED</small></div><div><b>{progress.streak}</b><small>DAY STREAK</small></div></div><div className="achievement"><span className="achievement-medal">✷</span><div><b>{progress.achievements.length ? `${progress.achievements.length} earned` : 'First light awaits'}</b><span>Keep showing up to earn badges</span></div><span className="earned">{progress.achievements.length ? 'EARNED' : 'LOCKED'}</span></div></article></section></>}
      {page === 'quests' && <section className="screen-section"><div className="section-heading"><div><p className="eyebrow">IMPORTED LEARNING CAMPAIGNS</p><h2>{title.quests}</h2></div><button className="start-button" onClick={() => setPage('import')}>Import JSON <Upload size={14} /></button></div>{campaigns.length ? <div className="campaign-list">{campaigns.map((campaign) => { const total = campaign.lessons.length + campaign.activities.length; const done = [...campaign.lessons, ...campaign.activities].filter((item) => completed.has(progressItemId(campaign.id, item.id))).length; return <article className="campaign-row" key={campaign.id}><div className="campaign-index">D{String(campaign.day).padStart(2, '0')}</div><div className="campaign-main"><div className="play-meta"><span>{campaign.subject} · {campaign.topics.join(' / ')}</span><span>{campaign.estimatedDurationMinutes} MIN EST.</span></div><h3>{campaign.title}</h3><p>{campaign.objectives[0]}</p><div className="campaign-meter"><i style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><small>{done} / {total} encounters {isCampaignComplete(campaign, progress.completedItemIds) ? '· COMPLETE' : ''}</small></div><button className="primary-action" onClick={() => beginCampaign(campaign)}>{isCampaignComplete(campaign, progress.completedItemIds) ? 'Replay' : 'Continue'} <Play size={15} /></button></article>; })}</div> : <div className="empty-quest"><BookOpen size={20} /><div><b>No campaigns imported yet.</b><span>Start with the included Day 1 content.</span></div><button className="start-button" onClick={() => setPage('import')}>Open importer <Upload size={14} /></button></div>}</section>}
      {page === 'arena' && <section className="screen-section"><div className="section-heading"><div><p className="eyebrow">LEARN · RECALL · APPLY</p><h2>{title.arena}</h2></div>{session && !finished && <button className="pause-button" onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button>}</div>{session ? <><div className="session-strip"><span>{finished ? 'SESSION COMPLETE' : `ENCOUNTER ${sessionIndex + 1} OF ${session.items.length}`}</span><span>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} ACTIVE</span><span>{session.estimatedMinutes} MIN CONTENT · {session.targetMinutes} MIN TARGET</span></div>{paused ? <div className="empty-quest"><Pause size={20} /><div><b>Session paused</b><span>Active time is not counted while paused.</span></div><button className="start-button" onClick={() => setPaused(false)}>Resume <Play size={14} /></button></div> : finished ? <div className="completion-screen"><span className="completion-seal"><Check size={26} /></span><p className="eyebrow">FIELD JOURNAL UPDATED</p><h2>Quest complete.</h2><p>You cleared {session.items.length} encounters in {Math.floor(elapsed / 60)} active minutes. Progress is saved locally.</p><div className="stat-row"><div><b>{session.items.length}</b><small>ENCOUNTERS</small></div><div><b>{Math.floor(elapsed / 60)}<span>m</span></b><small>ACTIVE TIME</small></div><div><b>{progress.xp}</b><small>TOTAL XP</small></div></div><button className="primary-action" onClick={() => { setSession(null); setPage('world'); }}>Return to world <Compass size={16} /></button></div> : session.items[sessionIndex].kind === 'lesson' ? lessonView(session.items[sessionIndex] as Extract<SessionItem, { kind: 'lesson' }>) : activityView(session.items[sessionIndex] as Extract<SessionItem, { kind: 'activity' }>)}</> : <div className="session-builder"><p className="eyebrow">BUILD YOUR ROUTE</p><h2>A session shaped by your content</h2><p>Unfinished lessons, questions, application challenges, and due reviews are selected from imported material. Short libraries report their actual duration without filler.</p><label className="confidence-label">Session target <select value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))}>{[15, 30, 45, 60, 90, 120, 180, 240, 360, 480].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? '' : 's'}`}</option>)}</select></label>{(() => { const built = buildSession(campaigns, targetMinutes, progress.completedItemIds, dueReviews.map((review) => review.id)); return <div className="session-estimate"><b>{built.estimatedMinutes} min</b><span>of {built.targetMinutes} min · {built.items.length} unique items</span><button className="primary-action" disabled={!built.items.length} onClick={() => beginSession(built)}>Start session <Play size={15} /></button></div>; })()}<button className="text-button" onClick={() => setPage('quests')}>Choose an individual campaign ↗</button></div>}</section>}
      {page === 'vault' && <section className="screen-section"><div className="section-heading"><div><p className="eyebrow">SPACED REPETITION · WEAK TOPICS FIRST</p><h2>{title.vault}</h2></div><span className="quiet-count">{dueReviews.length} DUE</span></div>{dueReviews.length ? <div className="campaign-list">{dueReviews.map((review) => { const campaign = campaigns.find((entry) => entry.id === review.campaignId); const activity = campaign?.activities.find((entry) => entry.id === review.activityId); if (!activity || !campaign) return null; return <article className="campaign-row review-row" key={`${review.campaignId}:${review.id}`}><span className="feed-icon review"><RotateCcw size={17} /></span><div className="campaign-main"><div className="play-meta"><span>{campaign.subject} · {review.topic}</span><span>{review.repetitions} REVIEWS</span></div><h3>{activity.title}</h3><p>Due {new Date(review.dueAt).toLocaleDateString()} · ease {review.ease.toFixed(1)}</p></div><button className="primary-action" onClick={() => startReview(review)}>Review now <Play size={15} /></button></article>; })}</div> : <div className="empty-quest"><Shield size={20} /><div><b>Your revision queue is clear.</b><span>Completed challenges return when their review date arrives.</span></div></div>}</section>}
      {page === 'import' && <section className="screen-section"><div className="section-heading"><div><p className="eyebrow">JSON CONTENT · VALIDATED BEFORE STORAGE</p><h2>{title.import}</h2></div></div><div className="import-drop"><Upload size={22} /><label htmlFor="campaign-files">Select one or more campaign JSON files</label><span>Validated locally, saved to IndexedDB for offline study.</span><input id="campaign-files" type="file" accept="application/json,.json" multiple onChange={(event) => void previewFiles(event.target.files)} /></div>{importError && <pre className="error-box" role="alert">{importError}</pre>}{previews.length > 0 && <div className="preview-list"><div className="play-meta"><span>IMPORT PREVIEW</span><span>{previews.length} FILE{previews.length === 1 ? '' : 'S'}</span></div>{previews.map(({ campaign, questionCount, estimatedDurationMinutes }) => <article className="preview-row" key={campaign.id}><div><h3>{campaign.title}</h3><p>Day {campaign.day} · {campaign.subject} · {campaign.topics.join(', ')}</p><span>{campaign.lessons.length} lessons · {questionCount} challenges · {estimatedDurationMinutes} estimated min</span></div><Check size={18} /></article>)}<button className="primary-action" onClick={() => void importCampaigns()}>Import {previews.length} campaign{previews.length === 1 ? '' : 's'} <Download size={15} /></button></div>}<div className="import-library"><h3>Local library</h3>{campaigns.map((campaign) => <div className="library-row" key={campaign.id}><span>{campaign.title}</span><small>{campaign.subject} · Day {campaign.day}</small></div>)}{!campaigns.length && <p>No campaigns stored yet.</p>}</div></section>}
      {page === 'profile' && <section className="screen-section"><div className="section-heading"><div><p className="eyebrow">YOUR PROGRESS, ON THIS DEVICE</p><h2>{title.profile}</h2></div><span className="level-ring profile-level"><span>{level}</span><small>LVL</small></span></div><div className="profile-summary"><div className="stat-row"><div><b>{progress.xp}</b><small>TOTAL XP</small></div><div><b>{(progress.activeSeconds / 3600).toFixed(1)}<span>h</span></b><small>ACTIVE STUDY TIME</small></div><div><b>{progress.hintsUsed}</b><small>HINTS USED</small></div><div><b>{progress.streak}</b><small>DAY STREAK</small></div></div><div className="xp-detail"><span>{levelXp} / 500 XP to level {level + 1}</span><div className="xp-track"><i style={{ width: `${levelXp / 5}%` }} /></div></div></div><div className="profile-summary"><h3>Achievements</h3>{progress.achievements.length ? progress.achievements.map((badge) => <span className="achievement-chip" key={badge}>✷ {badge}</span>) : <p>No badges yet. Your first cleared encounter begins the journey.</p>}</div><div className="profile-summary"><h3>Progress backup</h3><p>Export campaigns, review schedule, attempts, and player progress as JSON. Restore replaces progress history and merges saved campaigns.</p><div className="action-row"><button className="primary-action" onClick={() => void downloadBackup()}><Download size={15} /> Export backup</button><label className="secondary-action"><Upload size={15} /> Restore backup<input type="file" accept="application/json,.json" onChange={(event) => void restoreBackup(event.target.files?.[0])} /></label></div></div></section>}
      <footer className="page-footer"><span>UPSC ODYSSEY <span>·</span> BUILT FOR THE LONG ROAD</span><span>YOUR PROGRESS LIVES ON THIS DEVICE</span></footer>
    </div></section>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'selected' : ''} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>
  </main>;
}