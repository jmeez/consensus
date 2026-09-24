import React, { useState, useMemo, useRef, useEffect } from 'react';
import { askNova, novaHealth } from './lib/nova';
import * as store from './lib/storage';
import { N, genOHLC, DATA, IDX, sma, rsi, SECTORS, SUMMARY, STATE, SOURCES, LIVE,
  applyLiveSI } from './data/universe';

/* ═══════════════════ brand ═══════════════════
   The supplied logo, used as-is. Lifted straight from the artwork file, the
   near-white ground knocked out to transparent and the navy ink flipped to
   white so it reads on the dark ground — the two blues are untouched.
   Full lockup on the splash only; the mark alone in the app. */

const NOVA_FULL = '/brand/nova-full.png';
const NOVA_MARK = '/brand/nova-mark.png';

const C = {
  bg:'#0A0C10', bg2:'#0E1117', card:'#12161D', card2:'#181D26',
  line:'#222833', line2:'#2E3644',
  accent:'#2E97D3', accentL:'#4FB3E8', deep:'#14507F',
  up:'#2EBD85', down:'#F0616D',
  text:'#ECEEF1', muted:'#9BA5B4', dim:'#636E80',
};
const S = { fontFamily:"'Inter', system-ui, sans-serif" };
const SERIF = { fontFamily:"'Newsreader', Georgia, serif" };
const M = { fontFamily:"'IBM Plex Mono', ui-monospace, Menlo, monospace" };

/** Full lockup — splash only. */
const NovaLogo = ({ width = 300 }) => (
  <img src={NOVA_FULL} alt="NOVA" draggable={false}
    style={{ width, height:'auto', display:'block' }} />
);
/** Mark only — in-app, top left and compact surfaces. */
const NovaMark = ({ height = 26 }) => (
  <img src={NOVA_MARK} alt="NOVA" draggable={false}
    style={{ height, width:'auto', display:'block' }} />
);

/* ═══════════════════ skills ═══════════════════ */
const RAILS = `COMPLIANCE RAILS — apply to every output:
- Client-facing text is informational market color only. No investment recommendations, no solicitation language, no price target presented as the desk's own view.
- Attribute every analyst view and price target to the originating broker, with date.
- Timestamp market data. Cite the source for each material data point.
- No silent gaps: if a figure isn't retrievable, say so and name the source attempted. Never fabricate.
- Never re-pitch a name already in the book. If a candidate overlaps existing book exposure, say so explicitly.
- Fundamental SI = (raw SI shares − convert delta hedge) ÷ (float − ETF/passive − insider). That is the honest crowding read; raw SI is not. Cite both.`;

const IDEA_FIELDS = `For each idea give: the expression (instrument, product type, direction); why now (catalyst or dislocation, not evergreen); horizon and what defines the exit; sizing vs 20D ADV with implied participation rate; carry (borrow, roll, or premium) and whether it erodes the trade; positioning check (raw SI, fundamental SI, DTC, borrow bps — crowded or under-owned); what kills it, stated honestly; and residual exposure once legs offset — name the factor, spread, or idio plainly.`;

const BASE_SKILLS = [
  { id:'ig-thematic-ls', cat:'Idea Generation', name:'Thematic L/S',
    when:'A theme is developing and you want both legs of it.', out:'3 pair trades',
    params:[{k:'theme',l:'Theme',ph:'consumer bifurcation under cost pressure'},{k:'horizon',l:'Horizon',ph:'6–12 weeks'}],
    spec:`Generate 3 pair trades expressing {theme} over {horizon}. Each pair is one long leg and one short leg expressing a single coherent view. Cross-product: cash equity, options, swaps (single name, index, custom basket), futures, forwards. Legs need not match product type — justify the structure in one line. Include hedge ratio (beta- or notional-adjusted) so the pair isolates the intended exposure. ${IDEA_FIELDS} Favor early over consensus; screen out crowded expressions and suggest the less-crowded adjacent one.` },
  { id:'ig-macro-ls', cat:'Idea Generation', name:'Macro L/S',
    when:'Policy or rates is the driver, not a sector story.', out:'3 pair trades',
    params:[{k:'theme',l:'Macro driver',ph:'rates repricing two-sided into FOMC'},{k:'horizon',l:'Horizon',ph:'4–8 weeks'}],
    spec:`Generate 3 pair trades expressing {theme} over {horizon}, anchored in policy and cross-asset transmission rather than single-sector fundamentals. Each pair is one long and one short leg. Name the transmission channel explicitly — rates into equity rotation, FX into commodities, credit leading equities. Cross-product; index and futures expressions welcome. ${IDEA_FIELDS}` },
  { id:'ig-thematic-short', cat:'Idea Generation', name:'Thematic Short',
    when:'A theme is breaking down and you want the short side only.', out:'3 short expressions',
    params:[{k:'theme',l:'Theme',ph:'AI capex digestion'},{k:'horizon',l:'Horizon',ph:'1–3 months'}],
    spec:`Generate 3 short expressions of {theme} over {horizon}. Outright shorts, basket shorts, or defined-risk options. For each, lead with the fundamental SI read, not raw — a name that looks crowded on raw SI but is mostly convert-arb hedged is not a crowded short. Flag squeeze risk explicitly where DTC or borrow is elevated. ${IDEA_FIELDS}` },
  { id:'ig-macro-short', cat:'Idea Generation', name:'Macro Short',
    when:'Top-down: policy or cycle argues for downside.', out:'3 short expressions',
    params:[{k:'theme',l:'Macro driver',ph:'real wage recovery stalling'},{k:'horizon',l:'Horizon',ph:'1–3 months'}],
    spec:`Generate 3 short expressions driven by {theme} over {horizon}. Top-down: index, sector ETF, futures, or custom basket preferred over single names unless a name is the cleanest transmission. Name the policy or cycle channel. Include CFTC positioning and published fund flows where relevant, with vintage. Flag squeeze risk. ${IDEA_FIELDS}` },
  { id:'ig-name-short', cat:'Idea Generation', name:'Single Name Short',
    when:'You have one name in mind and need the full short work-up.', out:'Full short case',
    params:[{k:'ticker',l:'Ticker',ph:'CVNA'},{k:'horizon',l:'Horizon',ph:'into next print'}],
    spec:`Build the full short case on {ticker}, horizon {horizon}. Cover: the thesis in 3 bullets; what has moved it over the last month and whether that was idiosyncratic, sector, or factor; the active debate; the crowding read — raw SI vs fundamental SI with the full bridge (float less ETF/passive less insider; raw SI less convert delta), DTC, borrow bps, squeeze risk; the next scheduled catalyst; the strongest bull argument and why it's wrong; and the cleanest expression (outright, put structure, or pair) with sizing vs 20D ADV.` },
  { id:'ig-thematic-long', cat:'Idea Generation', name:'Thematic Long',
    when:'A theme is inflecting and you want the long side only.', out:'3 long expressions',
    params:[{k:'theme',l:'Theme',ph:'grid capex / power demand'},{k:'horizon',l:'Horizon',ph:'3–6 months'}],
    spec:`Generate 3 long expressions of {theme} over {horizon}. For each, state whether the name is under-owned or already consensus — cite fundamental SI, ETF/passive share of float, and any observable flow data with vintage. A long that is already crowded long is as much a problem as a crowded short; say so. ${IDEA_FIELDS}` },
  { id:'ig-thematic-factor', cat:'Idea Generation', name:'Thematic Factor',
    when:'You want a theme expressed as clean factor exposure.', out:'Factor expression + hedge',
    params:[{k:'theme',l:'Theme',ph:'quality over momentum'},{k:'horizon',l:'Horizon',ph:'4–8 weeks'}],
    spec:`Express {theme} as a factor trade over {horizon}. Name the factor(s) targeted from value / growth / momentum / quality / low-vol / size / yield. Read the current factor scorecard and rotation grid in state before recommending — if the factor has already run, say so. Give the expression (custom basket swap, factor ETF, index futures overlay), the hedge that isolates the factor from beta and sector drift, the crowding read on the factor itself, what kills it, and the residual exposure that survives the hedge.` },
  { id:'ig-macro-factor', cat:'Idea Generation', name:'Macro Factor',
    when:'Rates or policy is driving the factor rotation.', out:'Factor expression + hedge',
    params:[{k:'theme',l:'Macro driver',ph:'front-end repricing'},{k:'horizon',l:'Horizon',ph:'4–8 weeks'}],
    spec:`Express {theme} as a factor rotation trade over {horizon}. Anchor in the policy channel — duration sensitivity, discount-rate effect on long-duration growth, credit transmission. Name the factor(s), the expression, the hedge that isolates the factor, the crowding read, what kills it, and the residual exposure. Read the current factor scorecard and rotation grid before recommending.` },
  { id:'d-inquiry', cat:'Distribution', name:'Client Inquiry',
    when:'Client asked about a name and you have five minutes.', out:'Chat + email + desk brief',
    params:[{k:'ticker',l:'Instrument(s)',ph:'HOOD, CSCO'},{k:'client',l:'Client (optional)',ph:'Graham Capital'}],
    spec:`Produce a rapid, client-ready prep pack on {ticker} for {client}. Ground everything in real data — no evergreen description. Default to equities; adapt substance if the input is FX, rates/credit, or commodities, keeping the output formats identical.
Where a move is material, note the likely driver — instrument-specific vs sector, style, or macro. Brief and practical: enough to answer "why is it moving."
ALWAYS produce all three:
1. BLOOMBERG CHAT — ultra-concise, casual desk tone. Per instrument: current thesis, the single biggest driver right now, one actionable hook. No greeting, no sign-off.
2. CLIENT EMAIL — complete and ready to send: subject line, brief greeting, 3–4 tight paragraphs or bullets, professional sign-off. Multiple instruments become one consolidated themed note led by the most material name. Compose the actual draft, not a description of one.
3. INTERNAL DESK BRIEF — per instrument: thesis in 3 bullets; what moved it over the last month; the key debate now; most recent sell-side rating/PT changes with broker and date; next scheduled catalyst; one non-obvious talking point to lead with.
Equities require both: most recent rating/PT change with broker and date, and the crowding read (raw SI, fundamental SI, DTC, borrow). If unavailable, say so and name the source attempted.` },
  { id:'d-reverse', cat:'Distribution', name:'Client Reverse Inquiry',
    when:'Client came to you with an axe — capture and work it.', out:'Response + internal log + cross',
    params:[{k:'inquiry',l:'The inquiry',ph:'looking to add downside protection in semis'},{k:'client',l:'Client',ph:'BlackRock'}],
    spec:`{client} has come inbound with: {inquiry}. Produce:
1. CAPTURE — restate the axe precisely: instrument or theme, direction, approximate size if stated, structure preference, and urgency. Flag anything ambiguous that needs to be asked back before the desk works it.
2. RESPONSE CHAT — Bloomberg-tone reply: what the desk can show, the relevant market color, and the one clarifying question. Informational only.
3. INTERNAL LOG — what this implies about the client's positioning and where it fits the desk's current axes.
4. SUGGESTED CROSS — who else in the book is on the other side, and the natural cross. If nobody is, say so.
Screen the implied trade against current desk positioning and flag overlap or conflict.` },
  { id:'t-morning', cat:'Team', name:'Morning Email',
    when:'Pre-open. Runs on schedule; this is the manual trigger.', out:'Roster-routed brief + blast',
    params:[{k:'roster',l:'Desk roster',ph:'Luke — Energy — Graham Capital, BlackRock'}],
    spec:`Produce a pre-open brief for a Sales & Trading desk head covering equities, rates/credit, FX, and commodities. Three-minute read. Lead with the desk layer, market detail below.
Roster: {roster}
1. CHECK-INS, PRE-OPEN — for each desk member, only where something material touches their coverage or accounts: what moved, why it matters to them, what to ask or tell them before the bell. Name the instrument and the account. Skip anyone with nothing material — do not manufacture items to fill the roster. Then flag coverage gaps and overlaps.
2. INTERNAL LAYER — label clearly, populate nothing. Describe what connecting client notes, chats, and trade tickets would add, and note it requires integration.
3. WHAT MOVED — material overnight and pre-market moves, magnitude and why. Separate idiosyncratic from broad-based.
4. FLOWS & POSITIONING — ETF and fund flows, sector/factor rotation, unusual volume, options activity, futures positioning, short interest.
5. THEMES & CROSS-ASSET LINKAGES — 2–3 themes building, early over consensus, with the transmission channel named.
6. WHAT'S AHEAD — catalysts in the next 1–5 sessions, ranked by likelihood of moving the book.
Then a MORNING BLAST in the desk head's voice — 3 bullets, informational color only, ready to red-line and send.
Bullets not prose. Senior audience — skip basics.` },
];
const CATS = ['All','Idea Generation','Distribution','Team'];
const SKILL_CATS = ['Idea Generation','Distribution','Team'];

/* ═══════════════════ primitives ═══════════════════ */
const Card = ({ children, pad = 18, style = {} }) => (
  <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:12, padding:pad, ...style }}>
    {children}</div>
);
const Num = ({ v, suf = '%', dp = 2, size = 13 }) => (
  <span style={{ ...M, fontSize:size, color: v > 0 ? C.up : v < 0 ? C.down : C.text }}>
    {v > 0 ? '+' : ''}{v.toFixed(dp)}{suf}</span>
);
const Toggle = ({ on, set }) => (
  <button onClick={e => { e.stopPropagation(); set(!on); }} style={{ width:38, height:22, borderRadius:11,
    border:'none', cursor:'pointer', background: on ? C.accent : C.line2, position:'relative',
    transition:'background .15s', flexShrink:0 }}>
    <span style={{ position:'absolute', top:3, left: on ? 19 : 3, width:16, height:16, borderRadius:8,
      background:'#fff', transition:'left .15s' }} />
  </button>
);
const AreaSpark = ({ bars, up, w = 220, h = 54 }) => {
  const b = bars.slice(-50), lo = Math.min(...b.map(x => x.c)), hi = Math.max(...b.map(x => x.c));
  const pts = b.map((x, i) => [(i / (b.length - 1)) * w, h - 6 - ((x.c - lo) / ((hi - lo) || 1)) * (h - 12)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const col = up ? C.up : C.down, id = `sp${up ? 'u' : 'd'}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={col} stopOpacity=".25" /><stop offset="100%" stopColor={col} stopOpacity="0" />
      </linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={col} strokeWidth="1.5" />
    </svg>
  );
};
const Spark = ({ bars, col, w = 56, h = 18 }) => {
  const b = bars.slice(-30), lo = Math.min(...b.map(x => x.c)), hi = Math.max(...b.map(x => x.c));
  const d = b.map((x, i) => `${i ? 'L' : 'M'}${(i / (b.length - 1)) * w},${h - ((x.c - lo) / ((hi - lo) || 1)) * h}`).join(' ');
  return <svg width={w} height={h}><path d={d} fill="none" stroke={col} strokeWidth="1.2" /></svg>;
};

const CSS = `
@keyframes novaIn { from { opacity:0; transform: translateY(10px) scale(.985); } to { opacity:1; transform:none; } }
@keyframes novaLogoIn { from { opacity:0; transform: scale(.94); } to { opacity:1; transform:none; } }
.nova-logo-beat { animation: novaLogoIn .72s cubic-bezier(.2,.7,.3,1) both; }
.nova-logo-tag { animation: novaIn .5s ease both .38s; }
@keyframes nvDraw { to { stroke-dashoffset:0 } }
@keyframes nvFade { to { opacity:1 } }
@keyframes nvRule { to { width:120px } }
.nova-stage { animation: novaIn .45s ease both; }

.nova-chip { background:${C.card}; border:1px solid ${C.line}; border-radius:999px; color:${C.muted};
  padding:8px 15px; font-size:13px; font-family:inherit; cursor:pointer; transition:border-color .15s,color .15s; }
.nova-chip:hover { border-color:${C.line2}; color:${C.text}; }
.nova-chip.on { border-color:${C.accent}; color:${C.accentL}; background:${C.accent}1f; }
.nova-otherin { background:${C.card}; border:1px dashed ${C.line2}; border-radius:999px; color:${C.text};
  padding:8px 15px; font-size:13px; font-family:inherit; width:112px; outline:none; transition:width .18s; }
.nova-otherin:focus { border-color:${C.accent}; width:172px; }
.nova-field { background:${C.card}; border:1px solid ${C.line}; border-radius:9px; color:${C.text};
  padding:11px 13px; font-size:13.5px; font-family:inherit; outline:none; width:100%; }
.nova-field:focus { border-color:${C.accent}; }
.nova-tab { background:none; border:0; cursor:pointer; color:${C.dim}; font-weight:600;
  font-size:11.5px; letter-spacing:.06em; padding:6px 10px; border-radius:6px; font-family:inherit; }
.nova-tab.on { color:${C.text}; background:${C.card}; }

@media (prefers-reduced-motion: reduce) {
  .nova-stage { animation:none; }
  .film .scene.on .fpx { transition:none; opacity:1; transform:none; }
  .film .scene.on .fbrk .blab { animation:none; opacity:1; }
  .film .scene.on svg .dash { animation:none; opacity:1; }
  .film .scene.on .frule { animation:none; width:120px; }
  .film .faxis .adot { transition:none; opacity:1; }
}
`;

/* ═══════════════════ first run ═══════════════════ */
const DIAL_CODES = ['+1','+44','+61','+49','+33','+34','+39','+31','+52','+55','+81','+82','+91','+86','+971'];
function fmtLocal(dial, raw) {
  const d = raw.replace(/\D/g, '').slice(0, dial === '+1' ? 10 : 14);
  if (dial === '+1') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  }
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}
function PhoneField({ onChange }) {
  const [dial, setDial] = useState('+1');
  const [local, setLocal] = useState('');
  const setBoth = (d, raw) => { const v = fmtLocal(d, raw); setLocal(v); onChange(v.trim() ? `${d} ${v.trim()}` : ''); };
  return (
    <div style={{ display:'flex', gap:8 }}>
      <select value={dial} aria-label="Country code" className="nova-field"
        onChange={e => { setDial(e.target.value); setBoth(e.target.value, local); }}
        style={{ width:78, flexShrink:0, cursor:'pointer' }}>
        {DIAL_CODES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className="nova-field" placeholder="Phone (optional)" type="tel" inputMode="tel"
        value={local} onChange={e => setBoth(dial, e.target.value)} />
    </div>
  );
}

const OB_SKILL_BY_CAT = SKILL_CATS.reduce((a, c) => {
  a[c] = BASE_SKILLS.filter(s => s.cat === c).map(s => s.name); return a;
}, {});
const ALL_SKILL_NAMES = new Set(BASE_SKILLS.map(s => s.name));

const OB_SLIDES = [
  { key:'seat', q:"What's your seat on the desk?",
    opts:['Analyst','Associate','VP / Trader','Portfolio Manager','Desk Head','Strategist','Risk'] },
  { key:'mandate', q:'What mandate do you run?',
    opts:['Long / Short Equity','Short-biased','Market Neutral','Macro','Event-driven','Multi-strategy','Sector specialist'] },
  { key:'sectors', q:'What do you cover?', opts:[...SECTORS,'Cross-sector','Small cap','Large cap'] },
  { key:'signals', q:'Which signals do you lead with?',
    opts:['Fundamental SI','Convert overhang','Days to cover','Borrow cost','Squeeze risk','Factor rotation',
          'Sector rotation','ETF flows','Options skew','Catalyst calendar','Insider activity','Short interest trend'] },
  { key:'skills', q:'Which skills should Nova put up front?', opts:null },
  { key:'stack', q:'What do you use today?',
    opts:['Bloomberg','FactSet','Refinitiv','Ortex','S3 Partners','Excel','Slack','Outlook','Teams','Python','Tableau'] },
];

function FirstRun({ onDone }) {
  const [stage, setStage] = useState('logo');
  const [mode, setMode] = useState('register');
  const [f, setF] = useState({ email:'', name:'', firm:'', phone:'', password:'' });
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (stage !== 'logo') return;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    const t = setTimeout(() => setStage('account'), reduce ? 250 : 1600);
    return () => clearTimeout(t);
  }, [stage]);

  const submit = () => {
    if (busy) return;
    setErr(''); setNote('');
    if (mode === 'register') {
      if (!/\S+@\S+\.\S+/.test(f.email)) { setErr('Enter a valid work email.'); return; }
      if (!f.name.trim()) { setErr('Enter your name.'); return; }
    }
    if (!f.password || f.password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const u = { name:f.name || 'Desk user', email:f.email, firm:f.firm };
      if (mode === 'login') { onDone(u, null); return; }
      setUser(u); setStage('slides');
    }, 420);
  };
  const doForgot = () => {
    if (!/\S+@\S+\.\S+/.test(f.email)) { setErr('Type your account email above, then tap Forgot password.'); return; }
    setErr(''); setNote('If that email has an account, a reset link is on its way.');
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:995, background:C.bg, color:C.text, ...S,
      display:'flex', alignItems:'center', justifyContent:'center', overflowY:'auto' }}>
      {stage === 'logo' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <div className="nova-logo-beat"><NovaLogo width={300} /></div>
          <div className="nova-logo-tag" style={{ fontSize:13.5, color:C.dim,
            letterSpacing:'.02em' }}>Crowding, corrected.</div>
        </div>
      )}

      {stage === 'account' && (
        <div className="nova-stage" style={{ width:'min(560px,92%)', padding:'40px 0' }}>
          <div style={{ marginBottom:26 }}><NovaMark height={58} /></div>
          <h1 style={{ ...SERIF, fontSize:30, fontWeight:500, margin:'0 0 10px', letterSpacing:-.4 }}>
            {mode === 'login' ? 'Welcome back.' : 'Make the desk yours.'}
          </h1>
          <div style={{ fontSize:14, color:C.muted, lineHeight:1.6, maxWidth:440 }}>
            {mode === 'login'
              ? 'Sign in — your book, your skills, and Nova are waiting.'
              : 'Fundamental short interest, eleven desk skills, and Nova\u2019s read on your book — one platform, every seat.'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:9, maxWidth:360, margin:'20px 0 14px' }}>
            <input className="nova-field" placeholder="Work email" type="email"
              autoComplete={mode === 'login' ? 'username' : 'email'}
              value={f.email} onChange={e => setF(x => ({ ...x, email:e.target.value }))} />
            {mode === 'register' && (<>
              <input className="nova-field" placeholder="Name" autoComplete="name"
                value={f.name} onChange={e => setF(x => ({ ...x, name:e.target.value }))} />
              <input className="nova-field" placeholder="Firm" autoComplete="organization"
                value={f.firm} onChange={e => setF(x => ({ ...x, firm:e.target.value }))} />
              <PhoneField onChange={v => setF(x => ({ ...x, phone:v }))} />
            </>)}
            <input className="nova-field" placeholder="Password" type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={f.password} onChange={e => setF(x => ({ ...x, password:e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </div>
          {err && <div style={{ color:C.down, fontSize:12.5, margin:'-6px 0 10px' }}>{err}</div>}
          {note && <div style={{ color:C.up, fontSize:12.5, margin:'-6px 0 10px' }}>{note}</div>}
          {mode === 'login' && (
            <button onClick={doForgot} style={{ ...S, display:'block', background:'none', border:0,
              color:C.dim, fontSize:12.5, cursor:'pointer', marginBottom:12, padding:0 }}>
              Forgot password?</button>
          )}
          <div>
            <button onClick={submit} disabled={busy} style={{ ...S, padding:'11px 20px', borderRadius:9,
              background:C.accent, color:'#FFFFFF', fontSize:13.5, fontWeight:600, border:0,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? .55 : 1 }}>
              {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setNote(''); }}
              style={{ ...S, background:'none', border:0, color:C.dim, fontSize:12.5, cursor:'pointer',
                marginLeft:14 }}>
              {mode === 'login' ? 'Create an account instead' : 'Sign in instead'}
            </button>
          </div>
        </div>
      )}

      {stage === 'slides' && (
        <div className="nova-stage" style={{ width:'min(560px,92%)', padding:'40px 0' }}>
          <OnboardSlides user={user} onFinish={(u, p) => onDone(u, p)} />
        </div>
      )}
    </div>
  );
}

function OnboardSlides({ user, onFinish }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draft, setDraft] = useState('');
  const [catTab, setCatTab] = useState(null);

  const slide = OB_SLIDES[step];
  const isSkills = slide.key === 'skills';
  const activeCat = isSkills ? (SKILL_CATS.includes(catTab) ? catTab : SKILL_CATS[0]) : null;
  const opts = slide.opts || OB_SKILL_BY_CAT[activeCat] || [];
  const picked = new Set(answers[slide.key] || []);
  const custom = (answers[slide.key] || []).filter(v =>
    isSkills ? !ALL_SKILL_NAMES.has(v) : !opts.includes(v));

  useEffect(() => {
    if (!isSkills || answers.skills) return;
    const m = answers.mandate || [], seat = answers.seat || [];
    const s = new Set();
    if (m.includes('Short-biased')) ['Thematic Short','Macro Short','Single Name Short'].forEach(x => s.add(x));
    if (m.includes('Long / Short Equity')) ['Thematic L/S','Macro L/S','Single Name Short'].forEach(x => s.add(x));
    if (m.includes('Market Neutral')) ['Thematic Factor','Macro Factor','Thematic L/S'].forEach(x => s.add(x));
    if (m.includes('Macro')) ['Macro L/S','Macro Short','Macro Factor'].forEach(x => s.add(x));
    if (seat.some(x => ['VP / Trader','Portfolio Manager','Desk Head'].includes(x)))
      ['Client Inquiry','Client Reverse Inquiry'].forEach(x => s.add(x));
    if (seat.includes('Desk Head')) s.add('Morning Email');
    if (seat.includes('Analyst')) s.add('Single Name Short');
    if (s.size) setAnswers(p => ({ ...p, skills:[...s] }));
  }, [isSkills]);

  const toggle = opt => setAnswers(prev => {
    const cur = new Set(prev[slide.key] || []);
    cur.has(opt) ? cur.delete(opt) : cur.add(opt);
    return { ...prev, [slide.key]:[...cur] };
  });
  const addOther = () => {
    const v = draft.trim().slice(0, 48);
    if (!v) return;
    setAnswers(prev => { const cur = new Set(prev[slide.key] || []); cur.add(v);
      return { ...prev, [slide.key]:[...cur] }; });
    setDraft('');
  };
  const finish = final => onFinish(user,
    Object.fromEntries(Object.entries(final).filter(([, v]) => v && v.length)));
  const next = () => { setDraft(''); step < OB_SLIDES.length - 1 ? setStep(step + 1) : finish(answers); };

  return (
    <>
      <div style={{ fontSize:11.5, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase',
        color:C.accentL, marginBottom:10 }}>
        Make it yours{user?.name ? `, ${String(user.name).split(' ')[0]}` : ''}
      </div>
      <h1 style={{ ...SERIF, fontSize:30, fontWeight:500, margin:'0 0 10px', letterSpacing:-.4 }}>{slide.q}</h1>
      <div style={{ fontSize:14, color:C.muted, lineHeight:1.6, maxWidth:440 }}>
        Pick any that fit — this tunes your workspace and what Nova surfaces for you.
      </div>

      {isSkills && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', margin:'16px 0 0' }} role="tablist">
          {SKILL_CATS.map(c => {
            const n = (answers.skills || []).filter(x => (OB_SKILL_BY_CAT[c] || []).includes(x)).length;
            return (
              <button key={c} role="tab" aria-selected={c === activeCat}
                className={'nova-tab' + (c === activeCat ? ' on' : '')}
                onClick={() => setCatTab(c)}>{c}{n ? ` · ${n}` : ''}</button>
            );
          })}
        </div>
      )}

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, margin:'18px 0 6px', maxWidth:460 }}>
        {opts.map(opt => (
          <button key={opt} className={'nova-chip' + (picked.has(opt) ? ' on' : '')}
            aria-pressed={picked.has(opt)} onClick={() => toggle(opt)}>{opt}</button>
        ))}
        {custom.map(opt => (
          <button key={opt} className="nova-chip on" aria-pressed="true"
            onClick={() => toggle(opt)}>{opt} ×</button>
        ))}
        <span style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
          <input className="nova-otherin" placeholder="Other…" value={draft} maxLength={48}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }} />
          {draft.trim() && <button className="nova-chip" onClick={addOther}>+ Add</button>}
        </span>
      </div>

      <div style={{ display:'flex', gap:6, margin:'16px 0 18px' }} aria-hidden="true">
        {OB_SLIDES.map((s, i) => (
          <span key={s.key} style={{ width:6, height:6, borderRadius:3,
            background: i === step ? C.accent : C.line2 }} />
        ))}
      </div>

      <div>
        <button onClick={next} style={{ ...S, padding:'11px 20px', borderRadius:9, background:C.accent,
          color:'#FFFFFF', fontSize:13.5, fontWeight:600, border:0, cursor:'pointer' }}>
          {step < OB_SLIDES.length - 1 ? (picked.size ? 'Next' : 'Skip') : 'Done — enter Nova'}
        </button>
        <button onClick={() => finish(answers)} style={{ ...S, background:'none', border:0, color:C.dim,
          fontSize:12.5, cursor:'pointer', marginLeft:14 }}>Skip the rest</button>
      </div>
    </>
  );
}

/* ═══════════════════ chat ═══════════════════ */
const OPENERS = [
  'Where does fundamental SI diverge most from reported?',
  'What in the screen overlaps my current book?',
  'Which shorts have real squeeze risk vs convert-arb noise?',
];

function Chat({ pending, clearPending, go, openSkills, chatKey, prefs, initial, onSave }) {
  const [msgs, setMsgs] = useState(initial || []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const end = useRef(null);
  useEffect(() => { setMsgs(initial || []); setErr(null); }, [chatKey]);
  useEffect(() => { if (msgs.length) onSave?.(msgs); }, [msgs]);
  useEffect(() => { end.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs, busy]);

  const seatLine = prefs?.seat?.length
    ? `The person asking sits as ${prefs.seat.join('/')} running a ${(prefs.mandate || ['L/S']).join('/')} mandate covering ${(prefs.sectors || ['all sectors']).join(', ')}. They lead with ${(prefs.signals || ['fundamental SI']).join(', ')}. Pitch at that level — assume fluency, skip basics.`
    : '';

  const run = async (text, sys, label) => {
    if (!text?.trim() || busy) return;
    const next = [...msgs, { role:'user', content:text, label }];
    setMsgs(next); setQ(''); setBusy(true); setErr(null);
    try {
      const out = await askNova({
        followups:true, maxTokens:1000,
        system:`${sys || `You are Nova, the analyst inside a public markets platform. Answer only from the STATE JSON.
Voice: direct, terse, declarative. Short sentences. No hedging, no filler, no preamble. Lead with the call. Max 160 words.`}

${seatLine}

${RAILS}

Plain text only — no markdown headers, no bold syntax. Use short labelled lines.
End your reply with one final line exactly: FOLLOWUPS: question one | question two | question three
STATE: ${STATE()}`,
        messages: next.map(m => ({ role:m.role, content:m.content })),
      });
      let txt = out.text;
      if (!txt) throw new Error('empty');
      let fu = [];
      const mm = txt.match(/FOLLOWUPS:\s*(.+)$/m);
      if (mm) { fu = mm[1].split('|').map(s => s.trim()).filter(Boolean).slice(0, 3); txt = txt.replace(/FOLLOWUPS:.*$/m, '').trim(); }
      setMsgs(x => [...x, { role:'assistant', content:txt, fu, label, source:out.source }]);
    } catch { setErr('Model call failed. Retry, or check the connection.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (pending) { run(pending.prompt, pending.sys, pending.label); clearPending(); } }, [pending]);
  const tickersIn = txt => DATA.filter(d => new RegExp(`\\b${d.t}\\b`).test(txt)).slice(0, 4);

  return (
    <div style={{ maxWidth:780, margin:'0 auto', paddingBottom:110 }}>
      {msgs.length === 0 && !busy && (
        <div style={{ paddingTop:'7vh' }}>
          <h2 style={{ ...SERIF, fontSize:30, fontWeight:500, margin:'0 0 8px' }}>Ask Nova</h2>
          <p style={{ fontSize:13.5, color:C.muted, marginBottom:22 }}>
            Grounded in the book, the screen, and corrected crowding data.</p>
          <div style={{ display:'grid', gap:8 }}>
            {OPENERS.map(o => (
              <button key={o} onClick={() => run(o)} style={{ ...S, fontSize:13.5, textAlign:'left',
                padding:'13px 16px', borderRadius:10, background:C.card, border:`1px solid ${C.line}`,
                color:C.muted, cursor:'pointer' }}>{o}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:'grid', gap:28, paddingTop:8 }}>
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i}>
            {m.label && <div style={{ fontSize:11, color:C.accentL, fontWeight:600, marginBottom:6 }}>
              Skill · {m.label}</div>}
            <div style={{ ...SERIF, fontSize:21, lineHeight:1.4 }}>{m.content}</div>
          </div>
        ) : (
          <div key={i}>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
              {SOURCES.map(s => (
                <span key={s.n} style={{ fontSize:11, padding:'5px 10px', borderRadius:14,
                  background:C.card, border:`1px solid ${C.line}`, color:C.dim }}>{s.n} · {s.d}</span>
              ))}
              {m.source === 'mock' && (
                <span style={{ fontSize:11, padding:'5px 10px', borderRadius:14,
                  background:`${C.accent}14`, border:`1px solid ${C.accent}55`,
                  color:C.accentL }}>offline mock</span>
              )}
            </div>
            <div style={{ fontSize:14.5, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{m.content}</div>
            {tickersIn(m.content).length > 0 && (
              <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginTop:16 }}>
                {tickersIn(m.content).map(d => (
                  <button key={d.t} onClick={() => go(d.t)} style={{ display:'flex', alignItems:'center',
                    gap:12, padding:'10px 13px', borderRadius:10, background:C.card,
                    border:`1px solid ${C.line}`, cursor:'pointer' }}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ ...M, fontSize:12, color:C.text }}>{d.t}</div>
                      <div style={{ ...S, fontSize:10, color:C.dim }}>SI {d.siFund.toFixed(1)}%</div>
                    </div>
                    <Spark bars={d.bars} col={d.chg >= 0 ? C.up : C.down} />
                    <div style={{ textAlign:'right' }}>
                      <div style={{ ...M, fontSize:11.5 }}>{d.last.toFixed(2)}</div>
                      <Num v={d.chg} dp={1} size={10} />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {m.fu?.length > 0 && (
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:11, color:C.dim, fontWeight:600, textTransform:'uppercase',
                  letterSpacing:1, marginBottom:4 }}>Related</div>
                {m.fu.map(x => (
                  <button key={x} onClick={() => run(x)} style={{ display:'flex',
                    justifyContent:'space-between', width:'100%', gap:10, padding:'11px 2px',
                    background:'transparent', border:'none', borderBottom:`1px solid ${C.line}`,
                    cursor:'pointer', textAlign:'left' }}>
                    <span style={{ ...S, fontSize:13.5, color:C.muted }}>{x}</span>
                    <span style={{ fontSize:14, color:C.accentL }}>+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ fontSize:12.5, color:C.accentL }}>Reading desk state…</div>}
        {err && <div style={{ fontSize:12.5, color:C.down }}>{err}</div>}
        <div ref={end} />
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'10px 16px 18px',
        background:`linear-gradient(180deg, transparent, ${C.bg} 40%)`, pointerEvents:'none' }}>
        <div style={{ maxWidth:780, margin:'0 auto', pointerEvents:'auto' }}>
          <Composer q={q} setQ={setQ} onSend={t => run(t)} busy={busy} openSkills={openSkills}
            placeholder="Ask a follow-up…" />
        </div>
      </div>
    </div>
  );
}

function ModelTag() {
  const [label, setLabel] = useState('');
  useEffect(() => { novaHealth().then(h => setLabel(h.live ? h.model : 'offline mock')); }, []);
  return <span style={{ fontSize:11, color:C.dim, padding:'0 4px', whiteSpace:'nowrap' }}>{label}</span>;
}

const Composer = ({ q, setQ, onSend, busy, openSkills, placeholder }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, background:C.card,
    border:`1px solid ${C.line2}`, borderRadius:14, padding:'7px 7px 7px 8px',
    boxShadow:'0 8px 30px rgba(0,0,0,.4)' }}>
    <button onClick={openSkills} title="Skills" style={{ width:34, height:34, borderRadius:9,
      background:'transparent', border:`1px solid ${C.line}`, color:C.muted, cursor:'pointer',
      fontSize:16, lineHeight:'32px' }}>+</button>
    <input value={q} onChange={e => setQ(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSend(q)}
      placeholder={placeholder || 'Ask Nova anything about the desk…'}
      style={{ ...S, fontSize:14, flex:1, padding:'8px 4px', background:'transparent', border:'none',
        color:C.text, outline:'none' }} />
    <ModelTag />
    <button onClick={() => onSend(q)} disabled={busy} style={{ width:36, height:36, borderRadius:10,
      background:C.accent, border:'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ display:'block', margin:'0 auto' }}>
        <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="#FFFFFF" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </div>
);

/* ═══════════════════ home ═══════════════════ */
function Home({ ask, openSkills, go, narrow, user, prefs }) {
  const [q, setQ] = useState('');
  const [ex, setEx] = useState(0);
  const book = DATA.filter(d => d.pos);
  const first = (user?.name || '').split(' ')[0];
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ paddingBottom:110 }}>
      <div style={{ display:'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 300px', gap:24 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ marginBottom:18 }}>
            <h2 style={{ ...SERIF, fontSize:26, fontWeight:500, margin:'0 0 4px' }}>
              {greet}{first ? `, ${first}` : ''}</h2>
            <span style={{ fontSize:12.5, color:C.dim }}>
              After-hours · Aug 22, 2026
              {prefs?.sectors?.length ? ` · covering ${prefs.sectors.join(', ')}` : ''} · mock
            </span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12 }}>
            {IDX.map(x => (
              <Card key={x.t} pad={0} style={{ overflow:'hidden' }}>
                <div style={{ padding:'13px 14px 4px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                    <span style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap' }}>{x.t}</span>
                    <Num v={x.chg} dp={2} size={11.5} />
                  </div>
                  <div style={{ ...M, fontSize:17, marginTop:3 }}>{x.v}</div>
                </div>
                <AreaSpark bars={x.bars} up={x.chg >= 0} />
              </Card>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
            margin:'26px 0 12px' }}>
            <h3 style={{ ...SERIF, fontSize:19, fontWeight:500, margin:0 }}>Desk summary</h3>
            <span style={{ fontSize:11.5, color:C.dim }}>Updated this session</span>
          </div>
          <Card pad={0}>
            {SUMMARY.map((it, i) => (
              <div key={i} style={{ borderBottom: i < SUMMARY.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                <button onClick={() => setEx(ex === i ? -1 : i)} style={{ display:'flex', width:'100%',
                  justifyContent:'space-between', alignItems:'center', gap:12, padding:'15px 18px',
                  background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ ...S, fontSize:14.5, fontWeight:500, color:C.text }}>{it.h}</span>
                  <span style={{ fontSize:12, color:C.dim, transform: ex === i ? 'rotate(180deg)' : 'none',
                    transition:'transform .15s' }}>▾</span>
                </button>
                {ex === i && (
                  <div style={{ padding:'0 18px 16px', fontSize:13.5, color:C.muted, lineHeight:1.68 }}>
                    {it.b}</div>
                )}
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display:'grid', gap:16, alignContent:'start' }}>
          <Card pad={16}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Book</div>
            <div style={{ display:'grid', gap:4 }}>
              {book.map(b => (
                <button key={b.t} onClick={() => go(b.t)} style={{ display:'flex', alignItems:'center',
                  gap:10, padding:'8px 6px', borderRadius:9, background:'transparent', border:'none',
                  cursor:'pointer', textAlign:'left' }}>
                  <div style={{ width:30, height:30, borderRadius:15, background:C.card2,
                    border:`1px solid ${C.line}`, display:'flex', alignItems:'center',
                    justifyContent:'center', ...M, fontSize:10.5,
                    color: b.pos === 'LONG' ? C.up : C.down }}>{b.t.slice(0, 2)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ ...M, fontSize:12 }}>{b.t}
                      <span style={{ ...S, fontSize:9.5, color: b.pos === 'LONG' ? C.up : C.down,
                        marginLeft:6 }}>{b.pos === 'LONG' ? '▲ Long' : '▼ Short'}</span></div>
                    <div style={{ ...S, fontSize:10.5, color:C.dim }}>SI {b.siFund.toFixed(1)}% · {b.cat}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ ...M, fontSize:12 }}>{b.last.toFixed(2)}</div>
                    <Num v={b.chg} dp={2} size={10} />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card pad={16}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Connect your data</div>
            {[['StreetSpread', 'Attention & demand signals', 'Pending compliance'],
              ['Ortex / S3', 'Daily SI estimates', 'Not connected'],
              ['Convert feed', 'Delta-accurate hedge netting', 'Filings-approx']].map(([n, d, st]) => (
              <div key={n} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0', borderBottom:`1px solid ${C.line}` }}>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:500 }}>{n}</div>
                  <div style={{ fontSize:10.5, color:C.dim }}>{d}</div>
                </div>
                <span style={{ fontSize:10, color:C.dim, border:`1px solid ${C.line}`, borderRadius:10,
                  padding:'3px 8px', whiteSpace:'nowrap' }}>{st}</span>
              </div>
            ))}
            <div style={{ fontSize:11, color:C.dim, marginTop:10, lineHeight:1.5 }}>
              Vendor and compliance sign-off required before external feeds touch desk content.
            </div>
          </Card>
        </div>
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'10px 16px 18px',
        background:`linear-gradient(180deg, transparent, ${C.bg} 40%)`, pointerEvents:'none' }}>
        <div style={{ maxWidth:780, margin:'0 auto', pointerEvents:'auto' }}>
          <Composer q={q} setQ={setQ} onSend={t => { if (t.trim()) ask(t); }} busy={false}
            openSkills={openSkills} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ skills ═══════════════════ */
function SkillsPage({ skills, setSkills, fire }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [vals, setVals] = useState({});
  const [create, setCreate] = useState(false);
  const [nu, setNu] = useState({ name:'', cat:'Idea Generation', when:'', spec:'', extra:'' });

  const hits = skills.filter(s => (cat === 'All' || s.cat === cat) &&
    (!q || (s.name + s.when + s.cat).toLowerCase().includes(q.toLowerCase())));
  const toggle = (id, on) => setSkills(ss => ss.map(s => s.id === id ? { ...s, enabled:on } : s));

  const use = () => {
    let spec = sel.spec;
    sel.params.forEach(p => { spec = spec.replaceAll(`{${p.k}}`, vals[p.k] || p.ph || p.l); });
    const summary = sel.params.map(p => `${p.l}: ${vals[p.k] || p.ph || '—'}`).join(' · ');
    fire({ prompt:`Run ${sel.name}. ${summary}`, sys:spec, label:sel.name });
  };
  const save = () => {
    if (!nu.name.trim() || !nu.spec.trim()) return;
    const keys = [...new Set([...nu.spec.matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
    setSkills(ss => [...ss, { id:`custom-${Date.now()}`, cat:nu.cat, name:nu.name,
      when:nu.when || 'Custom skill.', out:'Custom output', enabled:true,
      params: keys.map(k => ({ k, l:k.charAt(0).toUpperCase() + k.slice(1), ph:'' })),
      spec: nu.spec + (nu.extra ? `\n\nADDITIONAL INSTRUCTIONS:\n${nu.extra}` : '') }]);
    setCreate(false); setNu({ name:'', cat:'Idea Generation', when:'', spec:'', extra:'' });
  };
  const renderSpec = spec => spec.split(/(\{\w+\})/g).map((part, i) => {
    const mm = part.match(/^\{(\w+)\}$/);
    if (!mm) return <span key={i}>{part}</span>;
    const p = sel.params.find(x => x.k === mm[1]);
    return <span key={i} style={{ background:`${C.accent}30`, color:C.accentL, borderRadius:5,
      padding:'1px 6px', ...M, fontSize:11 }}>
      {vals[mm[1]] || (p ? p.l.toUpperCase() : mm[1].toUpperCase())}</span>;
  });

  return (
    <div style={{ maxWidth:1080, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        gap:14, flexWrap:'wrap', marginBottom:6 }}>
        <div>
          <h2 style={{ ...SERIF, fontSize:30, fontWeight:500, margin:'0 0 6px' }}>Skills</h2>
          <p style={{ fontSize:13.5, color:C.muted, margin:0 }}>
            Reusable instructions Nova follows. Usable at every seat.</p>
        </div>
        <button onClick={() => setCreate(true)} style={{ fontSize:13, padding:'10px 18px',
          background:C.accent, color:'#FFFFFF', border:'none', borderRadius:9, cursor:'pointer',
          fontWeight:600 }}>+ Create skill</button>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', margin:'18px 0 20px' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ fontSize:12.5, padding:'7px 15px',
            borderRadius:18, cursor:'pointer', background: cat === c ? `${C.accent}22` : 'transparent',
            border:`1px solid ${cat === c ? C.accent : C.line2}`,
            color: cat === c ? C.accentL : C.muted }}>{c}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search skills…"
          className="nova-field" style={{ marginLeft:'auto', minWidth:170, width:190, fontSize:12.5,
            padding:'8px 13px' }} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:12 }}>
        {hits.map(s => (
          <div key={s.id} onClick={() => { setSel(s); setVals({}); }} style={{ display:'flex', gap:14,
            alignItems:'flex-start', padding:16, borderRadius:12, background:C.card,
            border:`1px solid ${C.line}`, cursor:'pointer', opacity: s.enabled === false ? .45 : 1 }}>
            <div style={{ width:38, height:38, borderRadius:9, background:C.card2,
              border:`1px solid ${C.line2}`, display:'flex', alignItems:'center',
              justifyContent:'center', flexShrink:0 }}><NovaMark height={22} /></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600, marginBottom:3 }}>{s.name}</div>
              <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.5, marginBottom:7 }}>{s.when}</div>
              <div style={{ fontSize:11, color:C.dim }}>{s.cat} · {s.out} · by Nova</div>
            </div>
            <Toggle on={s.enabled !== false} set={on => toggle(s.id, on)} />
          </div>
        ))}
      </div>
      {!hits.length && <div style={{ fontSize:13, color:C.dim, marginTop:24 }}>No skill matches that.</div>}

      {sel && (
        <div onClick={() => setSel(null)} style={{ position:'fixed', inset:0, zIndex:200,
          background:'#00071aa8', display:'flex', justifyContent:'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'min(460px,100%)', background:C.bg,
            borderLeft:`1px solid ${C.line2}`, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.line}`, display:'flex',
              justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <NovaMark height={24} /><span style={{ ...SERIF, fontSize:20 }}>{sel.name}</span>
              </div>
              <button onClick={() => setSel(null)} style={{ fontSize:15, background:'transparent',
                border:'none', color:C.dim, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', padding:20, display:'grid', gap:18, alignContent:'start' }}>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, padding:'4px 11px', borderRadius:13,
                  background:`${C.accent}22`, color:C.accentL }}>{sel.cat}</span>
                <span style={{ fontSize:11, padding:'4px 11px', borderRadius:13, background:C.card,
                  border:`1px solid ${C.line}`, color:C.dim }}>{sel.out}</span>
              </div>
              <div style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>{sel.when}</div>
              <div>
                <div style={{ fontSize:11.5, fontWeight:600, color:C.dim, textTransform:'uppercase',
                  letterSpacing:1, marginBottom:8 }}>Sources</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {SOURCES.map(s => (
                    <span key={s.n} style={{ fontSize:10.5, padding:'4px 9px', borderRadius:12,
                      background:C.card, border:`1px solid ${C.line}`, color:C.dim }}>{s.n}</span>
                  ))}
                </div>
              </div>
              {sel.params.length > 0 && (
                <div style={{ display:'grid', gap:11 }}>
                  {sel.params.map(p => (
                    <div key={p.k}>
                      <div style={{ fontSize:11.5, fontWeight:600, color:C.dim, textTransform:'uppercase',
                        letterSpacing:1, marginBottom:5 }}>{p.l}</div>
                      <input className="nova-field" value={vals[p.k] ?? ''} placeholder={p.ph}
                        onChange={e => setVals(v => ({ ...v, [p.k]:e.target.value }))} />
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:C.dim }}>Leave blank to run with the example shown.</div>
                </div>
              )}
              <div>
                <div style={{ fontSize:11.5, fontWeight:600, color:C.dim, textTransform:'uppercase',
                  letterSpacing:1, marginBottom:8 }}>Prompt</div>
                <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:10, padding:14,
                  fontSize:12, color:C.muted, lineHeight:1.7, whiteSpace:'pre-wrap', maxHeight:220,
                  overflowY:'auto' }}>{renderSpec(sel.spec)}</div>
              </div>
              <div style={{ fontSize:11, color:C.dim, lineHeight:1.6 }}>
                Compliance rails apply to every run: informational color only, broker attribution,
                timestamps, no silent gaps, no re-pitching names in the book.
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.line}` }}>
              <button onClick={use} disabled={sel.enabled === false} style={{ width:'100%', fontSize:14,
                padding:'13px', background: sel.enabled === false ? C.line2 : C.accent,
                color: sel.enabled === false ? C.dim : '#FFFFFF', border:'none', borderRadius:10,
                cursor: sel.enabled === false ? 'default' : 'pointer', fontWeight:600 }}>
                Use skill →</button>
            </div>
          </div>
        </div>
      )}

      {create && (
        <div onClick={() => setCreate(false)} style={{ position:'fixed', inset:0, zIndex:210,
          background:'#00071ab5', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'min(680px,100%)', maxHeight:'90vh',
            overflowY:'auto', background:C.bg, border:`1px solid ${C.line2}`, borderRadius:14, padding:26 }}>
            <div style={{ ...SERIF, fontSize:23, marginBottom:4 }}>New skill</div>
            <div style={{ fontSize:12.5, color:C.muted, marginBottom:20 }}>
              Save an instruction set the whole desk can reuse. Use {'{variable}'} to denote a variable.</div>
            <div style={{ display:'grid', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 180px', gap:12 }}>
                <input className="nova-field" value={nu.name} placeholder="A short title (< 8 words)"
                  onChange={e => setNu(x => ({ ...x, name:e.target.value }))} />
                <select className="nova-field" value={nu.cat} style={{ cursor:'pointer' }}
                  onChange={e => setNu(x => ({ ...x, cat:e.target.value }))}>
                  {SKILL_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input className="nova-field" value={nu.when}
                placeholder="When to use this (one line, shown to the desk)"
                onChange={e => setNu(x => ({ ...x, when:e.target.value }))} />
              <textarea className="nova-field" value={nu.spec} rows={8}
                placeholder={'Write out the entire prompt. Use {variable} to denote a variable.'}
                onChange={e => setNu(x => ({ ...x, spec:e.target.value }))} style={{ resize:'vertical' }} />
              <textarea className="nova-field" value={nu.extra} rows={3}
                placeholder="Additional instructions (optional)"
                onChange={e => setNu(x => ({ ...x, extra:e.target.value }))} style={{ resize:'vertical' }} />
              <div style={{ fontSize:11.5, color:C.dim }}>
                Compliance rails are appended automatically to every skill run.</div>
              <button onClick={save} style={{ fontSize:14, padding:'13px', background:C.accent,
                color:'#FFFFFF', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                Save skill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ chart engine ═══════════════════ */
const FIB = [0, .236, .382, .5, .618, .786, 1];
const TOOLS = [{ k:'cursor', l:'✛' }, { k:'fib', l:'≡' }, { k:'hline', l:'—' }, { k:'trend', l:'╱' }];
const ChartBtn = ({ on, col = C.accent, onClick, children, w }) => (
  <button onClick={onClick} style={{ ...S, fontSize:11, padding: w ? '0' : '5px 10px', width:w, height:26,
    borderRadius:7, cursor:'pointer', border:`1px solid ${on ? col : C.line}`,
    background: on ? `${col}26` : 'transparent', color: on ? C.accentL : C.muted }}>{children}</button>
);

function ProChart({ sec }) {
  const [style, setStyle] = useState('Candles');
  const [tool, setTool] = useState('cursor');
  const [showVol, setShowVol] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [ma, setMA] = useState({ 20:true, 50:false });
  const [range, setRange] = useState('3M');
  const [fib, setFib] = useState(null);
  const [hlines, setHlines] = useState([]);
  const [trends, setTrends] = useState([]);
  const [draft, setDraft] = useState(null);
  const [hover, setHover] = useState(null);

  const wrap = useRef(null), svgRef = useRef(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(320, e[0].contentRect.width)));
    ro.observe(wrap.current); return () => ro.disconnect();
  }, []);

  const cut = range === '1M' ? 22 : range === '3M' ? 64 : N;
  const bars = useMemo(() => sec.bars.slice(N - cut), [sec, cut]);
  const n = bars.length;
  const s20 = useMemo(() => sma(bars, 20), [bars]);
  const s50 = useMemo(() => sma(bars, 50), [bars]);
  const rs = useMemo(() => rsi(bars), [bars]);

  const H = 320, PAD = { l:6, r:62, t:12, b:18 };
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  const lo = Math.min(...bars.map(b => b.l)), hi = Math.max(...bars.map(b => b.h));
  const span = (hi - lo) || 1, min = lo - span * .06, max = hi + span * .06;
  const X = i => PAD.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const Y = p => PAD.t + (1 - (p - min) / (max - min)) * ph;
  const P2 = y => min + (1 - (y - PAD.t) / ph) * (max - min);
  const bw = Math.max(1.5, (pw / n) * .66);

  const toData = e => {
    const r = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width), py = (e.clientY - r.top) * (H / r.height);
    return { idx:Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / pw) * (n - 1)))), price:P2(py) };
  };
  const down = e => {
    const d = toData(e);
    if (tool === 'hline') { setHlines(h => [...h, +d.price.toFixed(2)]); return; }
    if (tool === 'fib' || tool === 'trend') setDraft({ tool, i1:d.idx, p1:d.price, i2:d.idx, p2:d.price });
  };
  const move = e => { const d = toData(e); setHover(d.idx); if (draft) setDraft(x => ({ ...x, i2:d.idx, p2:d.price })); };
  const up = () => {
    if (!draft) return;
    if (draft.tool === 'fib' && Math.abs(draft.p1 - draft.p2) > span * .01) setFib(draft);
    if (draft.tool === 'trend' && draft.i1 !== draft.i2) setTrends(t => [...t, draft]);
    setDraft(null);
  };

  const hb = hover != null ? bars[hover] : bars[n - 1];
  const aFib = draft?.tool === 'fib' ? draft : fib;
  const ticks = Array.from({ length:5 }, (_, i) => min + ((max - min) / 4) * i);

  return (
    <div ref={wrap}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        {['Line','Area','Candles','Bars','Hollow'].map(s => (
          <ChartBtn key={s} on={style === s} onClick={() => setStyle(s)}>{s}</ChartBtn>))}
        <span style={{ width:1, height:18, background:C.line, margin:'0 3px' }} />
        {['1M','3M','6M'].map(r => (
          <ChartBtn key={r} on={range === r} onClick={() => setRange(r)}>{r}</ChartBtn>))}
        <span style={{ width:1, height:18, background:C.line, margin:'0 3px' }} />
        {TOOLS.map(t => (
          <ChartBtn key={t.k} on={tool === t.k} onClick={() => setTool(t.k)} w={30}>{t.l}</ChartBtn>))}
        <ChartBtn onClick={() => { setFib(null); setHlines([]); setTrends([]); }}>Clear</ChartBtn>
        <span style={{ width:1, height:18, background:C.line, margin:'0 3px' }} />
        <ChartBtn on={ma[20]} onClick={() => setMA(m => ({ ...m, 20:!m[20] }))}>MA20</ChartBtn>
        <ChartBtn on={ma[50]} onClick={() => setMA(m => ({ ...m, 50:!m[50] }))}>MA50</ChartBtn>
        <ChartBtn on={showVol} onClick={() => setShowVol(v => !v)}>Vol</ChartBtn>
        <ChartBtn on={showRSI} onClick={() => setShowRSI(v => !v)}>RSI</ChartBtn>
      </div>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:4 }}>
        {[['O', hb.o], ['H', hb.h], ['L', hb.l], ['C', hb.c]].map(([k, v]) => (
          <span key={k} style={{ ...M, fontSize:10.5, color:C.dim }}>{k}
            <span style={{ color: hb.c >= hb.o ? C.up : C.down, marginLeft:4 }}>{v.toFixed(2)}</span></span>
        ))}
        <span style={{ ...M, fontSize:10.5, color:C.dim }}>{hb.d}</span>
        {aFib && <span style={{ ...M, fontSize:10.5, color:C.accentL }}>FIB</span>}
        {hlines.length > 0 && <span style={{ ...M, fontSize:10.5, color:C.accentL }}>{hlines.length} S/R</span>}
      </div>

      <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} onMouseDown={down}
        onMouseMove={move} onMouseUp={up} onMouseLeave={() => { setHover(null); setDraft(null); }}
        style={{ cursor: tool === 'cursor' ? 'crosshair' : 'copy', display:'block', userSelect:'none' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={PAD.l + pw} y1={Y(t)} y2={Y(t)} stroke={C.line} strokeWidth=".6" />
            <text x={PAD.l + pw + 6} y={Y(t) + 3} fontFamily={M.fontFamily} fontSize="9" fill={C.dim}>{t.toFixed(1)}</text>
          </g>
        ))}
        {aFib && (() => {
          const top = Math.max(aFib.p1, aFib.p2), bot = Math.min(aFib.p1, aFib.p2);
          return FIB.map((f, i) => {
            const p = top - (top - bot) * f;
            const pn = i < FIB.length - 1 ? top - (top - bot) * FIB[i+1] : null;
            return (
              <g key={f}>
                {pn !== null && <rect x={PAD.l} y={Y(p)} width={pw} height={Math.abs(Y(pn) - Y(p))}
                  fill={C.accent} opacity={i % 2 ? .05 : .09} />}
                <line x1={PAD.l} x2={PAD.l + pw} y1={Y(p)} y2={Y(p)} stroke={C.accentL} strokeWidth=".8"
                  strokeDasharray={f === 0 || f === 1 ? '' : '4 3'} opacity=".8" />
                <text x={PAD.l + 4} y={Y(p) - 3} fontFamily={M.fontFamily} fontSize="8.5" fill={C.accentL}
                  opacity=".9">{(f * 100).toFixed(1)}%  {p.toFixed(2)}</text>
              </g>
            );
          });
        })()}
        {hlines.map((p, i) => (
          <g key={i} onMouseDown={e => { e.stopPropagation(); setHlines(h => h.filter((_, j) => j !== i)); }}
            style={{ cursor:'pointer' }}>
            <line x1={PAD.l} x2={PAD.l + pw} y1={Y(p)} y2={Y(p)} stroke={C.accentL} strokeWidth="1.1" />
            <rect x={PAD.l + pw} y={Y(p) - 7} width={PAD.r - 2} height={14} fill={C.accentL} rx="3" />
            <text x={PAD.l + pw + 4} y={Y(p) + 3.5} fontFamily={M.fontFamily} fontSize="8.5" fill={C.bg}>{p.toFixed(2)}</text>
          </g>
        ))}
        {[...trends, ...(draft?.tool === 'trend' ? [draft] : [])].map((t, i) => (
          <line key={i} x1={X(t.i1)} y1={Y(t.p1)} x2={X(t.i2)} y2={Y(t.p2)} stroke={C.accentL} strokeWidth="1.3" />
        ))}
        {style === 'Area' && (
          <>
            <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity=".3" />
              <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
            </linearGradient></defs>
            <path d={`M${X(0)},${Y(bars[0].c)} ${bars.map((b, i) => `L${X(i)},${Y(b.c)}`).join(' ')} L${X(n-1)},${PAD.t+ph} L${X(0)},${PAD.t+ph}Z`} fill="url(#pg)" />
          </>
        )}
        {(style === 'Line' || style === 'Area') && (
          <path d={`M${X(0)},${Y(bars[0].c)} ${bars.map((b, i) => `L${X(i)},${Y(b.c)}`).join(' ')}`}
            fill="none" stroke={C.accentL} strokeWidth="1.5" />
        )}
        {(style === 'Candles' || style === 'Hollow') && bars.map((b, i) => {
          const u = b.c >= b.o, col = u ? C.up : C.down;
          return (
            <g key={i}>
              <line x1={X(i)} x2={X(i)} y1={Y(b.h)} y2={Y(b.l)} stroke={col} strokeWidth="1" />
              <rect x={X(i) - bw/2} y={Y(Math.max(b.o, b.c))} width={bw}
                height={Math.max(1, Math.abs(Y(b.o) - Y(b.c)))}
                fill={style === 'Hollow' && u ? 'none' : col} stroke={col}
                strokeWidth={style === 'Hollow' ? 1 : 0} />
            </g>
          );
        })}
        {style === 'Bars' && bars.map((b, i) => {
          const col = b.c >= b.o ? C.up : C.down;
          return (
            <g key={i} stroke={col} strokeWidth="1.1">
              <line x1={X(i)} x2={X(i)} y1={Y(b.h)} y2={Y(b.l)} />
              <line x1={X(i) - bw/2} x2={X(i)} y1={Y(b.o)} y2={Y(b.o)} />
              <line x1={X(i)} x2={X(i) + bw/2} y1={Y(b.c)} y2={Y(b.c)} />
            </g>
          );
        })}
        {ma[20] && <path d={s20.map((v, i) => v == null ? '' : `${i && s20[i-1] != null ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.accentL} strokeWidth="1.1" opacity=".9" />}
        {ma[50] && <path d={s50.map((v, i) => v == null ? '' : `${i && s50[i-1] != null ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.muted} strokeWidth="1.1" opacity=".8" />}
        {hover != null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={PAD.t + ph} stroke={C.dim}
              strokeDasharray="3 3" strokeWidth=".8" />
            <circle cx={X(hover)} cy={Y(bars[hover].c)} r="3" fill={C.accentL} />
          </g>
        )}
      </svg>

      {showVol && (() => {
        const vh = 56, vmax = Math.max(...bars.map(b => b.v));
        return (
          <svg width="100%" height={vh} viewBox={`0 0 ${W} ${vh}`} style={{ display:'block' }}>
            <text x={PAD.l + 2} y={10} fontFamily={M.fontFamily} fontSize="8.5" fill={C.dim}>VOL</text>
            {bars.map((b, i) => (
              <rect key={i} x={X(i) - bw/2} width={bw} y={vh - (b.v / vmax) * (vh - 14)}
                height={(b.v / vmax) * (vh - 14)} fill={b.c >= b.o ? C.up : C.down} opacity=".4" />
            ))}
            {hover != null && <line x1={X(hover)} x2={X(hover)} y1={0} y2={vh} stroke={C.dim} strokeDasharray="3 3" strokeWidth=".8" />}
          </svg>
        );
      })()}

      {showRSI && (() => {
        const rh = 78, rt = 14, rp = rh - rt - 8;
        const RY = v => rt + (1 - v / 100) * rp;
        const path = rs.map((v, i) => v == null ? '' : `${i && rs[i-1] != null ? 'L' : 'M'}${X(i)},${RY(v)}`).join(' ');
        const cur = rs[hover ?? n - 1];
        return (
          <svg width="100%" height={rh} viewBox={`0 0 ${W} ${rh}`} style={{ display:'block' }}>
            <rect x={PAD.l} y={RY(70)} width={pw} height={RY(30) - RY(70)} fill={C.text} opacity=".03" />
            {[30, 50, 70].map(l => (
              <g key={l}>
                <line x1={PAD.l} x2={PAD.l + pw} y1={RY(l)} y2={RY(l)} stroke={C.line} strokeWidth=".6"
                  strokeDasharray={l === 50 ? '2 4' : ''} />
                <text x={PAD.l + pw + 6} y={RY(l) + 3} fontFamily={M.fontFamily} fontSize="8" fill={C.dim}>{l}</text>
              </g>
            ))}
            <text x={PAD.l + 2} y={9} fontFamily={M.fontFamily} fontSize="8.5" fill={C.dim}>RSI 14
              <tspan fill={cur > 70 ? C.down : cur < 30 ? C.up : C.muted}> {cur ? cur.toFixed(1) : '—'}</tspan></text>
            <path d={path} fill="none" stroke={C.accentL} strokeWidth="1.2" />
            {hover != null && <line x1={X(hover)} x2={X(hover)} y1={0} y2={rh} stroke={C.dim} strokeDasharray="3 3" strokeWidth=".8" />}
          </svg>
        );
      })()}

      <div style={{ fontSize:11, color:C.dim, marginTop:8 }}>
        {tool === 'fib' ? 'Drag high → low to set the retracement' :
         tool === 'hline' ? 'Click to place a level · click a level to remove it' :
         tool === 'trend' ? 'Drag to draw a trendline' : 'Pick a tool to draw · mock data'}
      </div>
    </div>
  );
}

/* ═══════════════════ screener ═══════════════════ */
const Chip = ({ opts, val, set }) => (
  <div style={{ display:'inline-flex', gap:6, flexWrap:'wrap' }}>
    {opts.map(o => (
      <button key={o} onClick={() => set(o)} style={{ fontSize:12, padding:'6px 13px', borderRadius:16,
        cursor:'pointer', background: val === o ? `${C.accent}22` : 'transparent',
        border:`1px solid ${val === o ? C.accent : C.line2}`,
        color: val === o ? C.accentL : C.muted }}>{o}</button>
    ))}
  </div>
);

function Screen({ go, prefs }) {
  const pre = prefs?.sectors?.filter(s => SECTORS.includes(s)) || [];
  const [sect, setSect] = useState(pre.length === 1 ? pre[0] : 'All');
  const [lens, setLens] = useState('Fundamental');
  const [mode, setMode] = useState('Beta-adj');
  const [sel, setSel] = useState(null);
  const rk = mode === 'Raw' ? 'ret' : mode === 'Beta-adj' ? 'retBeta' : 'retMN';
  const sk = lens === 'Raw' ? 'siRaw' : 'siFund';
  const rows = useMemo(() => DATA.filter(d => sect === 'All' || d.s === sect).sort((a, b) => b[sk] - a[sk]), [sect, sk]);

  const W = 700, H = 240, P = { l:42, r:16, t:14, b:34 };
  const xs = rows.map(d => d[sk]), ys = rows.map(d => d[rk]);
  const xmin = Math.min(...xs) * .9, xmax = Math.max(...xs) * 1.06;
  const ymin = Math.min(...ys, 0) * 1.18, ymax = Math.max(...ys, 0) * 1.18;
  const SX = v => P.l + ((v - xmin) / (xmax - xmin || 1)) * (W - P.l - P.r);
  const SY = v => P.t + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - P.t - P.b);

  return (
    <div style={{ maxWidth:1080, margin:'0 auto', display:'grid', gap:18 }}>
      <div>
        <h2 style={{ ...SERIF, fontSize:30, fontWeight:500, margin:'0 0 6px' }}>Screener</h2>
        <p style={{ fontSize:13.5, color:C.muted, margin:0 }}>
          Crowding on a fundamental basis, returns beta-adjusted or market-neutral.</p>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <Chip opts={['Raw','Fundamental']} val={lens} set={setLens} />
        <span style={{ width:1, height:20, background:C.line }} />
        <Chip opts={['Raw','Beta-adj','Mkt-neutral']} val={mode} set={setMode} />
        <select value={sect} onChange={e => { setSect(e.target.value); setSel(null); }}
          className="nova-field" style={{ width:'auto', marginLeft:'auto', fontSize:12.5,
            padding:'7px 11px', cursor:'pointer' }}>
          {['All', ...SECTORS].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card pad={18}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
          <line x1={P.l} x2={W - P.r} y1={SY(0)} y2={SY(0)} stroke={C.line} />
          <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} stroke={C.line} />
          <text x={W / 2} y={H - 6} fontFamily={S.fontFamily} fontSize="10" fill={C.dim} textAnchor="middle">
            {lens} SI %</text>
          {rows.map(d => (
            <g key={d.t} onClick={() => setSel(sel === d.t ? null : d.t)} style={{ cursor:'pointer' }}>
              <circle cx={SX(d[sk])} cy={SY(d[rk])} r={sel === d.t ? 8 : 5}
                fill={d.pos ? (d.pos === 'LONG' ? C.up : C.down) : sel === d.t ? C.text : C.accent}
                opacity={sel && sel !== d.t ? .22 : .88} />
              <text x={SX(d[sk])} y={SY(d[rk]) - 9} fontFamily={M.fontFamily} fontSize="8.5"
                textAnchor="middle" fill={sel && sel !== d.t ? 'transparent' : C.muted}>{d.t}</text>
            </g>
          ))}
        </svg>
        <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>
          ▲ held long · ▼ held short · ○ unheld — click a point to link the table</div>
      </Card>

      <Card pad={0}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['','Ticker','Sector','SI raw','SI fund','Δ','DTC','Borrow', mode, 'Catalyst'].map(h => (
                <th key={h} style={{ ...S, fontSize:11, fontWeight:600, color:C.dim, padding:'11px 12px',
                  textAlign:['Ticker','Sector','Catalyst',''].includes(h) ? 'left' : 'right',
                  borderBottom:`1px solid ${C.line}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(d => {
                const on = !sel || sel === d.t;
                const td = { padding:'9px 12px', borderBottom:`1px solid ${C.line}` };
                return (
                  <tr key={d.t} onClick={() => go(d.t)} style={{ cursor:'pointer', opacity: on ? 1 : .3 }}>
                    <td style={td}>{d.pos && <span style={{ fontSize:10, color: d.pos === 'LONG' ? C.up : C.down }}>{d.pos === 'LONG' ? '▲' : '▼'}</span>}</td>
                    <td style={{ ...td, ...M, fontSize:12 }}>{d.t}</td>
                    <td style={{ ...td, fontSize:12, color:C.muted }}>{d.s}</td>
                    <td style={{ ...td, ...M, fontSize:11.5, color:C.muted, textAlign:'right' }}>{d.siRaw.toFixed(1)}</td>
                    <td style={{ ...td, ...M, fontSize:11.5, color:C.accentL, textAlign:'right' }}>{d.siFund.toFixed(1)}</td>
                    <td style={{ ...td, textAlign:'right' }}><Num v={d.siFund - d.siRaw} suf="" dp={1} size={11} /></td>
                    <td style={{ ...td, ...M, fontSize:11.5, color:C.muted, textAlign:'right' }}>{d.dtc}</td>
                    <td style={{ ...td, ...M, fontSize:11.5, color: d.bor > 150 ? C.down : C.muted, textAlign:'right' }}>{d.bor}</td>
                    <td style={{ ...td, textAlign:'right' }}><Num v={d[rk]} dp={1} size={11.5} /></td>
                    <td style={{ ...td, fontSize:11.5, color:C.dim, whiteSpace:'nowrap' }}>{d.cat}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════ single name ═══════════════════ */
function NameView({ tkr }) {
  const d = DATA.find(x => x.t === tkr) ?? DATA[0];
  const est = d.live ? ' (est.)' : '';
  const steps = [
    { l:'Raw SI / float', v:d.siRaw, c:C.muted },
    { l:'less convert hedge' + est, v:(d.fund / d.float) * 100, c:C.accent },
    { l:'over active float' + est, v:d.siFund, c:C.accentL },
  ];
  const wmax = Math.max(...steps.map(s => s.v)) * 1.15;
  return (
    <div style={{ maxWidth:1080, margin:'0 auto', display:'grid', gap:18 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' }}>
        <span style={{ ...SERIF, fontSize:30 }}>{d.t}</span>
        <span style={{ fontSize:14, color:C.muted }}>{d.n}</span>
        <span style={{ ...M, fontSize:21, color: d.chg >= 0 ? C.up : C.down }}>{d.last.toFixed(2)}</span>
        <Num v={d.chg} dp={2} size={13} />
        <span style={{ fontSize:12, color:C.dim }}>{d.s} · β {d.beta.toFixed(2)}</span>
        {d.pos && <span style={{ fontSize:11, padding:'4px 10px', borderRadius:12,
          background: d.pos === 'LONG' ? `${C.up}22` : `${C.down}22`,
          color: d.pos === 'LONG' ? C.up : C.down }}>Held {d.pos.toLowerCase()}</span>}
      </div>

      <Card pad={16}><ProChart sec={d} /></Card>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
        <Card>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Short interest · dual lens</div>
          <div style={{ fontSize:10.5, color: d.live ? C.accentL : C.dim, marginBottom:12 }}>
            {d.live
              ? `Reported: FINRA ${d.live.settlement} settle · shares out ${d.live.sharesOutAsOf} (EDGAR) · adjustments estimated`
              : 'Mock data'}
          </div>
          <div style={{ display:'flex', gap:26, marginBottom:16, flexWrap:'wrap' }}>
            <div><div style={{ fontSize:11, color:C.dim }}>Reported</div>
              <div style={{ ...M, fontSize:26, color:C.muted }}>{d.siRaw.toFixed(1)}%</div></div>
            <div><div style={{ fontSize:11, color:C.accentL }}>Fundamental</div>
              <div style={{ ...M, fontSize:26, color:C.accentL }}>{d.siFund.toFixed(1)}%</div></div>
            <div><div style={{ fontSize:11, color:C.dim }}>Delta</div>
              <div style={{ ...M, fontSize:26 }}><Num v={d.siFund - d.siRaw} suf="" dp={1} size={26} /></div></div>
          </div>
          <div style={{ display:'grid', gap:9 }}>
            {steps.map(s => (
              <div key={s.l}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:C.muted }}>{s.l}</span>
                  <span style={{ ...M, fontSize:11, color:s.c }}>{s.v.toFixed(2)}%</span>
                </div>
                <div style={{ height:6, background:'#ffffff0f', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${(s.v / wmax) * 100}%`, height:'100%', background:s.c, borderRadius:3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.line}`,
            display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:9 }}>
            {[['Float', d.float], ['less ETF/passive' + est, -d.etf], ['less insider' + est, -d.ins],
              ['Active float', d.active], ['Raw SI shares', d.si], ['less convert delta' + est, -d.cd],
              ['Fundamental short', d.fund], ['Days to cover', d.dtc]].map(([l, v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, color:C.dim }}>{l}</span>
                <span style={{ ...M, fontSize:11, color: String(l).startsWith('less') ? C.accent :
                  ['Active float','Fundamental short'].includes(l) ? C.accentL : C.muted }}>
                  {Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : +Number(v).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display:'grid', gap:16, alignContent:'start' }}>
          <Card>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Float composition</div>
            <div style={{ display:'flex', height:22, borderRadius:6, overflow:'hidden', marginBottom:10 }}>
              {[[d.active, C.accentL], [d.etf, C.accent], [d.ins, C.dim]].map(([v, c], i) => (
                <div key={i} style={{ width:`${(v / d.float) * 100}%`, background:c }} />
              ))}
            </div>
            {[['Active float', d.active, C.accentL], ['ETF / passive', d.etf, C.accent],
              ['Insider / strategic', d.ins, C.dim]].map(([l, v, c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                <span style={{ fontSize:12, color:C.muted }}><span style={{ color:c }}>■</span> {l}</span>
                <span style={{ ...M, fontSize:11, color:C.muted }}>{((v / d.float) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Catalysts</div>
            {[d.cat, 'Sector conf 9/18', 'Index rebal 9/20'].map((c, i) => (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'5px 0' }}>
                <div style={{ width:6, height:6, borderRadius:3, background: i === 0 ? C.accentL : C.dim }} />
                <span style={{ fontSize:12.5, color: i === 0 ? C.text : C.muted }}>{c}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>StreetSpread signals</span>
              <span style={{ fontSize:10.5, color:C.accentL }}>● API</span>
            </div>
            {[['Attention z-score', 1.84], ['Demand vs volume div.', -0.62], ['Unlisted demand rank', 12]].map(([l, v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                <span style={{ fontSize:12, color:C.muted }}>{l}</span><Num v={v} suf="" dp={2} size={11.5} />
              </div>
            ))}
            <div style={{ fontSize:11, color:C.dim, marginTop:8, lineHeight:1.5 }}>
              Pending vendor/compliance sign-off before feeding desk content.</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ chat workspace ═══════════════════
   Conversation as the operating system: people, securities, market data,
   institutional memory and agents in one room. Nova participates rather
   than sitting in a side panel. */

const PEOPLE = {
  you:   { name:'You',           role:'',        init:'JM', col:C.accent,   dot:C.up },
  alex:  { name:'Alex Morgan',   role:'PM',      init:'AM', col:'#C9743B',  dot:C.up },
  sarah: { name:'Sarah Chen',    role:'Analyst', init:'SC', col:'#4C8C6B',  dot:C.up },
  mike:  { name:'Michael Ross',  role:'Trader',  init:'MR', col:'#7A6BC9',  dot:'#D6A24A' },
  david: { name:'David Kim',     role:'Risk',    init:'DK', col:'#B85C7A',  dot:C.dim },
};

const AGENTS = [
  { id:'Nova',     d:'General financial intelligence',            live:true },
  { id:'Research', d:'Filings, transcripts, research, news' },
  { id:'Markets',  d:'Prices, flows, options, anomalies' },
  { id:'Risk',     d:'Portfolio exposures and scenarios' },
  { id:'Sales',    d:'CRM and client intelligence' },
];

const CMDS = [
  ['/chart',    'Plot a security or a spread'],
  ['/compare',  'Side-by-side valuation'],
  ['/research', 'Recent sell-side changes'],
  ['/news',     'Headlines and filings'],
  ['/earnings', 'Next print, estimates, history'],
  ['/risk',     'Exposure and scenario'],
  ['/monitor',  'Watch a condition and alert'],
];

const TICK = {
  NVDA:{ n:'NVIDIA',              px:184.32, chg:+2.14, mc:'4.49T', vol:'218M', sd:11 },
  AVGO:{ n:'Broadcom',            px:342.18, chg:+1.02, mc:'1.61T', vol:'24M',  sd:12 },
  AMD: { n:'Adv Micro Devices',   px:162.40, chg:-0.86, mc:'263B',  vol:'41M',  sd:13 },
  META:{ n:'Meta Platforms',      px:612.75, chg:+0.94, mc:'1.55T', vol:'14M',  sd:14 },
  AAPL:{ n:'Apple',               px:241.06, chg:-0.31, mc:'3.66T', vol:'52M',  sd:15 },
  TSLA:{ n:'Tesla',               px:238.11, chg:-1.42, mc:'762B',  vol:'88M',  sd:16 },
  JPM: { n:'JPMorgan',            px:214.53, chg:+0.20, mc:'602B',  vol:'9.1M', sd:17 },
  SOX: { n:'PHLX Semiconductor',  px:5241.8, chg:-1.18, mc:'—',     vol:'—',    sd:18 },
  MSFT:{ n:'Microsoft',           px:438.90, chg:+0.42, mc:'3.26T', vol:'18M',  sd:19 },
};
Object.values(TICK).forEach(t => { t.bars = genOHLC(t.sd * 37, t.px * 0.94, .018, .05); });

const ROOMS = [
  { id:'general',        k:'ch',  n:'general' },
  { id:'markets',        k:'ch',  n:'markets', unread:3 },
  { id:'equities',       k:'ch',  n:'equities' },
  { id:'earnings',       k:'ch',  n:'earnings', unread:1 },
  { id:'portfolio-risk', k:'ch',  n:'portfolio-risk' },
  { id:'NVDA', k:'sec', n:'NVDA', pin:true },
  { id:'META', k:'sec', n:'META', unread:2 },
  { id:'AAPL', k:'sec', n:'AAPL' },
  { id:'TSLA', k:'sec', n:'TSLA' },
  { id:'sarah', k:'dm', n:'Sarah Chen',   who:'sarah' },
  { id:'mike',  k:'dm', n:'Michael Ross', who:'mike', unread:1 },
  { id:'david', k:'dm', n:'David Kim',    who:'david' },
];

let mid = 0;
const msg = o => ({ id:`m${++mid}`, ...o });

const SEED = {
  NVDA: [
    msg({ who:'alex', t:'9:38', body:'Cutting through it — $NVDA still looks expensive here versus $AVGO.' }),
    msg({ who:'sarah', t:'9:39', body:'Absolute multiple definitely does. Relative premium has actually compressed quite a bit.' }),
    msg({ who:'alex', t:'9:40', body:'@Nova compare NVDA valuation vs AVGO and AMD.' }),
    msg({ who:'nova', t:'9:40', kind:'ai', blocks:[
      { type:'h', text:'Relative valuation' },
      { type:'table', cols:['', 'NVDA', 'AVGO', 'AMD'], rows:[
        ['NTM P/E', '34.2x', '27.8x', '31.4x'],
        ['EV / Sales', '18.1x', '12.4x', '9.7x'],
        ['FCF yield', '2.4%', '3.1%', '1.9%'],
      ] },
      { type:'h', text:'Takeaway' },
      { type:'p', text:'NVDA trades at a 23% NTM P/E premium to AVGO, against a two-year median premium of roughly 41%. The absolute multiple is high; the relative premium has compressed materially.' },
    ], actions:['View Chart','Sources','Add Monitor','Ask Follow-Up'],
      sources:[
        ['Consensus estimates', 'Refinitiv · 8/26'],
        ['Historical multiples', '2y daily, computed'],
        ['FCF, TTM', 'Company filings · Q2'],
      ] }),
    msg({ who:'alex', t:'9:44', body:"I'm worried expectations are getting derisked." }),
    msg({ who:'sarah', t:'9:44', body:"Consensus estimates haven't moved though." }),
    msg({ who:'alex', t:'9:45', body:'Yeah but look at semis.' }),
    msg({ who:'sarah', t:'9:45', body:'@Nova check it.' }),
    msg({ who:'nova', t:'9:45', kind:'ai', ctx:'Resolved “it” from the last four messages — semiconductor tape vs NVDA estimate revisions.',
      blocks:[
        { type:'p', text:'I checked recent semiconductor behaviour against NVDA estimate revisions.' },
        { type:'sig', text:'Expectations appear to be softening despite stable consensus.' },
        { type:'kv', items:[
          ['SOX, 7 sessions', '−4.8%', 'down'],
          ['NVDA, 7 sessions', '−7.1%', 'down'],
          ['NVDA NTM EPS consensus', '−0.3%', 'flat'],
          ['Implied volatility', '+4.2 pts', 'up'],
          ['Put/call skew', '91st pctile', 'up'],
        ] },
        { type:'h', text:'Interpretation' },
        { type:'p', text:'Price and options markets are pricing more downside risk than the earnings-consensus data currently reflects.' },
        { type:'conf', level:'High' },
      ], actions:['Investigate','Chart Signals','Set Alert'] }),
  ],
  markets: [
    msg({ who:'mike', t:'10:02', body:"Weird that $JPM isn't moving with yields." }),
    msg({ who:'sarah', t:'10:02', body:'agreed' }),
    msg({ who:'nova', t:'10:03', kind:'signal', title:'Market signal',
      body:'JPM is underperforming its historical relationship with the 10Y Treasury yield.',
      pair:[['Expected move, 20d sensitivity', '+1.2%'], ['Actual', '+0.2%']],
      foot:'The divergence sits in the 94th percentile of observations over the last year.',
      actions:['Investigate','Show Chart','Mute Signals'] }),
    msg({ who:'david', t:'10:11', body:'Worth checking whether the deposit beta assumption is stale.' }),
  ],
  META: [
    msg({ who:'alex', t:'11:20', body:"Let's increase $META to 3% into earnings." }),
    msg({ who:'sarah', t:'11:21', body:'Agree. Reels monetization and pricing still look underappreciated.' }),
    msg({ who:'nova', t:'11:21', kind:'decision', d:{
      title:'META position', from:'2.2%', to:'3.0%',
      thesis:['Reels monetization upside','Advertising pricing strength'],
      risks:['CapEx guidance','Reality Labs spending'],
      catalyst:'Earnings', owner:'Alex Morgan' } }),
  ],
  general: [
    msg({ who:'sarah', t:'8:31', body:'Morning. Pre-open note is in — energy rotation is the live one.' }),
    msg({ who:'alex', t:'8:33', body:'Saw it. Anyone have a view on the $AAPL supply chain checks?' }),
  ],
  equities: [
    msg({ who:'mike', t:'9:12', body:'Flow is two-sided in semis this morning, no clear axe.' }),
  ],
  earnings: [
    msg({ who:'sarah', t:'7:58', body:'$NVDA prints Nov 18. Whisper is running ahead of consensus again.' }),
  ],
  'portfolio-risk': [
    msg({ who:'david', t:'9:05', body:'Net beta drifted to 0.42 overnight. Mostly the energy adds.' }),
  ],
  sarah:  [ msg({ who:'sarah', t:'9:20', body:'Can you send the Blackwell supply deck when you get a sec?' }) ],
  mike:   [ msg({ who:'mike', t:'9:48', body:'Got a client asking about downside protection in semis.' }) ],
  david:  [ msg({ who:'david', t:'8:40', body:'Scenario run is done — 2σ semis drawdown costs us 118bps.' }) ],
};

const MEMORY = {
  NVDA: {
    bull:['Data center demand remains above consensus','Blackwell ramp accelerating','Hyperscaler capex resilient'],
    bear:['Valuation','Export restrictions','Custom silicon competition'],
    catalysts:[['Earnings','Nov 18'],['GTC announcements','Mar'],['Hyperscaler capex commentary','ongoing']],
    views:[['Alex Morgan','Bullish','Valuation risk manageable.'],
           ['Sarah Chen','Neutral','Waiting for estimate revisions.']],
    decisions:[['Aug 12','Increased position 2.0% → 2.8%','Blackwell supply checks strengthened.']],
    open:['Is China weakness fully reflected?',
          'Are hyperscaler order books double-counting demand?',
          'Does custom silicon threaten 2027 estimates?'],
  },
};

const SEARCH_SUGGESTIONS = [
  'What did we say about NVDA before earnings?',
  'Show every conversation mentioning Blackwell.',
  'Who has discussed AVGO recently?',
  'Find bullish semiconductor views.',
  'What decisions did we make this month?',
];

const CHAT_CSS = `
.ch-item { display:flex; align-items:center; gap:9px; width:100%; padding:6px 10px; border-radius:7px;
  border:0; background:none; cursor:pointer; text-align:left; font-family:inherit; transition:background .12s; }
.ch-item:hover { background:${C.card}; }
.ch-item.on { background:${C.card2}; }
.ch-tick { display:inline-flex; align-items:center; gap:4px; padding:1px 6px; margin:0 1px;
  border-radius:5px; background:${C.accent}1f; border:1px solid ${C.accent}3a; color:${C.accentL};
  font-family:'IBM Plex Mono',monospace; font-size:12px; cursor:pointer; transition:background .12s; }
.ch-tick:hover { background:${C.accent}33; }
.ch-msg { padding:9px 22px; transition:background .12s; }
.ch-msg:hover { background:#ffffff05; }
.ch-act { font-size:11.5px; padding:5px 11px; border-radius:7px; border:1px solid ${C.line2};
  background:transparent; color:${C.muted}; cursor:pointer; font-family:inherit; transition:all .15s; }
.ch-act:hover { border-color:${C.accent}; color:${C.accentL}; }
.ch-pick { display:flex; align-items:center; gap:10px; width:100%; padding:8px 11px; border:0;
  background:none; cursor:pointer; text-align:left; font-family:inherit; }
.ch-pick:hover, .ch-pick.on { background:${C.card2}; }
.ch-scroll::-webkit-scrollbar { width:8px }
.ch-scroll::-webkit-scrollbar-thumb { background:${C.line2}; border-radius:4px }
`;

/* ── inline ticker entity ── */
function Tick({ sym, onOpen }) {
  const d = TICK[sym];
  const [pop, setPop] = useState(false);
  if (!d) return <span style={{ ...M, fontSize:12.5, color:C.accentL }}>${sym}</span>;
  return (
    <span style={{ position:'relative', display:'inline-block' }}>
      <span className="ch-tick" onClick={() => setPop(p => !p)}>
        ${sym}<span style={{ fontSize:10, color: d.chg >= 0 ? C.up : C.down }}>
          {d.chg >= 0 ? '▲' : '▼'}</span>
      </span>
      {pop && (
        <span style={{ position:'absolute', top:24, left:0, zIndex:120, width:238, display:'block',
          background:C.card2, border:`1px solid ${C.line2}`, borderRadius:11, padding:14,
          boxShadow:'0 14px 40px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
          <span style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span><span style={{ ...M, fontSize:13, color:C.text }}>{sym}</span>
              <span style={{ ...S, display:'block', fontSize:11, color:C.dim }}>{d.n}</span></span>
            <span style={{ textAlign:'right' }}>
              <span style={{ ...M, fontSize:14, display:'block' }}>{d.px.toFixed(2)}</span>
              <Num v={d.chg} dp={2} size={11} /></span>
          </span>
          <span style={{ display:'block', margin:'10px 0' }}>
            <Spark bars={d.bars} col={d.chg >= 0 ? C.up : C.down} w={210} h={38} /></span>
          <span style={{ display:'flex', gap:14 }}>
            {[['Mkt cap', d.mc], ['Volume', d.vol]].map(([l, v]) => (
              <span key={l}><span style={{ ...S, fontSize:10, color:C.dim, display:'block' }}>{l}</span>
                <span style={{ ...M, fontSize:11.5, color:C.muted }}>{v}</span></span>
            ))}
          </span>
          <button onClick={() => { setPop(false); onOpen?.(sym); }} style={{ ...S, width:'100%',
            marginTop:12, fontSize:11.5, padding:'7px', borderRadius:7, border:`1px solid ${C.line2}`,
            background:'transparent', color:C.muted, cursor:'pointer' }}>Open room</button>
        </span>
      )}
    </span>
  );
}

const Rich = ({ text, onOpen }) => (
  <>{text.split(/(\$[A-Z]{1,5}\b|@Nova\b)/g).map((p, i) => {
    if (/^\$[A-Z]{1,5}$/.test(p)) return <Tick key={i} sym={p.slice(1)} onOpen={onOpen} />;
    if (p === '@Nova') return <span key={i} style={{ color:C.accentL, fontWeight:600 }}>@Nova</span>;
    return <span key={i}>{p}</span>;
  })}</>
);

const Avatar = ({ who, size = 30 }) => {
  if (who === 'nova') return (
    <span style={{ width:size, height:size, borderRadius:8, flexShrink:0, background:C.card2,
      border:`1px solid ${C.accent}55`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <NovaMark height={size * 0.6} /></span>
  );
  const p = PEOPLE[who] || PEOPLE.you;
  return (
    <span style={{ width:size, height:size, borderRadius:8, flexShrink:0, background:`${p.col}28`,
      border:`1px solid ${p.col}55`, color:p.col, display:'flex', alignItems:'center',
      justifyContent:'center', ...M, fontSize:size * 0.36, fontWeight:600 }}>{p.init}</span>
  );
};

/* ── Nova structured response ── */
function NovaBody({ m, onOpen }) {
  const [src, setSrc] = useState(false);
  return (
    <div>
      {m.ctx && (
        <div style={{ ...S, fontSize:11.5, color:C.dim, marginBottom:10, paddingLeft:9,
          borderLeft:`2px solid ${C.line2}` }}>{m.ctx}</div>
      )}
      {m.blocks.map((b, i) => {
        if (b.type === 'h') return (
          <div key={i} style={{ ...S, fontSize:12, fontWeight:600, letterSpacing:'.08em',
            textTransform:'uppercase', color:C.dim, margin:'14px 0 8px' }}>{b.text}</div>);
        if (b.type === 'p') return (
          <div key={i} style={{ fontSize:13.5, color:C.muted, lineHeight:1.68, marginBottom:6 }}>
            <Rich text={b.text} onOpen={onOpen} /></div>);
        if (b.type === 'sig') return (
          <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', margin:'10px 0',
            padding:'10px 13px', background:`${C.accent}14`, border:`1px solid ${C.accent}33`,
            borderRadius:9 }}>
            <span style={{ ...M, fontSize:10, color:C.accentL, letterSpacing:'.1em', marginTop:2 }}>SIGNAL</span>
            <span style={{ fontSize:13.5, color:C.text, lineHeight:1.55 }}>{b.text}</span></div>);
        if (b.type === 'table') return (
          <div key={i} style={{ border:`1px solid ${C.line}`, borderRadius:10, overflow:'hidden',
            margin:'4px 0 6px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:C.card2 }}>
                {b.cols.map((c, j) => (
                  <th key={j} style={{ ...M, fontSize:11, color: j ? C.accentL : C.dim, fontWeight:600,
                    padding:'8px 12px', textAlign: j ? 'right' : 'left',
                    borderBottom:`1px solid ${C.line}` }}>{c}</th>))}
              </tr></thead>
              <tbody>{b.rows.map((r, j) => (
                <tr key={j}>{r.map((c, k) => (
                  <td key={k} style={{ ...(k ? M : S), fontSize:12.5, padding:'8px 12px',
                    textAlign: k ? 'right' : 'left', color: k ? C.text : C.muted,
                    borderBottom: j < b.rows.length - 1 ? `1px solid ${C.line}` : 'none' }}>{c}</td>))}
                </tr>))}
              </tbody>
            </table>
          </div>);
        if (b.type === 'kv') return (
          <div key={i} style={{ display:'grid', gap:1, background:C.line, border:`1px solid ${C.line}`,
            borderRadius:10, overflow:'hidden', margin:'4px 0 6px' }}>
            {b.items.map(([l, v, dir], j) => (
              <div key={j} style={{ display:'flex', justifyContent:'space-between',
                padding:'8px 13px', background:C.card }}>
                <span style={{ fontSize:12.5, color:C.muted }}>{l}</span>
                <span style={{ ...M, fontSize:12.5,
                  color: dir === 'down' ? C.down : dir === 'up' ? C.accentL : C.muted }}>{v}</span>
              </div>))}
          </div>);
        if (b.type === 'conf') return (
          <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:7, marginTop:10,
            padding:'4px 10px', borderRadius:100, border:`1px solid ${C.line2}` }}>
            <span style={{ width:5, height:5, borderRadius:3, background:C.up }} />
            <span style={{ ...S, fontSize:11, color:C.muted }}>Confidence · {b.level}</span></div>);
        return null;
      })}
      {m.actions && (
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:14 }}>
          {m.actions.map(a => (
            <button key={a} className="ch-act"
              onClick={() => a === 'Sources' && setSrc(s => !s)}>{a}</button>))}
        </div>
      )}
      {src && m.sources && (
        <div style={{ marginTop:12, padding:'12px 14px', background:C.card2,
          border:`1px solid ${C.line}`, borderRadius:9 }}>
          <div style={{ ...S, fontSize:11, color:C.dim, letterSpacing:'.1em', textTransform:'uppercase',
            marginBottom:9 }}>Sources</div>
          {m.sources.map(([n, d], i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
              <span style={{ fontSize:12.5, color:C.muted }}>{n}</span>
              <span style={{ ...M, fontSize:11.5, color:C.dim }}>{d}</span></div>))}
        </div>
      )}
    </div>
  );
}

/* ── message row ── */
function Row({ m, onOpen, onDecision }) {
  const nova = m.who === 'nova';
  const p = PEOPLE[m.who];

  if (m.kind === 'signal') return (
    <div className="ch-msg" style={{ paddingTop:12, paddingBottom:12 }}>
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who="nova" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:C.accentL }}>Nova</span>
            <span style={{ ...M, fontSize:10, color:C.dim, letterSpacing:'.08em' }}>· {m.title.toUpperCase()}</span>
            <span style={{ fontSize:11, color:C.dim, marginLeft:'auto' }}>{m.t}</span>
          </div>
          <div style={{ border:`1px solid ${C.line2}`, borderLeft:`2px solid ${C.accent}`,
            borderRadius:'0 11px 11px 0', padding:'15px 17px', background:C.card }}>
            <div style={{ fontSize:13.5, color:C.text, lineHeight:1.6, marginBottom:13 }}>
              <Rich text={m.body} onOpen={onOpen} /></div>
            <div style={{ display:'flex', gap:26, marginBottom:12, flexWrap:'wrap' }}>
              {m.pair.map(([l, v], i) => (
                <div key={i}>
                  <div style={{ fontSize:11, color:C.dim, marginBottom:3 }}>{l}</div>
                  <div style={{ ...M, fontSize:19, color: i ? C.muted : C.accentL }}>{v}</div></div>))}
            </div>
            <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.6, paddingTop:11,
              borderTop:`1px solid ${C.line}` }}>{m.foot}</div>
            <div style={{ display:'flex', gap:7, marginTop:13, flexWrap:'wrap' }}>
              {m.actions.map(a => <button key={a} className="ch-act">{a}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (m.kind === 'decision') return (
    <div className="ch-msg" style={{ paddingTop:12, paddingBottom:12 }}>
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who="nova" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:C.accentL }}>Nova</span>
            <span style={{ ...M, fontSize:10, color:C.dim, letterSpacing:'.08em' }}>· DECISION CAPTURED</span>
            <span style={{ fontSize:11, color:C.dim, marginLeft:'auto' }}>{m.t}</span>
          </div>
          <div style={{ border:`1px solid ${C.line2}`, borderRadius:11, padding:'17px 19px',
            background:C.card }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:15,
              flexWrap:'wrap' }}>
              <span style={{ ...SERIF, fontSize:19 }}>{m.d.title}</span>
              <span style={{ display:'flex', alignItems:'center', gap:9, marginLeft:'auto' }}>
                <span style={{ ...M, fontSize:15, color:C.dim }}>{m.d.from}</span>
                <span style={{ color:C.dim }}>→</span>
                <span style={{ ...M, fontSize:19, color:C.accentL }}>{m.d.to}</span></span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
              gap:16, marginBottom:14 }}>
              {[['Primary thesis', m.d.thesis], ['Risks', m.d.risks]].map(([h, items]) => (
                <div key={h}>
                  <div style={{ ...S, fontSize:11, color:C.dim, letterSpacing:'.08em',
                    textTransform:'uppercase', marginBottom:7 }}>{h}</div>
                  {items.map(x => (
                    <div key={x} style={{ fontSize:12.5, color:C.muted, lineHeight:1.6 }}>· {x}</div>))}
                </div>))}
            </div>
            <div style={{ display:'flex', gap:24, paddingTop:12, borderTop:`1px solid ${C.line}`,
              flexWrap:'wrap' }}>
              {[['Catalyst', m.d.catalyst], ['Owner', m.d.owner]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize:10.5, color:C.dim }}>{l}</div>
                  <div style={{ fontSize:12.5, color:C.muted }}>{v}</div></div>))}
              <div style={{ display:'flex', gap:7, marginLeft:'auto', alignItems:'center' }}>
                {['Save','Edit','Dismiss'].map(a => (
                  <button key={a} className="ch-act" onClick={() => onDecision?.(a, m.id)}>{a}</button>))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (m.kind === 'chart') return (
    <div className="ch-msg" style={{ paddingTop:12, paddingBottom:12 }}>
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who="nova" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:C.accentL }}>Nova</span>
            <span style={{ fontSize:11, color:C.dim, marginLeft:'auto' }}>{m.t}</span>
          </div>
          <div style={{ border:`1px solid ${C.line}`, borderRadius:11, padding:16, background:C.card }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ ...M, fontSize:12.5 }}>{m.title}</span>
              <span style={{ fontSize:11, color:C.dim }}>{m.range}</span>
            </div>
            <MiniChart series={m.series} />
            <div style={{ display:'flex', gap:16, marginTop:12 }}>
              {m.series.map(s => (
                <span key={s.label} style={{ display:'flex', alignItems:'center', gap:6,
                  fontSize:11.5, color:C.muted }}>
                  <span style={{ width:9, height:2, background:s.col }} />{s.label}
                  <span style={{ ...M, color: s.chg >= 0 ? C.up : C.down }}>
                    {s.chg >= 0 ? '+' : ''}{s.chg.toFixed(1)}%</span></span>))}
            </div>
            <div style={{ display:'flex', gap:7, marginTop:13 }}>
              {['Open in Screener','Add Monitor','Sources'].map(a =>
                <button key={a} className="ch-act">{a}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (m.kind === 'research') return (
    <div className="ch-msg" style={{ paddingTop:12, paddingBottom:12 }}>
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who="nova" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:C.accentL }}>Nova</span>
            <span style={{ ...M, fontSize:10, color:C.dim, letterSpacing:'.08em' }}>· SELL-SIDE CHANGES</span>
            <span style={{ fontSize:11, color:C.dim, marginLeft:'auto' }}>{m.t}</span>
          </div>
          <div style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:'hidden',
            background:C.card }}>
            {m.items.map((r, i) => (
              <div key={i} style={{ padding:'13px 16px',
                borderBottom: i < m.items.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                <div style={{ display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{r.firm}</span>
                  <span style={{ fontSize:11.5, color:C.dim }}>{r.analyst}</span>
                  <span style={{ ...M, fontSize:11, padding:'2px 8px', borderRadius:100,
                    background:`${C.accent}1f`, color:C.accentL }}>{r.rating}</span>
                  <span style={{ ...M, fontSize:12, color:C.muted, marginLeft:'auto' }}>{r.pt}</span>
                  <span style={{ fontSize:11, color:C.dim }}>{r.date}</span>
                </div>
                <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.6, marginTop:6 }}>{r.note}</div>
              </div>))}
          </div>
          <div style={{ ...S, fontSize:11, color:C.dim, marginTop:9 }}>
            Analyst views attributed to the originating broker. Informational only.</div>
        </div>
      </div>
    </div>
  );

  if (m.kind === 'file') return (
    <div className="ch-msg">
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who={m.who} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:13.5, fontWeight:600 }}>{p?.name}</span>
            <span style={{ fontSize:11, color:C.dim }}>{m.t}</span>
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'11px 15px',
            border:`1px solid ${C.line}`, borderRadius:10, background:C.card }}>
            <span style={{ ...M, fontSize:10, padding:'4px 7px', borderRadius:5,
              background:C.card2, color:C.muted }}>{m.ext}</span>
            <span>
              <span style={{ fontSize:13, display:'block' }}>{m.name}</span>
              <span style={{ fontSize:11, color:C.accentL }}>● Added to room context</span></span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ch-msg">
      <div style={{ display:'flex', gap:12 }}>
        <Avatar who={m.who} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:3 }}>
            <span style={{ fontSize:13.5, fontWeight:600,
              color: nova ? C.accentL : C.text }}>{nova ? 'Nova' : p?.name}</span>
            {!nova && p?.role && <span style={{ fontSize:11, color:C.dim }}>{p.role}</span>}
            {nova && <span style={{ ...M, fontSize:9.5, padding:'1px 6px', borderRadius:4,
              border:`1px solid ${C.accent}44`, color:C.accentL, letterSpacing:'.06em' }}>AI</span>}
            <span style={{ fontSize:11, color:C.dim }}>{m.t}</span>
          </div>
          {nova
            ? <NovaBody m={m} onOpen={onOpen} />
            : <div style={{ fontSize:14, color:C.text, lineHeight:1.62 }}>
                <Rich text={m.body} onOpen={onOpen} /></div>}
        </div>
      </div>
    </div>
  );
}

/* ── inline chart ── */
function MiniChart({ series, h = 130 }) {
  const W = 620, P = { l:6, r:6, t:8, b:8 };
  const norm = s => {
    const b = s.bars.slice(-60), base = b[0].c;
    return b.map(x => (x.c / base - 1) * 100);
  };
  const all = series.map(norm);
  const lo = Math.min(...all.flat()), hi = Math.max(...all.flat());
  const Y = v => P.t + (1 - (v - lo) / ((hi - lo) || 1)) * (h - P.t - P.b);
  const X = (i, n) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} style={{ display:'block' }}>
      <line x1={P.l} x2={W - P.r} y1={Y(0)} y2={Y(0)} stroke={C.line2} strokeDasharray="3 4" />
      {all.map((vals, i) => (
        <path key={i} d={vals.map((v, j) => `${j ? 'L' : 'M'}${X(j, vals.length)},${Y(v)}`).join(' ')}
          fill="none" stroke={series[i].col} strokeWidth="1.6" />))}
    </svg>
  );
}

/* ── memory panel ── */
function Memory({ room, close }) {
  const mem = MEMORY[room] || MEMORY.NVDA;
  const H = ({ children }) => (
    <div style={{ ...S, fontSize:11, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase',
      color:C.dim, margin:'22px 0 10px' }}>{children}</div>
  );
  return (
    <div style={{ width:328, flexShrink:0, borderLeft:`1px solid ${C.line}`, background:C.bg2,
      display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'13px 18px', borderBottom:`1px solid ${C.line}`, display:'flex',
        alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, fontWeight:600 }}>AI Memory · {room}</span>
        <button onClick={close} style={{ background:'none', border:'none', color:C.dim,
          fontSize:15, cursor:'pointer' }}>✕</button>
      </div>
      <div className="ch-scroll" style={{ overflowY:'auto', padding:'0 18px 26px' }}>
        <div style={{ ...S, fontSize:11.5, color:C.dim, lineHeight:1.6, marginTop:16 }}>
          Accumulated from this room's conversations, decisions and attached research.
        </div>
        <H>Current thesis · bull</H>
        {mem.bull.map(x => (
          <div key={x} style={{ display:'flex', gap:8, padding:'4px 0', fontSize:13, color:C.muted,
            lineHeight:1.55 }}><span style={{ color:C.up }}>+</span>{x}</div>))}
        <H>Current thesis · bear</H>
        {mem.bear.map(x => (
          <div key={x} style={{ display:'flex', gap:8, padding:'4px 0', fontSize:13, color:C.muted,
            lineHeight:1.55 }}><span style={{ color:C.down }}>−</span>{x}</div>))}
        <H>Key catalysts</H>
        {mem.catalysts.map(([n, d]) => (
          <div key={n} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0',
            fontSize:13, color:C.muted }}>{n}<span style={{ ...M, fontSize:11.5, color:C.dim }}>{d}</span></div>))}
        <H>Team views</H>
        {mem.views.map(([n, v, note]) => (
          <div key={n} style={{ padding:'9px 0', borderBottom:`1px solid ${C.line}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <span style={{ fontSize:12.5, fontWeight:600 }}>{n}</span>
              <span style={{ ...M, fontSize:10, padding:'1px 7px', borderRadius:100,
                background: v === 'Bullish' ? `${C.up}22` : C.card2,
                color: v === 'Bullish' ? C.up : C.muted }}>{v}</span></div>
            <div style={{ fontSize:12, color:C.dim, lineHeight:1.5 }}>{note}</div></div>))}
        <H>Previous decisions</H>
        {mem.decisions.map(([d, what, why]) => (
          <div key={d} style={{ padding:'10px 12px', background:C.card, border:`1px solid ${C.line}`,
            borderRadius:9, marginBottom:8 }}>
            <div style={{ ...M, fontSize:10.5, color:C.dim, marginBottom:4 }}>{d}</div>
            <div style={{ fontSize:12.5, color:C.text, marginBottom:4 }}>{what}</div>
            <div style={{ fontSize:11.5, color:C.dim, lineHeight:1.5 }}>{why}</div></div>))}
        <H>Open questions</H>
        {mem.open.map(x => (
          <div key={x} style={{ padding:'6px 0', fontSize:12.5, color:C.muted, lineHeight:1.55 }}>
            · {x}</div>))}
      </div>
    </div>
  );
}

/* ── mocked Nova responder ── */
function novaReply(text, room) {
  const q = text.toLowerCase();
  const t = new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  const syms = (text.match(/\$?[A-Z]{2,5}\b/g) || []).filter(s => TICK[s.replace('$', '')]);

  if (/compare|versus|\bvs\b|valuation/.test(q)) return msg({ who:'nova', t, kind:'ai',
    blocks:[
      { type:'h', text:'Relative valuation' },
      { type:'table', cols:['', 'NVDA', 'AVGO', 'AMD'], rows:[
        ['NTM P/E', '34.2x', '27.8x', '31.4x'],
        ['EV / Sales', '18.1x', '12.4x', '9.7x'],
        ['FCF yield', '2.4%', '3.1%', '1.9%'],
      ] },
      { type:'h', text:'Takeaway' },
      { type:'p', text:'NVDA trades at a 23% NTM P/E premium to AVGO, against a two-year median premium of roughly 41%. High absolute multiple, compressed relative premium.' },
    ], actions:['View Chart','Sources','Add Monitor','Ask Follow-Up'],
    sources:[['Consensus estimates','Refinitiv · 8/26'],['Historical multiples','2y daily, computed']] });

  if (/chart|plot/.test(q)) {
    const a = syms[0]?.replace('$', '') || room || 'NVDA';
    const b = syms[1]?.replace('$', '') || 'SOX';
    const pick = k => TICK[k] || TICK.NVDA;
    return msg({ who:'nova', t, kind:'chart', title:`${a} vs ${b}`, range:'Since last earnings',
      series:[{ label:a, col:C.accentL, bars:pick(a).bars, chg:pick(a).chg * 3.2 },
              { label:b, col:C.muted, bars:pick(b).bars, chg:pick(b).chg * 2.4 }] });
  }

  if (/research|sell-side|rating|target|analyst/.test(q)) return msg({ who:'nova', t, kind:'research',
    items:[
      { firm:'Morgan Stanley', analyst:'J. Moore', rating:'Overweight', pt:'PT 210 → 235', date:'8/25',
        note:'Raises on Blackwell ramp visibility; flags supply as the binding constraint through 1H.' },
      { firm:'Bernstein', analyst:'S. Rasgon', rating:'Outperform', pt:'PT 195 → 215', date:'8/22',
        note:'Sees hyperscaler capex commentary as supportive, but trims China contribution to near zero.' },
      { firm:'UBS', analyst:'T. Arcuri', rating:'Neutral', pt:'PT 180 → 180', date:'8/20',
        note:'Maintains; argues custom silicon share shift is underpriced in 2027 estimates.' },
    ] });

  if (/derisk|semis|check it|expectation|softening/.test(q)) return msg({ who:'nova', t, kind:'ai',
    ctx:'Resolved from the preceding messages — semiconductor tape vs NVDA estimate revisions.',
    blocks:[
      { type:'sig', text:'Expectations appear to be softening despite stable consensus.' },
      { type:'kv', items:[
        ['SOX, 7 sessions', '−4.8%', 'down'], ['NVDA, 7 sessions', '−7.1%', 'down'],
        ['NVDA NTM EPS consensus', '−0.3%', 'flat'], ['Implied volatility', '+4.2 pts', 'up'],
        ['Put/call skew', '91st pctile', 'up'] ] },
      { type:'h', text:'Interpretation' },
      { type:'p', text:'Price and options markets are pricing more downside risk than the earnings-consensus data currently reflects.' },
      { type:'conf', level:'High' },
    ], actions:['Investigate','Chart Signals','Set Alert'] });

  if (/yield|diverg|underperform/.test(q)) return msg({ who:'nova', t, kind:'signal',
    title:'Market signal',
    body:'JPM is underperforming its historical relationship with the 10Y Treasury yield.',
    pair:[['Expected move, 20d sensitivity','+1.2%'],['Actual','+0.2%']],
    foot:'The divergence sits in the 94th percentile of observations over the last year.',
    actions:['Investigate','Show Chart','Mute Signals'] });

  return null;   // caller falls through to the live model
}

const DECISION_RE = /\b(increase|raise|add|trim|cut|reduce|take)\b.{0,40}?\bto\s+(\d+(?:\.\d+)?)\s*%/i;

/* ── search overlay ── */
function ChatSearch({ close, go }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const n = q.toLowerCase();
    const out = [];
    Object.entries(SEED).forEach(([room, ms]) => ms.forEach(m => {
      const hay = (m.body || '') + (m.blocks?.map(b => b.text || '').join(' ') || '') +
        (m.d ? JSON.stringify(m.d) : '') + (m.title || '');
      if (hay.toLowerCase().includes(n) ||
          ['nvda','blackwell','avgo','semis','decision','meta'].some(k => n.includes(k) && hay.toLowerCase().includes(k)))
        out.push({ room, m });
    }));
    return out.slice(0, 8);
  }, [q]);

  return (
    <div onClick={close} style={{ position:'fixed', inset:0, zIndex:400, background:'#00060cc0',
      display:'flex', justifyContent:'center', paddingTop:'11vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(660px,92%)', height:'fit-content',
        maxHeight:'70vh', background:C.bg2, border:`1px solid ${C.line2}`, borderRadius:14,
        overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search people, securities, conversations, decisions, research…"
          style={{ ...S, fontSize:15, padding:'18px 20px', background:'transparent', border:'none',
            borderBottom:`1px solid ${C.line}`, color:C.text, outline:'none' }} />
        <div className="ch-scroll" style={{ overflowY:'auto', padding:'12px 12px 16px' }}>
          {!q.trim() && (
            <>
              <div style={{ ...S, fontSize:11, color:C.dim, letterSpacing:'.1em',
                textTransform:'uppercase', padding:'6px 10px 10px' }}>Try</div>
              {SEARCH_SUGGESTIONS.map(s => (
                <button key={s} className="ch-item" onClick={() => setQ(s)}>
                  <span style={{ color:C.dim, fontSize:12 }}>⌕</span>
                  <span style={{ fontSize:13.5, color:C.muted }}>{s}</span></button>))}
            </>
          )}
          {q.trim() && results.length === 0 && (
            <div style={{ padding:'22px 12px', fontSize:13, color:C.dim }}>
              Nothing matched. Semantic search runs across messages, decisions, files and memory.</div>
          )}
          {results.map(({ room, m }, i) => (
            <button key={i} className="ch-item" onClick={() => { go(room); close(); }}
              style={{ alignItems:'flex-start', padding:'10px' }}>
              <Avatar who={m.who} size={24} />
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'flex', gap:8, alignItems:'baseline', marginBottom:2 }}>
                  <span style={{ fontSize:12.5, fontWeight:600 }}>
                    {m.who === 'nova' ? 'Nova' : PEOPLE[m.who]?.name}</span>
                  <span style={{ ...M, fontSize:10.5, color:C.accentL }}>
                    {ROOMS.find(r => r.id === room)?.k === 'sec' ? '$' : '#'}{room}</span>
                  <span style={{ fontSize:10.5, color:C.dim }}>{m.t}</span></span>
                <span style={{ display:'block', fontSize:12.5, color:C.muted, lineHeight:1.5,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {m.body || m.title || m.blocks?.find(b => b.text)?.text || 'Structured response'}</span>
              </span>
            </button>))}
        </div>
      </div>
    </div>
  );
}

/* ── composer ── */
function ChatComposer({ room, onSend }) {
  const [v, setV] = useState('');
  const [pick, setPick] = useState(null);
  const ref = useRef(null);

  const scan = s => {
    if (/^\/\w*$/.test(s)) return setPick({ t:'/', q:s.slice(1) });
    const m = s.match(/(?:^|\s)([@$])([\w-]*)$/);
    setPick(m ? { t:m[1], q:m[2] } : null);
  };
  const change = e => { setV(e.target.value); scan(e.target.value); };
  const insert = tok => {
    const next = pick.t === '/' ? tok + ' ' : v.replace(/(?:^|\s)([@$])([\w-]*)$/, m0 => m0.startsWith(' ') ? ' ' + tok + ' ' : tok + ' ');
    setV(next); setPick(null); ref.current?.focus();
  };
  const send = () => { if (!v.trim()) return; onSend(v.trim()); setV(''); setPick(null); };

  const opts = !pick ? [] :
    pick.t === '@' ? [...AGENTS.map(a => ({ k:'@' + a.id, l:a.id, d:a.d, ai:true, live:a.live })),
                      ...Object.entries(PEOPLE).filter(([k]) => k !== 'you')
                        .map(([k, p]) => ({ k:'@' + p.name.split(' ')[0], l:p.name, d:p.role, who:k }))]
      .filter(o => o.l.toLowerCase().startsWith(pick.q.toLowerCase())) :
    pick.t === '$' ? Object.entries(TICK).map(([s, d]) => ({ k:'$' + s, l:s, d:d.n, px:d }))
      .filter(o => o.l.startsWith(pick.q.toUpperCase())) :
    CMDS.map(([c, d]) => ({ k:c, l:c, d })).filter(o => o.l.startsWith('/' + pick.q));

  return (
    <div style={{ padding:'12px 22px 18px', borderTop:`1px solid ${C.line}`, position:'relative' }}>
      {pick && opts.length > 0 && (
        <div className="ch-scroll" style={{ position:'absolute', bottom:'100%', left:22, right:22,
          marginBottom:8, maxHeight:250, overflowY:'auto', background:C.card2,
          border:`1px solid ${C.line2}`, borderRadius:11, boxShadow:'0 -10px 40px rgba(0,0,0,.45)',
          zIndex:80 }}>
          <div style={{ ...S, fontSize:10.5, color:C.dim, letterSpacing:'.1em', textTransform:'uppercase',
            padding:'10px 13px 6px' }}>
            {pick.t === '@' ? 'Agents & people' : pick.t === '$' ? 'Securities' : 'Commands'}</div>
          {opts.map(o => (
            <button key={o.k} className="ch-pick" onClick={() => insert(o.k)}>
              {o.ai
                ? <span style={{ width:24, height:24, borderRadius:6, background:C.card,
                    border:`1px solid ${o.live ? C.accent + '66' : C.line2}`, display:'flex',
                    alignItems:'center', justifyContent:'center' }}><NovaMark height={13} /></span>
                : o.who ? <Avatar who={o.who} size={24} />
                : <span style={{ ...M, width:24, textAlign:'center', color:C.dim, fontSize:13 }}>
                    {pick.t === '$' ? '$' : '/'}</span>}
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                  <span style={{ ...(pick.t === '$' ? M : S), fontSize:13, color:C.text }}>{o.l}</span>
                  {o.ai && !o.live && <span style={{ ...M, fontSize:9.5, padding:'1px 6px',
                    borderRadius:4, border:`1px solid ${C.line2}`, color:C.dim }}>SOON</span>}
                </span>
                <span style={{ display:'block', fontSize:11.5, color:C.dim }}>{o.d}</span></span>
              {o.px && <span style={{ textAlign:'right' }}>
                <span style={{ ...M, fontSize:12, display:'block' }}>{o.px.px.toFixed(2)}</span>
                <Num v={o.px.chg} dp={2} size={10} /></span>}
            </button>))}
        </div>
      )}
      <div style={{ background:C.card, border:`1px solid ${C.line2}`, borderRadius:12,
        padding:'6px 8px 6px 6px', display:'flex', alignItems:'flex-end', gap:6 }}>
        {['＋','⌗','$','✦','◉'].map((ic, i) => (
          <button key={i} title={['Attach file','Insert chart','Mention security','Ask Nova','Voice'][i]}
            onClick={() => { const tok = ['', '/chart ', '$', '@Nova ', ''][i];
              if (tok) { setV(x => x + tok); scan(v + tok); ref.current?.focus(); } }}
            style={{ ...S, width:30, height:30, borderRadius:7, background:'transparent',
              border:'none', color:C.dim, cursor:'pointer', fontSize:14, flexShrink:0 }}>{ic}</button>))}
        <textarea ref={ref} value={v} onChange={change} rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === 'Escape') setPick(null); }}
          placeholder={`Message ${room.k === 'sec' ? '$' : room.k === 'dm' ? '' : '#'}${room.n} or ask Nova anything…`}
          style={{ ...S, flex:1, fontSize:14, padding:'8px 4px', background:'transparent',
            border:'none', color:C.text, outline:'none', resize:'none', maxHeight:120,
            fontFamily:'inherit', lineHeight:1.5 }} />
        <button onClick={send} style={{ width:32, height:32, borderRadius:8, flexShrink:0,
          background: v.trim() ? C.accent : C.line2, border:'none',
          cursor: v.trim() ? 'pointer' : 'default' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display:'block', margin:'0 auto' }}>
            <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke={v.trim() ? '#04121B' : C.dim} strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div style={{ ...S, fontSize:10.5, color:C.dim, marginTop:8 }}>
        <b style={{ color:C.muted, fontWeight:600 }}>@</b> agents &amp; people ·{' '}
        <b style={{ color:C.muted, fontWeight:600 }}>$</b> securities ·{' '}
        <b style={{ color:C.muted, fontWeight:600 }}>/</b> commands · plain language works too
      </div>
    </div>
  );
}

/* ── the workspace ── */
function ChatWorkspace({ narrow, prefs }) {
  const [roomId, setRoomId] = useState('NVDA');
  const [threads, setThreads] = useState(() => JSON.parse(JSON.stringify(SEED)));
  const [mem, setMem] = useState(false);
  const [search, setSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [q, setQ] = useState('');
  const end = useRef(null);
  const room = ROOMS.find(r => r.id === roomId) || ROOMS[5];
  const list = threads[roomId] || [];
  const sec = room.k === 'sec' ? TICK[room.n] : null;

  useEffect(() => { end.current?.scrollIntoView({ behavior:'smooth' }); }, [list.length, roomId, busy]);

  const push = (rid, m) => setThreads(t => ({ ...t, [rid]: [...(t[rid] || []), m] }));

  const send = async text => {
    const t = new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
    push(roomId, msg({ who:'you', t, body:text }));

    const dec = text.match(DECISION_RE);
    if (dec) {
      const sym = (text.match(/\$([A-Z]{1,5})/) || [])[1] || room.n;
      setTimeout(() => push(roomId, msg({ who:'nova', t, kind:'decision', d:{
        title:`${sym} position`, from:'2.2%', to:`${dec[2]}%`,
        thesis:['Captured from this conversation','Confirm before it books'],
        risks:['Position limit check pending','Sizing vs 20D ADV not yet run'],
        catalyst:'Earnings', owner:'You' } })), 550);
      return;
    }

    if (!/@nova|^\//i.test(text)) return;

    const canned = novaReply(text, room.n);
    if (canned) { setBusy(true); setTimeout(() => { push(roomId, canned); setBusy(false); }, 700); return; }

    setBusy(true);
    try {
      const out = await askNova({ maxTokens:700,
        system:`You are Nova, an AI participant in a buy-side chat room for ${room.n}. Recent messages:
${list.slice(-6).map(m => `${m.who}: ${m.body || '[structured response]'}`).join('\n')}

Answer as another participant on the desk. Direct, terse, declarative. Short labelled lines, no markdown headers, no preamble. Under 90 words. Reference tickers as $SYM. Resolve pronouns from the conversation above.
${RAILS}`,
        messages:[{ role:'user', content:text.replace(/@Nova/ig, '').trim() }] });
      const txt = out.text;
      push(roomId, msg({ who:'nova', t, kind:'ai',
        blocks:[{ type:'p', text: txt || 'No answer available from current room context.' }],
        actions:['Sources','Ask Follow-Up'],
        sources:[['Room context','this conversation'],
                 ['Desk state', out.source === 'live' ? 'live' : 'offline mock']] }));
    } catch {
      push(roomId, msg({ who:'nova', t, kind:'ai',
        blocks:[{ type:'p', text:'Model call failed — retry, or check the connection.' }] }));
    } finally { setBusy(false); }
  };

  const group = k => ROOMS.filter(r => r.k === k)
    .filter(r => !q || r.n.toLowerCase().includes(q.toLowerCase()));

  const Rail = (
    <div className="ch-scroll" style={{ width:236, flexShrink:0, borderRight:`1px solid ${C.line}`,
      background:C.bg, display:'flex', flexDirection:'column', overflowY:'auto',
      ...(narrow ? { position:'fixed', top:0, bottom:0, left:0, zIndex:320,
        boxShadow:'0 0 60px rgba(0,0,0,.6)' } : { height:'100%' }) }}>
      <div style={{ padding:'13px 14px 10px', display:'flex', gap:8, alignItems:'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
          className="nova-field" style={{ fontSize:12, padding:'7px 11px' }} />
        <button title="New channel" style={{ ...S, width:28, height:28, flexShrink:0, borderRadius:7,
          border:`1px solid ${C.line2}`, background:'transparent', color:C.muted, cursor:'pointer',
          fontSize:15 }}>+</button>
      </div>
      {[['Channels','ch'],['Securities','sec'],['Direct messages','dm']].map(([label, k]) => (
        <div key={k} style={{ padding:'8px 8px 2px' }}>
          <div style={{ ...S, fontSize:10.5, fontWeight:600, letterSpacing:'.1em',
            textTransform:'uppercase', color:C.dim, padding:'6px 10px' }}>{label}</div>
          {group(k).map(r => {
            const on = r.id === roomId;
            const d = r.k === 'sec' ? TICK[r.n] : null;
            return (
              <button key={r.id} className={'ch-item' + (on ? ' on' : '')}
                onClick={() => { setRoomId(r.id); setRailOpen(false); }}>
                {r.k === 'dm'
                  ? <span style={{ position:'relative', display:'flex' }}>
                      <Avatar who={r.who} size={22} />
                      <span style={{ position:'absolute', right:-1, bottom:-1, width:7, height:7,
                        borderRadius:4, background:PEOPLE[r.who].dot,
                        border:`1.5px solid ${C.bg}` }} /></span>
                  : <span style={{ ...M, width:22, textAlign:'center', flexShrink:0,
                      color: r.k === 'sec' ? C.accentL : C.dim,
                      fontSize: r.k === 'sec' ? 12 : 13 }}>{r.k === 'sec' ? '$' : '#'}</span>}
                <span style={{ flex:1, minWidth:0, ...(r.k === 'sec' ? M : S),
                  fontSize: r.k === 'sec' ? 12.5 : 13.5,
                  color: on ? C.text : C.muted, fontWeight: on || r.unread ? 600 : 400,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.n}</span>
                {r.pin && <span style={{ fontSize:9, color:C.dim }}>📌</span>}
                {d && <span style={{ ...M, fontSize:10.5, color: d.chg >= 0 ? C.up : C.down }}>
                  {d.chg >= 0 ? '+' : ''}{d.chg.toFixed(1)}%</span>}
                {r.unread && <span style={{ ...M, fontSize:10, minWidth:17, textAlign:'center',
                  padding:'1px 5px', borderRadius:100, background:C.accent,
                  color:'#04121B', fontWeight:600 }}>{r.unread}</span>}
              </button>);
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', overflow:'hidden' }}>
      <style>{CHAT_CSS}</style>
      {(!narrow || railOpen) && Rail}
      {narrow && railOpen && <div onClick={() => setRailOpen(false)}
        style={{ position:'fixed', inset:0, background:'#00060c90', zIndex:310 }} />}

      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
        {/* header */}
        <div style={{ padding:'11px 22px', borderBottom:`1px solid ${C.line}`, display:'flex',
          alignItems:'center', gap:14, flexWrap:'wrap' }}>
          {narrow && <button onClick={() => setRailOpen(true)} style={{ background:'none',
            border:'none', color:C.muted, fontSize:16, cursor:'pointer', padding:0 }}>☰</button>}
          <div style={{ display:'flex', alignItems:'baseline', gap:10, minWidth:0 }}>
            <span style={{ ...(room.k === 'sec' ? M : S), fontSize:16, fontWeight:600 }}>
              {room.k === 'sec' ? `$${room.n}` : room.k === 'dm' ? room.n : `#${room.n}`}</span>
            {sec && <>
              <span style={{ fontSize:12.5, color:C.dim }}>{sec.n}</span>
              <span style={{ ...M, fontSize:15 }}>{sec.px.toFixed(2)}</span>
              <Num v={sec.chg} dp={2} size={12.5} />
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
                color:C.dim }}>
                <span style={{ width:5, height:5, borderRadius:3, background:C.up }} />Open</span>
            </>}
          </div>
          <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
            <div style={{ display:'flex', marginRight:6 }}>
              {['alex','sarah','mike'].map((w, i) => (
                <span key={w} style={{ marginLeft: i ? -7 : 0, borderRadius:8,
                  border:`2px solid ${C.bg}` }}><Avatar who={w} size={22} /></span>))}
              <span style={{ ...M, fontSize:11, color:C.dim, alignSelf:'center', marginLeft:8 }}>+4</span>
            </div>
            {[['Search', () => setSearch(true)], ['Files', null],
              ['AI Memory', () => setMem(m => !m)], ['⋯', null]].map(([l, fn]) => (
              <button key={l} onClick={fn || undefined} style={{ ...S, fontSize:12, padding:'6px 11px',
                borderRadius:7, cursor:'pointer',
                border:`1px solid ${l === 'AI Memory' && mem ? C.accent : C.line2}`,
                background: l === 'AI Memory' && mem ? `${C.accent}1c` : 'transparent',
                color: l === 'AI Memory' && mem ? C.accentL : C.muted }}>{l}</button>))}
          </div>
        </div>

        {/* messages */}
        <div className="ch-scroll" style={{ flex:1, overflowY:'auto', paddingTop:10 }}>
          {room.k === 'sec' && (
            <div style={{ margin:'6px 22px 14px', padding:'13px 16px', background:C.card,
              border:`1px solid ${C.line}`, borderRadius:11, display:'flex', gap:18,
              alignItems:'center', flexWrap:'wrap' }}>
              <NovaMark height={20} />
              <span style={{ fontSize:12.5, color:C.muted, flex:1, minWidth:180 }}>
                Nova is in this room. It has read every message, decision and file here.</span>
              <button onClick={() => setMem(true)} className="ch-act">Open memory</button>
            </div>
          )}
          {list.map(m => (
            <Row key={m.id} m={m} onOpen={s => ROOMS.some(r => r.id === s) && setRoomId(s)} />
          ))}
          {busy && (
            <div className="ch-msg" style={{ display:'flex', gap:12, alignItems:'center' }}>
              <Avatar who="nova" size={30} />
              <span style={{ fontSize:13, color:C.accentL }}>Nova is working…</span>
            </div>
          )}
          <div ref={end} style={{ height:8 }} />
        </div>

        <ChatComposer room={room} onSend={send} />
      </div>

      {mem && !narrow && <Memory room={room.k === 'sec' ? room.n : 'NVDA'} close={() => setMem(false)} />}
      {search && <ChatSearch close={() => setSearch(false)} go={setRoomId} />}
    </div>
  );
}

/* ═══════════════════ shell ═══════════════════ */
const NAV = [
  { k:'HOME', l:'Home', icon:'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5' },
  { k:'CHAT', l:'Ask Nova', icon:'M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12Z' },
  { k:'ROOMS', l:'Chat', icon:'M8 10h8M8 14h5M4 5h16v11H9l-5 4V5Z' },
  { k:'SKILLS', l:'Skills', icon:'M4 20V8m5 12V4m5 16v-7m5 7V10' },
  { k:'SCREEN', l:'Screener', icon:'M4 6h16M7 12h10M10 18h4' },
];

export default function App() {
  const [user, setUser] = useState(() => store.load('user'));
  const [prefs, setPrefs] = useState(() => store.load('prefs'));
  const [phase, setPhase] = useState(() => store.load('user') ? 'app' : 'firstrun');
  const [view, setView] = useState('HOME');
  const [tkr, setTkr] = useState('MSTR');
  const [skills, setSkills] = useState(() => {
    const saved = store.load('skills');
    const base = BASE_SKILLS.map(s => ({ ...s, enabled: saved?.enabled?.[s.id] ?? true }));
    return saved?.custom?.length ? [...base, ...saved.custom] : base;
  });
  const [sessions, setSessions] = useState(() => store.load('sessions', []));
  const [activeSession, setActiveSession] = useState(null);
  const activeRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [chatKey, setChatKey] = useState(0);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 900);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);

  // Overlay real FINRA/EDGAR short-interest data when the server has it.
  // applyLiveSI mutates the universe in place; the rev bump re-renders.
  const [, setDataRev] = useState(0);
  useEffect(() => {
    fetch('/api/si').then(r => r.json()).then(j => {
      if (j?.live && j.rows && applyLiveSI(j.rows, j.settlement)) setDataRev(v => v + 1);
    }).catch(() => {});
  }, []);

  const hits = q ? DATA.filter(d => d.t.toLowerCase().includes(q.toLowerCase()) ||
    d.n.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  useEffect(() => {
    store.save('skills', {
      enabled: Object.fromEntries(skills.map(s => [s.id, s.enabled !== false])),
      custom: skills.filter(s => String(s.id).startsWith('custom-')),
    });
  }, [skills]);

  const saveSession = msgs => {
    let id = activeRef.current;
    if (!id) { id = `s${Date.now()}`; activeRef.current = id; setActiveSession(id); }
    setSessions(prev => {
      const exists = prev.some(s => s.id === id);
      const title = String(msgs.find(m => m.role === 'user')?.content || 'New chat').slice(0, 44);
      const next = (exists
        ? prev.map(s => s.id === id ? { ...s, msgs, ts:Date.now() } : s)
        : [{ id, title, msgs, ts:Date.now() }, ...prev]).slice(0, 20);
      store.save('sessions', next);
      return next;
    });
  };
  const openSession = s => {
    activeRef.current = s.id; setActiveSession(s.id);
    setChatKey(k => k + 1); setView('CHAT'); setMenu(false);
  };
  const signOut = () => {
    store.clearAll();
    setUser(null); setPrefs(null); setSessions([]); setActiveSession(null);
    activeRef.current = null; setChatKey(k => k + 1); setView('HOME'); setPhase('firstrun');
  };

  const go = t => { setTkr(t); setView('NAME'); setQ(''); setOpen(false); setMenu(false); };
  const fire = p => { setPending(p); setView('CHAT'); setMenu(false); };
  const ask = text => fire({ prompt:text });
  const newChat = () => { activeRef.current = null; setActiveSession(null);
    setChatKey(k => k + 1); setView('CHAT'); setMenu(false); };

  const finish = (u, p) => {
    setUser(u); setPrefs(p);
    store.save('user', u); store.save('prefs', p ?? null);
    if (p?.skills?.length) setSkills(BASE_SKILLS.map(s => ({ ...s, enabled: p.skills.includes(s.name) })));
    setPhase('app');
  };

  const head = (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{CSS}</style>
    </>
  );

  if (phase === 'firstrun') return <>{head}<FirstRun onDone={finish} /></>;

  const initials = (user?.name || 'JM').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const seatLabel = prefs?.seat?.[0] || user?.firm || 'Desk';

  const Sidebar = (
    <div style={{ width:216, flexShrink:0, borderRight:`1px solid ${C.line}`, background:C.bg,
      display:'flex', flexDirection:'column', padding:'16px 12px', gap:6,
      ...(narrow ? { position:'fixed', top:0, bottom:0, left:0, zIndex:300,
        boxShadow:'0 0 60px rgba(0,0,0,.6)' } : { position:'sticky', top:0, height:'100vh' }) }}>
      {/* small logo — top left, in-app */}
      <div style={{ display:'flex', alignItems:'center', padding:'4px 8px 18px' }}>
        <NovaMark height={28} />
        {narrow && <button onClick={() => setMenu(false)} style={{ marginLeft:'auto',
          background:'transparent', border:'none', color:C.dim, fontSize:15, cursor:'pointer' }}>✕</button>}
      </div>
      <button onClick={newChat} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, ...S,
        padding:'10px 12px', background:C.card, border:`1px solid ${C.line2}`, borderRadius:10,
        color:C.text, cursor:'pointer', marginBottom:8 }}>
        <span style={{ color:C.accentL, fontSize:15, lineHeight:1 }}>+</span> New chat</button>
      {NAV.map(n => (
        <button key={n.k} onClick={() => { setView(n.k); setMenu(false); }} style={{ display:'flex', ...S,
          alignItems:'center', gap:11, fontSize:13.5, padding:'9px 12px', borderRadius:9,
          background: view === n.k ? C.card2 : 'transparent', border:'none',
          color: view === n.k ? C.text : C.muted, cursor:'pointer', textAlign:'left',
          fontWeight: view === n.k ? 600 : 400 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d={n.icon} stroke={view === n.k ? C.accentL : C.dim} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" /></svg>
          {n.l}</button>
      ))}
      <div style={{ margin:'14px 8px 6px', fontSize:11, color:C.dim, fontWeight:600,
        textTransform:'uppercase', letterSpacing:1 }}>Sessions</div>
      {sessions.length === 0 && (
        <div style={{ fontSize:11.5, color:C.dim, padding:'2px 12px 6px', lineHeight:1.5 }}>
          Chats save here automatically.</div>
      )}
      {sessions.slice(0, 8).map(s => (
        <button key={s.id} onClick={() => openSession(s)} style={{ fontSize:12.5, padding:'7px 12px',
          borderRadius:8, ...S, background: s.id === activeSession ? C.card : 'transparent',
          border:'none', color: s.id === activeSession ? C.text : C.dim, cursor:'pointer',
          textAlign:'left', overflow:'hidden', textOverflow:'ellipsis',
          whiteSpace:'nowrap' }}>{s.title}</button>
      ))}
      <div style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:10, padding:'10px 8px',
        borderTop:`1px solid ${C.line}` }}>
        <div style={{ width:28, height:28, borderRadius:14, background:`${C.accent}33`,
          border:`1px solid ${C.accent}66`, display:'flex', alignItems:'center', justifyContent:'center',
          ...M, fontSize:10.5, fontWeight:600, color:C.accentL }}>{initials}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis',
            whiteSpace:'nowrap' }}>{user?.name || 'Desk user'}</div>
          <div style={{ fontSize:10.5, color:C.dim, overflow:'hidden', textOverflow:'ellipsis',
            whiteSpace:'nowrap' }}>{seatLabel}</div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ marginLeft:'auto', flexShrink:0,
          background:'transparent', border:`1px solid ${C.line}`, borderRadius:7, color:C.dim,
          cursor:'pointer', fontSize:10, padding:'4px 8px' }}>Sign out</button>
      </div>
    </div>
  );

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, ...S, display:'flex' }}>
      {head}
      {(!narrow || menu) && Sidebar}
      {narrow && menu && <div onClick={() => setMenu(false)} style={{ position:'fixed', inset:0,
        background:'#00071a90', zIndex:290 }} />}

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ position:'sticky', top:0, zIndex:100, background:`${C.bg}f2`,
          backdropFilter:'blur(8px)', borderBottom:`1px solid ${C.line}`, padding:'10px 20px',
          display:'flex', alignItems:'center', gap:12 }}>
          {narrow && <button onClick={() => setMenu(true)} style={{ background:'transparent',
            border:'none', color:C.muted, fontSize:17, cursor:'pointer', padding:0 }}>☰</button>}
          <div style={{ position:'relative', flex:1, maxWidth:340 }}>
            <input value={q} placeholder="Search tickers…" className="nova-field"
              style={{ fontSize:12.5, padding:'8px 13px' }}
              onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter' && hits[0]) go(hits[0].t); if (e.key === 'Escape') setOpen(false); }} />
            {open && hits.length > 0 && (
              <div style={{ position:'absolute', top:40, left:0, right:0, background:C.card2,
                border:`1px solid ${C.line2}`, borderRadius:10, overflow:'hidden', zIndex:60 }}>
                {hits.map(h => (
                  <button key={h.t} onClick={() => go(h.t)} style={{ display:'flex',
                    justifyContent:'space-between', width:'100%', padding:'9px 13px',
                    background:'transparent', border:'none', cursor:'pointer' }}>
                    <span style={{ ...M, fontSize:12, color:C.text }}>{h.t}</span>
                    <span style={{ ...S, fontSize:11, color:C.dim }}>{h.n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span style={{ marginLeft:'auto', fontSize:11, color:C.dim, whiteSpace:'nowrap' }}>
            {LIVE.si
              ? `SI live · FINRA ${LIVE.si.settlement} settle · prices mock`
              : 'Mock data · prototype'}</span>
        </div>

        <div style={{ padding: view === 'ROOMS' ? 0 : '22px 20px' }}>
          {view === 'HOME' && <Home ask={ask} openSkills={() => setView('SKILLS')} go={go}
            narrow={narrow} user={user} prefs={prefs} />}
          {view === 'CHAT' && <Chat pending={pending} clearPending={() => setPending(null)} go={go}
            openSkills={() => setView('SKILLS')} chatKey={chatKey} prefs={prefs}
            initial={sessions.find(s => s.id === activeSession)?.msgs || []}
            onSave={saveSession} />}
          {view === 'ROOMS' && <ChatWorkspace narrow={narrow} prefs={prefs} />}
          {view === 'SKILLS' && <SkillsPage skills={skills} setSkills={setSkills} fire={fire} />}
          {view === 'SCREEN' && <Screen go={go} prefs={prefs} />}
          {view === 'NAME' && <NameView tkr={tkr} />}
        </div>
      </div>
    </div>
  );
}
