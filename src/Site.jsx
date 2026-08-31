import React, { useState, useEffect } from 'react';
import { load, save } from './lib/storage';

/* ═══════════ brand ═══════════ */
const NOVA_FULL = '/brand/nova-full.png';
const NOVA_MARK = '/brand/nova-mark.png';

const C = {
  bg:'#0A0C10', bg2:'#0E1117', card:'#12161D', card2:'#181D26',
  line:'#222833', line2:'#2E3644',
  accent:'#2E97D3', accentL:'#4FB3E8', deep:'#14507F',
  up:'#2EBD85', down:'#F0616D',
  text:'#ECEEF1', muted:'#9BA5B4', dim:'#636E80',
  // light sections
  lbg:'#F4F5F7', lbg2:'#EAECF0', ltext:'#0C1017', lmuted:'#596373', lline:'#DCDFE5',
};
const S = { fontFamily:"'Inter', system-ui, sans-serif" };
const SERIF = { fontFamily:"'Newsreader', Georgia, serif" };
const M = { fontFamily:"'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const NovaLogo = ({ width = 190 }) => (
  <img src={NOVA_FULL} alt="NOVA" draggable={false} style={{ width, height:'auto', display:'block' }} />
);
const NovaMark = ({ height = 26, dark }) => (
  <img src={NOVA_MARK} alt="NOVA" draggable={false}
    style={{ height, width:'auto', display:'block',
      filter: dark ? 'invert(1) hue-rotate(180deg) saturate(1.5)' : 'none' }} />
);

const CSS = `
@keyframes riseIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
.rise { animation: riseIn .7s cubic-bezier(.2,.7,.3,1) both; }
.nv-field { background:${C.card}; border:1px solid ${C.line}; border-radius:9px; color:${C.text};
  padding:12px 14px; font-size:14px; font-family:inherit; outline:none; width:100%; }
.nv-field:focus { border-color:${C.accent}; }
.nv-field::placeholder { color:${C.dim}; }
.nv-link { color:${C.muted}; text-decoration:none; font-size:13.5px; cursor:pointer; transition:color .15s; }
.nv-link:hover { color:${C.text}; }
.nv-pill { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:100px;
  border:1px solid ${C.line}; background:${C.card}; color:${C.muted}; font-size:12.5px;
  transition:border-color .2s, color .2s; white-space:nowrap; }
.nv-pill:hover { border-color:${C.line2}; color:${C.text}; }
.nv-mod { transition:border-color .25s, background .25s; }
.nv-mod:hover { border-color:${C.line2}; background:${C.card2}; }
@media (prefers-reduced-motion: reduce) { .rise { animation:none } }
`;

/* ═══════════ interactive positioning demo ═══════════ */
const CASES = [
  { t:'MSTR', n:'MicroStrategy', float:21,   etf:4,    ins:3,   si:8,   cd:5.5,
    note:'Two-thirds of the reported short is convert-arb delta hedging. Reads as the most crowded short on the board. Is not.' },
  { t:'PLTR', n:'Palantir',      float:2100, etf:310,  ins:180, si:140, cd:0,
    note:'No converts, heavy passive ownership. Once index funds leave the denominator, crowding is worse than the tape says — the correction runs the other way.' },
  { t:'CVNA', n:'Carvana',       float:105,  etf:22,   ins:45,  si:28,  cd:6,
    note:'Converts and a large insider stake pulling against each other. Modest net revision, but the composition is what drives squeeze risk.' },
  { t:'XOM',  n:'Exxon Mobil',   float:4300, etf:780,  ins:5,   si:60,  cd:0,
    note:'Enormous float, no converts, moderate passive. Barely moves — the control case. If this swung hard, something would be wrong.' },
];

function PositioningDemo() {
  const [i, setI] = useState(0);
  const d = CASES[i];
  const active = d.float - d.etf - d.ins;
  const fund = d.si - d.cd;
  const siRaw = (d.si / d.float) * 100;
  const siFund = (fund / active) * 100;
  const delta = siFund - siRaw;
  const wmax = Math.max(siRaw, siFund) * 1.18;

  const rows = [
    { l:'Reported short ÷ float', v:siRaw, c:C.muted },
    { l:'less convert delta hedge', v:(fund / d.float) * 100, c:C.deep },
    { l:'÷ active float', v:siFund, c:C.accentL },
  ];

  return (
    <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:`1px solid ${C.line}` }}>
        {CASES.map((x, n) => (
          <button key={x.t} onClick={() => setI(n)} style={{ ...M, flex:1, padding:'12px 6px',
            background: i === n ? C.card2 : 'transparent', border:'none',
            borderBottom: i === n ? `2px solid ${C.accent}` : '2px solid transparent',
            color: i === n ? C.text : C.dim, cursor:'pointer', fontSize:12.5,
            fontWeight: i === n ? 600 : 400 }}>{x.t}</button>
        ))}
      </div>
      <div style={{ padding:'22px 24px 24px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', gap:20, marginBottom:22, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, color:C.dim, marginBottom:3 }}>Reported</div>
            <div style={{ ...M, fontSize:32, color:C.dim, textDecoration:'line-through',
              textDecorationThickness:1.5 }}>{siRaw.toFixed(1)}%</div>
          </div>
          <div style={{ ...M, fontSize:17, color:C.dim, paddingBottom:8 }}>→</div>
          <div>
            <div style={{ fontSize:11, color:C.accentL, marginBottom:3 }}>True</div>
            <div style={{ ...M, fontSize:32, color:C.accentL }}>{siFund.toFixed(1)}%</div>
          </div>
          <div style={{ marginLeft:'auto', textAlign:'right' }}>
            <div style={{ fontSize:11, color:C.dim, marginBottom:3 }}>Revision</div>
            <div style={{ ...M, fontSize:20, color: delta > 0 ? C.down : C.up }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp</div>
          </div>
        </div>
        {rows.map(r => (
          <div key={r.l} style={{ marginBottom:11 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12.5, color:C.muted }}>{r.l}</span>
              <span style={{ ...M, fontSize:11.5, color:r.c }}>{r.v.toFixed(2)}%</span>
            </div>
            <div style={{ height:6, background:'#ffffff0d', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:`${Math.max(2, (r.v / wmax) * 100)}%`, height:'100%',
                background:r.c, borderRadius:3, transition:'width .45s cubic-bezier(.2,.7,.3,1)' }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.65, marginTop:18, paddingTop:15,
          borderTop:`1px solid ${C.line}` }}>{d.note}</div>
      </div>
    </div>
  );
}

/* ═══════════ furniture ═══════════ */
const Kicker = ({ children, light }) => (
  <div style={{ fontSize:11.5, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase',
    color: light ? C.lmuted : C.accent, marginBottom:16 }}>{children}</div>
);

const Dark = ({ id, tint, children, pad = 84 }) => (
  <section id={id} style={{ borderTop:`1px solid ${C.line}`,
    background: tint ? C.bg2 : C.bg }}>
    <div style={{ maxWidth:1080, margin:'0 auto', padding:`${pad}px 24px` }}>{children}</div>
  </section>
);
const Light = ({ id, children, alt, pad = 84 }) => (
  <section id={id} style={{ background: alt ? C.lbg2 : C.lbg, color:C.ltext }}>
    <div style={{ maxWidth:1080, margin:'0 auto', padding:`${pad}px 24px` }}>{children}</div>
  </section>
);

/* ═══════════ content ═══════════ */
const MODULES = [
  { n:'Ask', t:'The desk analyst.',
    d:'Grounded in your book, your screens, and live positioning data. It knows what you already hold, so it never pitches your own position back at you. Every answer carries its sources and their vintage.' },
  { n:'Skills', t:'Your method, made repeatable.',
    d:'Instruction sets the desk reuses — idea generation across long, short, pairs, factor and macro, plus client inquiry and the pre-open brief. Write your own, share them, disable what you don\u2019t use.' },
  { n:'Screen', t:'The universe, your way.',
    d:'Crossfilter on positioning, factor exposure, catalyst proximity or liquidity, against raw, beta-adjusted or market-neutral returns. Charting with the drawing tools an analyst actually uses.' },
  { n:'Brief', t:'Work that goes out the door.',
    d:'Scheduled runs land as drafts — the pre-open note routed by coverage, the Sunday idea pass, a client one-pager. Every one reviewed by a human before it sends.' },
];

const COVERAGE = [
  'Equities','Rates & Credit','FX','Commodities','ETFs','Convertibles','Index & Futures','Options',
];
const SOURCES = [
  'Exchange market data','FINRA short interest','SEC EDGAR','N-PORT / 13F','Convertible terms',
  'CFTC positioning','FRED','Earnings calendars','ETF flows','Broker research','Internal book',
  'Client notes','Bloomberg chat','Outlook','Slack','StreetSpread',
];

const SKILLS = [
  ['Idea generation', ['Thematic L/S','Macro L/S','Thematic Long','Thematic Short','Macro Short',
    'Single Name Short','Thematic Factor','Macro Factor']],
  ['Distribution', ['Client Inquiry','Client Reverse Inquiry']],
  ['Team', ['Morning Email']],
];

/* ═══════════ request ═══════════ */
function RequestDemo() {
  const [f, setF] = useState({ name:'', email:'', firm:'', seat:'', size:'', use:'' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const ok = f.name.trim() && /\S+@\S+\.\S+/.test(f.email) && f.firm.trim();

  if (sent) return (
    <div className="rise" style={{ background:C.card, border:`1px solid ${C.accent}55`,
      borderRadius:14, padding:'38px 32px', textAlign:'center' }}>
      <div style={{ display:'flex', justifyContent:'center' }}><NovaMark height={40} /></div>
      <div style={{ ...SERIF, fontSize:26, margin:'20px 0 10px' }}>Request received.</div>
      <p style={{ fontSize:14, color:C.muted, lineHeight:1.68, maxWidth:420, margin:'0 auto' }}>
        We'll come back within a business day. Nova is access-granted — once approved, you'll get a
        sign-in link tied to your work address.
      </p>
      <button onClick={() => { window.location.hash = '#/app'; }} style={{ ...S, marginTop:24,
        fontSize:14, fontWeight:600, padding:'12px 24px', background:C.accent, color:'#04121B',
        border:'none', borderRadius:10, cursor:'pointer' }}>Explore the prototype →</button>
    </div>
  );

  return (
    <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:14, padding:28 }}>
      <div style={{ display:'grid', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12 }}>
          <input className="nv-field" placeholder="Name" value={f.name}
            onChange={e => setF(x => ({ ...x, name:e.target.value }))} />
          <input className="nv-field" placeholder="Work email" type="email" value={f.email}
            onChange={e => setF(x => ({ ...x, email:e.target.value }))} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12 }}>
          <input className="nv-field" placeholder="Firm" value={f.firm}
            onChange={e => setF(x => ({ ...x, firm:e.target.value }))} />
          <select className="nv-field" value={f.seat} style={{ cursor:'pointer',
            color: f.seat ? C.text : C.dim }}
            onChange={e => setF(x => ({ ...x, seat:e.target.value }))}>
            <option value="">Your seat</option>
            {['Analyst','Associate','VP / Trader','Portfolio Manager','Desk Head','Research','COO / Ops','Other']
              .map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <select className="nv-field" value={f.size} style={{ cursor:'pointer',
          color: f.size ? C.text : C.dim }}
          onChange={e => setF(x => ({ ...x, size:e.target.value }))}>
          <option value="">Desk size</option>
          {['Just me','2–5','6–15','16–40','40+'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <textarea className="nv-field" rows={3} value={f.use} style={{ resize:'vertical' }}
          placeholder="What would you want to see in a walkthrough? (optional)"
          onChange={e => setF(x => ({ ...x, use:e.target.value }))} />
        {err && <div style={{ fontSize:12.5, color:C.down }}>{err}</div>}
        <button onClick={() => {
            if (!ok) { setErr('Name, work email, and firm are required.'); return; }
            save('demoRequests', [...load('demoRequests', []), { ...f, ts:Date.now() }]);
            setSent(true);
          }}
          style={{ ...S, fontSize:14.5, fontWeight:600, padding:'14px',
            background: ok ? C.accent : C.line2, color: ok ? '#04121B' : C.dim, border:'none',
            borderRadius:10, cursor: ok ? 'pointer' : 'default' }}>Request a demo</button>
        <div style={{ fontSize:11.5, color:C.dim, lineHeight:1.6 }}>
          Access is issued per email address and can be revoked at any time. We don't sell or share
          what you submit here.
        </div>
      </div>
    </div>
  );
}

/* ═══════════ page ═══════════ */
export default function Site() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 860);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, ...S }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      {/* nav */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:`${C.bg}f0`,
        backdropFilter:'blur(10px)', borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:1080, margin:'0 auto', padding:'14px 24px', display:'flex',
          alignItems:'center', gap:28 }}>
          <NovaMark height={30} />
          {!narrow && (
            <div style={{ display:'flex', gap:24 }}>
              {[['Platform','platform'],['Positioning','positioning'],['Skills','skills'],
                ['Security','security']].map(([l, id]) => (
                <span key={id} className="nv-link" onClick={() => jump(id)}>{l}</span>
              ))}
            </div>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
            <span className="nv-link" onClick={() => { window.location.hash = '#/app'; }}>Sign in</span>
            <button onClick={() => jump('demo')} style={{ ...S, fontSize:13, fontWeight:600,
              padding:'9px 18px', background:C.accent, color:'#04121B', border:'none',
              borderRadius:9, cursor:'pointer' }}>Request a demo</button>
          </div>
        </div>
      </div>

      {/* hero */}
      <div style={{ maxWidth:1080, margin:'0 auto', padding:'92px 24px 76px', textAlign:'center' }}>
        <div className="rise">
          <Kicker>AI for public markets</Kicker>
          <h1 style={{ ...SERIF, fontSize:'clamp(38px,6.4vw,72px)', fontWeight:400, lineHeight:1.06,
            letterSpacing:-1.8, margin:'0 auto 22px', maxWidth:860 }}>
            Purpose-built for the public markets desk.
          </h1>
          <p style={{ fontSize:17, color:C.muted, lineHeight:1.65, maxWidth:620, margin:'0 auto 32px' }}>
            Nova generates ideas, screens them against real positioning and your live book, then turns
            them into client-ready work — across equities, rates, credit, FX and commodities.
          </p>
          <button onClick={() => jump('demo')} style={{ ...S, fontSize:15, fontWeight:600,
            padding:'14px 32px', background:C.accent, color:'#04121B', border:'none',
            borderRadius:10, cursor:'pointer' }}>Request a demo</button>
          <div style={{ marginTop:16 }}>
            <span className="nv-link" onClick={() => { window.location.hash = '#/app'; }}>
              Or open the working prototype →</span>
          </div>
          <div style={{ fontSize:12, color:C.dim, marginTop:16 }}>
            Access-granted · issued per email address
          </div>
        </div>
      </div>

      {/* coverage strip */}
      <Dark tint pad={44}>
        <div style={{ fontSize:11.5, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase',
          color:C.dim, textAlign:'center', marginBottom:22 }}>Coverage</div>
        <div style={{ display:'flex', gap:9, flexWrap:'wrap', justifyContent:'center' }}>
          {COVERAGE.map(c => <span key={c} className="nv-pill">{c}</span>)}
        </div>
      </Dark>

      {/* modules */}
      <Dark id="platform">
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <Kicker>The platform</Kicker>
          <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
            margin:'0 auto 14px', maxWidth:640 }}>Four surfaces, one state.</h2>
          <p style={{ fontSize:15.5, color:C.muted, lineHeight:1.68, maxWidth:600, margin:'0 auto' }}>
            Everything reads the same book and the same data, so the chat, the skills, the screens and
            the scheduled work never disagree with each other.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
          {MODULES.map(m => (
            <div key={m.n} className="nv-mod" style={{ background:C.card,
              border:`1px solid ${C.line}`, borderRadius:14, padding:26 }}>
              <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:14 }}>
                <NovaMark height={22} />
                <span style={{ ...M, fontSize:12, letterSpacing:'.1em', textTransform:'uppercase',
                  color:C.accentL }}>{m.n}</span>
              </div>
              <div style={{ ...SERIF, fontSize:24, marginBottom:11, letterSpacing:-.3 }}>{m.t}</div>
              <div style={{ fontSize:13.5, color:C.muted, lineHeight:1.7 }}>{m.d}</div>
            </div>
          ))}
        </div>
      </Dark>

      {/* why — light */}
      <Light id="why">
        <div style={{ display:'grid', gridTemplateColumns: narrow ? '1fr' : '0.9fr 1.1fr', gap:56 }}>
          <div>
            <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
              margin:'0 0 16px', lineHeight:1.12, color:C.ltext }}>
              By the desk, for the desk.
            </h2>
            <p style={{ fontSize:15.5, color:C.lmuted, lineHeight:1.7, margin:0 }}>
              Generic assistants break on this work because the hard part isn't writing — it's knowing
              which number to trust, what the desk already owns, and what can't leave the building.
            </p>
          </div>
          <div style={{ display:'grid', gap:30 }}>
            {[
              ['Positioning-aware, not just fluent',
               'Ideas are screened against your live book before they reach you. A name you already hold comes back as an add, trim or exit — never as a fresh pitch. Candidates that re-express exposure you already own get flagged or suppressed.'],
              ['Built to the desk\u2019s own method',
               'Skills are written the way your process already works, with the fields a desk actually argues about: sizing against ADV, hedge ratio, carry, what kills it, and the residual exposure once the legs offset.'],
              ['Compliance is the entry ticket',
               'Client-facing output is informational color only, attributed to the originating broker with a date, timestamped, and always a draft to red-line. Nothing sends on its own.'],
              ['It compounds',
               'Every run stores its exact inputs alongside its output, and ideas carry lineage from generation through to position and outcome — so the desk builds a record of what actually got traded and how it did.'],
            ].map(([h, b]) => (
              <div key={h}>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:8, color:C.ltext }}>{h}</div>
                <div style={{ fontSize:14, color:C.lmuted, lineHeight:1.72 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </Light>

      {/* positioning / methodology */}
      <Dark id="positioning">
        <div style={{ display:'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
          gap:52, alignItems:'center' }}>
          <div>
            <Kicker>Positioning</Kicker>
            <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
              margin:'0 0 16px', lineHeight:1.12 }}>
              Crowding you can defend in the meeting.
            </h2>
            <p style={{ fontSize:15.5, color:C.muted, lineHeight:1.7, marginBottom:20 }}>
              Reported short interest misstates crowding in both directions. Convert-arb desks short to
              hedge, and those shares aren't conviction. Index funds and insiders don't lend into a
              squeeze, and those shares aren't supply.
            </p>
            <p style={{ fontSize:15.5, color:C.muted, lineHeight:1.7, marginBottom:24 }}>
              Nova computes the corrected figure and stores every intermediate, so the number is
              auditable rather than asserted. Try it on four names — note that the revision runs
              both ways.
            </p>
            <div style={{ ...M, fontSize:12.5, color:C.dim, lineHeight:1.9,
              padding:'16px 18px', background:C.card, border:`1px solid ${C.line}`, borderRadius:11 }}>
              <span style={{ color:C.accentL }}>True SI</span> ={' '}
              (short <span style={{ color:C.deep }}>− convert hedge</span>) ÷{' '}
              (float <span style={{ color:C.deep }}>− passive − insider</span>)
            </div>
          </div>
          <PositioningDemo />
        </div>
      </Dark>

      {/* skills */}
      <Dark id="skills" tint>
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <Kicker>Skills</Kicker>
          <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
            margin:'0 auto 14px', maxWidth:620 }}>Eleven to start. Then your own.</h2>
          <p style={{ fontSize:15.5, color:C.muted, lineHeight:1.68, maxWidth:600, margin:'0 auto' }}>
            Each skill is an instruction set with its own parameters and output shape, so a first-year
            runs the same process as the desk head.
          </p>
        </div>
        <div style={{ display:'grid', gap:26 }}>
          {SKILLS.map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize:11.5, fontWeight:600, letterSpacing:'.13em',
                textTransform:'uppercase', color:C.dim, marginBottom:13 }}>
                {cat} · {items.length}</div>
              <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
                {items.map(n => <span key={n} className="nv-pill">{n}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Dark>

      {/* time — light stats */}
      <Light alt>
        <div style={{ textAlign:'center', marginBottom:46 }}>
          <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
            margin:'0 auto 14px', color:C.ltext, maxWidth:620 }}>The time it gives back.</h2>
          <p style={{ fontSize:15, color:C.lmuted, lineHeight:1.66, maxWidth:560, margin:'0 auto' }}>
            Measured against how the work gets done today, on a desk running it by hand.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',
          gap:2, background:C.lline, border:`1px solid ${C.lline}`, borderRadius:14, overflow:'hidden' }}>
          {[['20–40 min', 'Client inquiry prep, per name, across market data, research portals and chat'],
            ['60–90 min', 'Pre-open scan across wires, screens and broker notes'],
            ['5 formats', 'Produced from one research pass — chat, email, brief, one-pager, call script'],
            ['1 pass', 'Sunday idea generation, screened against the book before it reaches you']
          ].map(([n, d]) => (
            <div key={n} style={{ background:C.lbg, padding:'28px 24px' }}>
              <div style={{ ...SERIF, fontSize:34, letterSpacing:-1, marginBottom:8,
                color:C.ltext }}>{n}</div>
              <div style={{ fontSize:13, color:C.lmuted, lineHeight:1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </Light>

      {/* sources */}
      <Dark>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <Kicker>Connected</Kicker>
          <h2 style={{ ...SERIF, fontSize:'clamp(26px,3.6vw,38px)', fontWeight:400, letterSpacing:-.9,
            margin:'0 auto 14px', maxWidth:600 }}>Market data, filings, and your own systems.</h2>
          <p style={{ fontSize:15, color:C.muted, lineHeight:1.66, maxWidth:580, margin:'0 auto' }}>
            Every figure carries the date it's effective as of. Where something isn't retrievable, Nova
            names the source it tried rather than filling the gap.
          </p>
        </div>
        <div style={{ display:'flex', gap:9, flexWrap:'wrap', justifyContent:'center' }}>
          {SOURCES.map(s => <span key={s} className="nv-pill">{s}</span>)}
        </div>
      </Dark>

      {/* security */}
      <Dark id="security" tint>
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <Kicker>Security</Kicker>
          <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
            margin:'0 auto 14px', maxWidth:640 }}>Built for a regulated desk, not retrofitted for one.</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:14 }}>
          {[
            ['Access granted per address', 'Accounts are issued against an allowlist and revoked instantly. No public sign-up, and the application is never indexed.'],
            ['Human-in-the-loop on distribution', 'Client-facing work is always a draft to red-line. Nothing sends autonomously — not from the app, not by voice.'],
            ['Informational color only', 'No recommendations, no solicitation language, no price target presented as the desk\u2019s own view. Analyst views attributed to the originating broker.'],
            ['Complete run history', 'Every run stores its exact input snapshot with its output, so a call made months ago can be examined against the data as it stood.'],
            ['Your data stays yours', 'Book and client data is never used to train models and never shared across firms.'],
            ['Deployed where you need it', 'Managed cloud, your own VPC, or on-prem where information-barrier policy requires it.'],
          ].map(([h, b]) => (
            <div key={h} style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:12,
              padding:'20px 22px' }}>
              <div style={{ fontSize:14.5, fontWeight:600, marginBottom:8 }}>{h}</div>
              <div style={{ fontSize:13, color:C.muted, lineHeight:1.65 }}>{b}</div>
            </div>
          ))}
        </div>
      </Dark>

      {/* demo */}
      <Dark id="demo">
        <div style={{ display:'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
          gap:44, alignItems:'start' }}>
          <div>
            <Kicker>Request a demo</Kicker>
            <h2 style={{ ...SERIF, fontSize:'clamp(28px,4vw,42px)', fontWeight:400, letterSpacing:-1,
              margin:'0 0 16px', lineHeight:1.12 }}>See it against your own names.</h2>
            <p style={{ fontSize:15.5, color:C.muted, lineHeight:1.7, marginBottom:32 }}>
              A walkthrough runs about thirty minutes. Bring two or three names you already have a view
              on — the fastest way to judge this is to watch it disagree with your screen and then
              explain why.
            </p>
            <div style={{ display:'grid', gap:22 }}>
              {[['What you\u2019ll see', 'Positioning on names you pick, a live skill run against your mandate, and a scheduled workflow end to end.'],
                ['What we\u2019ll ask', 'How your desk generates ideas today, and where the process actually loses time. It shapes which skills get configured first.'],
                ['After', 'A trial scoped to your desk with your names loaded. Access stays limited to the addresses you nominate.']].map(([h, b]) => (
                <div key={h}>
                  <div style={{ fontSize:14.5, fontWeight:600, marginBottom:7 }}>{h}</div>
                  <div style={{ fontSize:13.5, color:C.muted, lineHeight:1.68 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <RequestDemo />
        </div>
      </Dark>

      {/* footer */}
      <div style={{ borderTop:`1px solid ${C.line}`, background:C.bg2 }}>
        <div style={{ maxWidth:1080, margin:'0 auto', padding:'44px 24px 38px' }}>
          <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
            <div style={{ minWidth:200 }}>
              <NovaLogo width={150} />
            </div>
            <div style={{ display:'flex', gap:44, flexWrap:'wrap', marginLeft:'auto' }}>
              {[['Product', [['Platform','platform'],['Positioning','positioning'],['Skills','skills']]],
                ['Company', [['Security','security'],['Request a demo','demo']]]].map(([h, items]) => (
                <div key={h}>
                  <div style={{ fontSize:11.5, fontWeight:600, letterSpacing:'.12em',
                    textTransform:'uppercase', color:C.dim, marginBottom:12 }}>{h}</div>
                  <div style={{ display:'grid', gap:9 }}>
                    {items.map(([l, id]) => (
                      <span key={id} className="nv-link" style={{ fontSize:13 }}
                        onClick={() => jump(id)}>{l}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11.5, color:C.dim, lineHeight:1.7, marginTop:36, paddingTop:22,
            borderTop:`1px solid ${C.line}` }}>
            Nova · prototype · figures shown are mock data.<br />
            Informational market color only. Not investment advice, and not a solicitation.
          </div>
        </div>
      </div>
    </div>
  );
}
