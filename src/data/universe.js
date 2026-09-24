/* Nova data layer.
 *
 * Mock universe + derived analytics, split out of App.jsx so real data can
 * land here without touching the views. Prices/OHLC are deterministic mocks
 * (seeded RNG, "as of Aug 22, 2026"). Short-interest fields start as mock
 * constants and are OVERLAID with real FINRA/EDGAR figures by applyLiveSI()
 * when the server's /api/si pipeline has data (see server/si.mjs).
 */

const rng = (seed) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const SEC = [
  { t:'NVDA', n:'NVIDIA',            s:'Tech',       beta:1.72, px:118, vol:.022, dr:.055, float:23100, etf:4200, ins:850, si:290, cd:45,  bor:25,  cat:'Earnings 8/27',     pos:null },
  { t:'AMD',  n:'Adv Micro Devices', s:'Tech',       beta:1.85, px:162, vol:.026, dr:.02,  float:1580,  etf:290,  ins:40,  si:95,  cd:18,  bor:30,  cat:'Analyst day 9/3',   pos:null },
  { t:'PLTR', n:'Palantir',          s:'Tech',       beta:2.10, px:31,  vol:.031, dr:.04,  float:2100,  etf:310,  ins:180, si:140, cd:0,   bor:85,  cat:'Lockup 9/12',       pos:'SHORT' },
  { t:'MSTR', n:'MicroStrategy',     s:'Tech',       beta:2.90, px:1340,vol:.041, dr:.01,  float:21,    etf:4,    ins:3,   si:8,   cd:5.5, bor:480, cat:'Convert refi 9/8',  pos:null },
  { t:'COIN', n:'Coinbase',          s:'Financials', beta:2.45, px:207, vol:.035, dr:-.02, float:210,   etf:38,   ins:25,  si:34,  cd:14,  bor:220, cat:'Reg ruling 9/5',    pos:null },
  { t:'JPM',  n:'JPMorgan',          s:'Financials', beta:1.05, px:214, vol:.013, dr:.02,  float:2850,  etf:520,  ins:8,   si:22,  cd:0,   bor:12,  cat:'CCAR f/u 9/4',      pos:'LONG' },
  { t:'XOM',  n:'Exxon Mobil',       s:'Energy',     beta:0.82, px:117, vol:.014, dr:.01,  float:4300,  etf:780,  ins:5,   si:60,  cd:0,   bor:15,  cat:'OPEC 9/1',          pos:null },
  { t:'OXY',  n:'Occidental',        s:'Energy',     beta:1.35, px:58,  vol:.019, dr:.03,  float:780,   etf:145,  ins:250, si:42,  cd:8,   bor:35,  cat:'Divest close 8/29', pos:'LONG' },
  { t:'TSLA', n:'Tesla',             s:'Cons Disc',  beta:2.05, px:238, vol:.033, dr:-.01, float:2700,  etf:480,  ins:410, si:82,  cd:0,   bor:45,  cat:'Deliveries 10/2',   pos:null },
  { t:'CVNA', n:'Carvana',           s:'Cons Disc',  beta:2.80, px:172, vol:.040, dr:.02,  float:105,   etf:22,   ins:45,  si:28,  cd:6,   bor:310, cat:'Earnings 8/28',     pos:null },
  { t:'RIVN', n:'Rivian',            s:'Cons Disc',  beta:2.25, px:13,  vol:.036, dr:-.04, float:900,   etf:160,  ins:40,  si:110, cd:12,  bor:190, cat:'Prod update 9/10',  pos:'SHORT' },
  { t:'LLY',  n:'Eli Lilly',         s:'Health',     beta:0.65, px:812, vol:.016, dr:.03,  float:850,   etf:190,  ins:3,   si:12,  cd:0,   bor:18,  cat:'PDUFA 9/15',        pos:null },
  { t:'MRNA', n:'Moderna',           s:'Health',     beta:1.45, px:74,  vol:.029, dr:-.05, float:380,   etf:72,   ins:20,  si:55,  cd:4,   bor:120, cat:'Data readout 9/9',  pos:null },
  { t:'CAT',  n:'Caterpillar',       s:'Indus',      beta:1.12, px:348, vol:.015, dr:.02,  float:480,   etf:95,   ins:2,   si:14,  cd:0,   bor:14,  cat:'Guide 9/2',         pos:null },
  { t:'FCX',  n:'Freeport',          s:'Materials',  beta:1.55, px:47,  vol:.021, dr:.01,  float:1430,  etf:265,  ins:5,   si:38,  cd:3,   bor:28,  cat:'Copper day 9/3',    pos:null },
  { t:'NEE',  n:'NextEra',           s:'Utilities',  beta:0.55, px:76,  vol:.012, dr:.01,  float:2050,  etf:420,  ins:4,   si:30,  cd:6,   bor:16,  cat:'Rate case 9/11',    pos:null },
];

const N = 120;
const DATES = (() => {
  const out = []; const d = new Date(2026, 7, 21);
  while (out.length < N) { if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(new Date(d)); d.setDate(d.getDate() - 1); }
  return out.map(x => `${x.getMonth()+1}/${x.getDate()}`);
})();

function genOHLC(seed, start, vol, drift) {
  let r = rng(seed), p = start, out = [];
  for (let i = 0; i < N; i++) {
    const o = p;
    const c = Math.max(0.4, o * (1 + (r() - 0.5) * vol * 2 + drift / N));
    const h = Math.max(o, c) * (1 + r() * vol * 0.55);
    const l = Math.min(o, c) * (1 - r() * vol * 0.55);
    out.push({ i, d:DATES[i], o, h, l, c, v:Math.round((0.55 + r()) * 4.2e6) });
    p = c; r = rng(seed + i * 37 + 5);
  }
  return out;
}
const BENCH = genOHLC(7, 545, .009, .06);

const DATA = SEC.map((x, k) => {
  const bars = genOHLC(k * 977 + 13, x.px, x.vol, x.dr);
  const active = x.float - x.etf - x.ins, fund = x.si - x.cd;
  const r = (bars[N-1].c / bars[0].c - 1) * 100;
  const b = (BENCH[N-1].c / BENCH[0].c - 1) * 100;
  return { ...x, bars, active, fund,
    siRaw:(x.si / x.float) * 100, siFund:(fund / active) * 100,
    ret:r, retBeta:r - x.beta * b, retMN:r - b,
    dtc:+(x.si / (x.float * .011)).toFixed(1),
    last:bars[N-1].c, chg:((bars[N-1].c / bars[N-2].c) - 1) * 100 };
});

const IDX = [
  { t:'S&P Futures', v:'6,851.25',  chg:+0.38, bars:genOHLC(31, 6720, .006, .05) },
  { t:'NASDAQ Fut.', v:'25,412.50', chg:+0.30, bars:genOHLC(32, 24800, .008, .05) },
  { t:'US 10Y',      v:'4.18%',     chg:-0.42, bars:genOHLC(33, 4.31, .006, -.03) },
  { t:'VIX',         v:'15.13',     chg:-5.50, bars:genOHLC(34, 17.4, .02, -.13) },
];

const sma = (bars, p) => bars.map((_, i) => i < p - 1 ? null :
  bars.slice(i - p + 1, i + 1).reduce((a, x) => a + x.c, 0) / p);

function rsi(bars, p = 14) {
  const out = Array(bars.length).fill(null);
  if (bars.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = bars[i].c - bars[i-1].c; d > 0 ? g += d : l -= d; }
  let ag = g / p, al = l / p;
  out[p] = 100 - 100 / (1 + ag / (al || 1e-9));
  for (let i = p + 1; i < bars.length; i++) {
    const d = bars[i].c - bars[i-1].c;
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
    out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
  }
  return out;
}

const FACTORS = [
  { f:'Momentum', adj:1.24 }, { f:'Quality', adj:0.71 }, { f:'Growth', adj:0.52 },
  { f:'Low Vol', adj:-0.44 }, { f:'Value', adj:-0.98 },
];
const SECTORS = ['Tech','Financials','Energy','Cons Disc','Health','Indus','Materials','Utilities'];
const ROT = SECTORS.map((s, i) => ({ s, w:[0,1,2,3].map(w => +(((rng(i*53+w*11)() - .45) * 2.6)).toFixed(2)) }));

const SUMMARY = [
  { h:'Reported short interest overstates the MSTR squeeze',
    b:'Reported SI reads 38.1% of float, but roughly two-thirds of the short is convert-arb delta hedging. Net of hedge and over active float, fundamental SI is 17.9% — heavy, not historic. The convert refi on 9/8 is the event that unwinds the technical, not the thesis.' },
  { h:'Momentum extends its lead while value bleeds',
    b:'Risk-adjusted, momentum is +1.24% on the week against value at −0.98%. The spread is stretched versus its 6-month range — and the book is effectively long momentum through where the tech shorts are crowded. Watch for a factor snap around the 9/20 index rebal.' },
  { h:'Energy rotation firming into OPEC 9/1',
    b:'Energy is the strongest risk-adjusted sector rotation over the trailing two weeks. OXY divest close 8/29 and OPEC 9/1 stack catalysts on the long side of the book; positioning remains under-owned versus the 2-year average.' },
  { h:'Lockup calendar is heavy — PLTR 9/12 touches the book',
    b:'PLTR lockup expiry 9/12 sits directly on an existing short. Fundamental SI at 8.7% is higher than the reported 6.7% once passive holders come out of the float — crowding is worse than the tape suggests. Sizing and squeeze risk flagged for the Sunday run.' },
];

const STATE = () => JSON.stringify({
  book: DATA.filter(d => d.pos).map(d => ({ t:d.t, dir:d.pos, sector:d.s, beta:d.beta,
    siRaw:+d.siRaw.toFixed(1), siFund:+d.siFund.toFixed(1), catalyst:d.cat })),
  universe: DATA.map(d => ({ t:d.t, name:d.n, sector:d.s, beta:d.beta, last:+d.last.toFixed(2),
    siRaw:+d.siRaw.toFixed(1), siFund:+d.siFund.toFixed(1), dtc:d.dtc, borrowBps:d.bor,
    retMN:+d.retMN.toFixed(1), catalyst:d.cat })),
  factorScorecard: FACTORS, sectorRotation: ROT, asOf: LIVE.si ? `prices mock 2026-08-22; SI real per FINRA ${LIVE.si.settlement} settle` : '2026-08-22 (mock)',
});
const SOURCES = [
  { n:'Exchange OHLC', d:'8/22 close' }, { n:'FINRA short interest', d:'8/15 settle' },
  { n:'N-PORT / 13F', d:'Q2' }, { n:'Convert terms', d:'filings' }, { n:'Internal book', d:'live' },
];

/* ── live SI overlay ──────────────────────────────────────────────────────
 * rows: { [ticker]: { siShares, adv, dtc, settlement, sharesOut, sharesOutAsOf } }
 * (share counts in millions). Mutates DATA in place — the shell bumps a
 * render counter after calling this. Hand-set ETF/insider/convert components
 * become fractions of the mock float/SI and are re-applied to the real
 * figures, so the SI bridge stays coherent; they are estimates and the UI
 * labels them as such once live data is on.
 */
export const LIVE = { si: null };

export function applyLiveSI(rows, settlement) {
  let applied = 0;
  DATA.forEach(d => {
    const r = rows[d.t];
    if (!r || !(r.siShares > 0) || !(r.sharesOut > 0)) return;
    const etfPct = d.etf / d.float, insPct = d.ins / d.float;
    const cdPct = d.si > 0 ? d.cd / d.si : 0;
    d.float = r.sharesOut; d.si = r.siShares;
    d.etf = etfPct * d.float; d.ins = insPct * d.float; d.cd = cdPct * d.si;
    d.active = d.float - d.etf - d.ins; d.fund = d.si - d.cd;
    d.siRaw = (d.si / d.float) * 100;
    d.siFund = d.active > 0 ? (d.fund / d.active) * 100 : d.siRaw;
    d.dtc = r.dtc > 0 ? +r.dtc.toFixed(1)
      : r.adv > 0 ? +(r.siShares / r.adv).toFixed(1) : d.dtc;
    d.live = { settlement: r.settlement || settlement, sharesOutAsOf: r.sharesOutAsOf };
    applied++;
  });
  if (applied) {
    LIVE.si = { settlement, applied };
    const fin = SOURCES.find(s => s.n === 'FINRA short interest');
    if (fin) fin.d = `${settlement} settle · live`;
    const np = SOURCES.find(s => s.n === 'N-PORT / 13F');
    if (np) np.d = 'estimates';
  }
  return applied;
}

export { rng, SEC, N, DATES, genOHLC, BENCH, DATA, IDX, sma, rsi,
  FACTORS, SECTORS, ROT, SUMMARY, STATE, SOURCES };
