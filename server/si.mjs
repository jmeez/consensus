/* Real short-interest inputs for the Nova universe — free public sources only.
 *
 *   FINRA Query API  (api.finra.org, dataset otcMarket/equityShortInterest)
 *     → bi-weekly reported short interest shares, average daily volume,
 *       days-to-cover, settlement date. Public dataset, no API key
 *       (unauthenticated calls are rate-limited).
 *   SEC EDGAR        (data.sec.gov XBRL company facts)
 *     → latest shares outstanding per company (dei:EntityCommonStockSharesOutstanding),
 *       used as the float denominator. Free; requires a User-Agent with contact.
 *
 * What this makes REAL: raw SI shares, SI % of shares out, ADV, DTC, and their
 * as-of dates. Convert-delta / passive / insider components remain estimates
 * (fractions carried over from the curated mock) until 13F/N-PORT parsing
 * lands — the client labels them "(est.)" accordingly. Never fabricate: on
 * fetch failure this module reports live:false and the app stays on labeled
 * mock data.
 *
 * Results cache to server/cache/si.json (TTL 12h). CLI: `node server/si.mjs`
 * refreshes and prints the table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const UNIVERSE = ['NVDA', 'AMD', 'PLTR', 'MSTR', 'COIN', 'JPM', 'XOM', 'OXY',
  'TSLA', 'CVNA', 'RIVN', 'LLY', 'MRNA', 'CAT', 'FCX', 'NEE'];

const UA = 'Nova prototype (personal research) johnmiesner1@gmail.com';
const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cache', 'si.json');
const TTL_MS = 12 * 60 * 60 * 1000;
const MN = 1e6;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

/* ── FINRA: newest bi-weekly short interest record per symbol ── */
export async function fetchFinra(tickers = UNIVERSE) {
  const body = {
    limit: tickers.length * 4,
    domainFilters: [{ fieldName: 'symbolCode', values: tickers }],
    sortFields: ['-settlementDate'],
  };
  const records = await getJSON(
    'https://api.finra.org/data/group/otcMarket/name/equityShortInterest',
    { method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' } });
  return normalizeFinra(records, tickers);
}

export function normalizeFinra(records, tickers = UNIVERSE) {
  const list = Array.isArray(records) ? records : records?.data || [];
  const out = {};
  for (const r of list) {
    const sym = r.symbolCode || r.issueSymbolIdentifier || r.symbol;
    if (!sym || !tickers.includes(sym)) continue;
    const settle = String(r.settlementDate || r.settlementDt || '');
    if (out[sym] && out[sym].settlement >= settle) continue; // keep newest
    const si = Number(r.currentShortPositionQuantity ?? r.shortInterest);
    const adv = Number(r.averageDailyVolumeQuantity ?? r.averageDailyVolume);
    const dtc = Number(r.daysToCoverQuantity ?? r.daysToCover);
    if (!(si > 0)) continue;
    out[sym] = {
      siShares: si / MN,
      adv: adv > 0 ? adv / MN : null,
      dtc: dtc > 0 ? dtc : null,
      settlement: settle,
    };
  }
  return out;
}

/* ── EDGAR: latest shares outstanding per ticker ── */
export async function fetchEdgarShares(tickers = UNIVERSE) {
  const map = await getJSON('https://www.sec.gov/files/company_tickers.json');
  const byTicker = {};
  for (const row of Object.values(map)) byTicker[row.ticker] = row.cik_str;
  const out = {};
  for (const t of tickers) {
    const cik = byTicker[t];
    if (cik == null) continue;
    try {
      const facts = await getJSON(
        `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, '0')}` +
        `/dei/EntityCommonStockSharesOutstanding.json`);
      const latest = pickLatestShares(facts);
      if (latest) out[t] = latest;
    } catch (e) {
      out[t] = { error: String(e.message || e) };
    }
    await sleep(120); // stay well under EDGAR's 10 req/s fair-access limit
  }
  return out;
}

export function pickLatestShares(facts) {
  const entries = Object.values(facts?.units || {}).flat();
  let best = null;
  for (const e of entries) {
    if (!(e?.val > 0) || !e.end) continue;
    if (!best || e.end > best.end) best = e;
  }
  return best ? { sharesOut: best.val / MN, sharesOutAsOf: best.end } : null;
}

/* ── combined, cached ── */
export async function getSI({ forceRefresh = false } = {}) {
  const cached = readCache();
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const errors = [];
  let finra = {}, edgar = {};
  try { finra = await fetchFinra(); }
  catch (e) { errors.push(`FINRA: ${e.message || e}`); }
  try { edgar = await fetchEdgarShares(); }
  catch (e) { errors.push(`EDGAR: ${e.message || e}`); }

  const rows = {};
  let settlement = '';
  for (const t of UNIVERSE) {
    const f = finra[t], s = edgar[t];
    if (!f || !s?.sharesOut) continue;
    rows[t] = { ...f, sharesOut: s.sharesOut, sharesOutAsOf: s.sharesOutAsOf };
    if (f.settlement > settlement) settlement = f.settlement;
  }
  for (const [t, s] of Object.entries(edgar)) {
    if (s?.error) errors.push(`EDGAR ${t}: ${s.error}`);
  }

  const live = Object.keys(rows).length > 0;
  if (!live && cached) {
    // Sources unreachable — serve the last good snapshot, marked stale.
    return { ...cached, stale: true, errors: [...(cached.errors || []), ...errors] };
  }
  const result = { live, fetchedAt: Date.now(), settlement, rows, errors };
  if (live) writeCache(result);
  return result;
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return null; }
}
function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
  } catch {}
}

/* ── CLI: node server/si.mjs [--cached] ── */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = await getSI({ forceRefresh: !process.argv.includes('--cached') });
  console.log(`live: ${res.live}${res.stale ? ' (stale cache)' : ''}  settlement: ${res.settlement || '—'}`);
  if (res.errors?.length) console.log('errors:\n  ' + res.errors.join('\n  '));
  const rows = Object.entries(res.rows || {});
  if (rows.length) {
    console.log('ticker   SI(mn)    ADV(mn)  DTC   settle      sharesOut(mn)  asOf');
    for (const [t, r] of rows) {
      console.log(`${t.padEnd(8)} ${String(r.siShares?.toFixed(1)).padEnd(9)} ${String(r.adv?.toFixed(1) ?? '—').padEnd(8)} ${String(r.dtc ?? '—').padEnd(5)} ${String(r.settlement).padEnd(11)} ${String(r.sharesOut?.toFixed(0)).padEnd(14)} ${r.sharesOutAsOf}`);
    }
  }
}
