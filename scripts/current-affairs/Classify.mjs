const RULES = [
  ['polity-governance','Polity & Governance',['GS-II','Prelims'],['constitution','supreme court','parliament','election commission','governance','cabinet','federal','fundamental rights','judiciary','lok sabha','rajya sabha','ordinance','public policy']],
  ['international-relations','International Relations',['GS-II','PSIR-II','Essay'],['bilateral','summit','united nations','security council','foreign policy','diplomatic','treaty','geopolitical','brics','g20','quad','indo-pacific','nato','strategic autonomy']],
  ['economy','Economy',['GS-III','Prelims','Essay'],['rbi','inflation','gdp','fiscal','monetary policy','budget','employment','unemployment','trade deficit','economic growth','tax','gst','poverty','banking','agriculture','msme']],
  ['environment','Environment & Ecology',['GS-III','Prelims'],['climate change','biodiversity','emissions','renewable energy','wildlife','forest','wetland','pollution','conservation','carbon','national park','tiger reserve']],
  ['science-tech','Science & Technology',['GS-III','Prelims'],['isro','space mission','artificial intelligence','quantum','semiconductor','biotechnology','vaccine','cybersecurity','satellite','digital public infrastructure','nuclear energy']],
  ['social-justice','Social Justice',['GS-II','Essay'],['public health','education policy','social justice','women empowerment','child welfare','tribal','disability rights','nutrition','social protection','inclusive growth']],
  ['security','Internal Security',['GS-III','Prelims'],['cyber attack','terrorism','border security','insurgency','internal security','money laundering','human trafficking','coastal security','disaster response']],
  ['ethics','Ethics & Essay',['GS-IV','Essay'],['ethics','integrity','accountability','transparency','conflict of interest','public service values','empathy','corruption','whistleblower']],
  ['history-culture','History & Culture',['GS-I','Prelims'],['archaeology','heritage','unesco world heritage','museum','monument','freedom struggle','ancient india','medieval india','cultural heritage']],
  ['political-theory','Political Theory & Comparative Politics',['PSIR-I'],['political theory','liberalism','marxism','feminism','political ideology','comparative politics','political participation','political parties','electoral system']],
  ['political-thought','Political Thought & Indian Politics',['PSIR-I'],['kautilya','gandhi','ambedkar','nehru','marx','rawls','aristotle','plato','indian political thought','political philosophy']],
  ['world-politics','World Politics & IR Theory',['PSIR-II'],['realism','liberal institutionalism','constructivism','balance of power','international order','multipolar','great power competition','international relations theory']]
];
export function classifyArticle(article) {
  const text = `${article.title ?? ''} ${article.description ?? ''}`.toLowerCase();
  const matched = RULES.filter((r) => r[3].some((term) => text.includes(term)));
  return {
    tags: matched.map((r) => r[0]),
    categories: matched.map((r) => r[1]),
    papers: [...new Set(matched.flatMap((r) => r[2]))],
    relevanceScore: Math.min(100, matched.length * 18 + (/\bindia(n)?\b/i.test(text) ? 10 : 0)),
    matchedRules: matched.map((r) => r[0]),
    reviewStatus: matched.length ? 'rule-matched' : 'needs-review'
  };
}
export function dateBuckets(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day:'', month:'', year:'' };
  return { day:d.toISOString().slice(0,10), month:d.toISOString().slice(0,7), year:d.toISOString().slice(0,4) };
}
