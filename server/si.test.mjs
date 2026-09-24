/* Unit tests for the SI normalizers, using SYNTHETIC fixtures shaped like the
 * FINRA / EDGAR payloads. Run: node --test server/si.test.mjs
 * These fixtures never reach the app — the pipeline serves live data or
 * reports live:false; it never serves fabricated figures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFinra, pickLatestShares } from './si.mjs';

test('normalizeFinra keeps newest record per symbol, converts to millions', () => {
  const rows = normalizeFinra([
    { symbolCode: 'NVDA', settlementDate: '2026-08-31', currentShortPositionQuantity: 250_000_000,
      averageDailyVolumeQuantity: 200_000_000, daysToCoverQuantity: 1.25 },
    { symbolCode: 'NVDA', settlementDate: '2026-09-15', currentShortPositionQuantity: 260_000_000,
      averageDailyVolumeQuantity: 210_000_000, daysToCoverQuantity: 1.24 },
    { symbolCode: 'ZZZZ', settlementDate: '2026-09-15', currentShortPositionQuantity: 1_000_000 },
  ], ['NVDA']);
  assert.deepEqual(Object.keys(rows), ['NVDA']);
  assert.equal(rows.NVDA.settlement, '2026-09-15');
  assert.equal(rows.NVDA.siShares, 260);
  assert.equal(rows.NVDA.adv, 210);
  assert.equal(rows.NVDA.dtc, 1.24);
});

test('normalizeFinra accepts a {data: []} envelope and drops zero-SI rows', () => {
  const rows = normalizeFinra({ data: [
    { symbolCode: 'AMD', settlementDate: '2026-09-15', currentShortPositionQuantity: 0 },
    { symbolCode: 'CAT', settlementDate: '2026-09-15', currentShortPositionQuantity: 12_500_000 },
  ] }, ['AMD', 'CAT']);
  assert.equal(rows.AMD, undefined);
  assert.equal(rows.CAT.siShares, 12.5);
  assert.equal(rows.CAT.adv, null);
  assert.equal(rows.CAT.dtc, null);
});

test('pickLatestShares takes the newest dated fact across units', () => {
  const latest = pickLatestShares({ units: { shares: [
    { end: '2026-06-30', val: 2_400_000_000 },
    { end: '2026-07-31', val: 2_410_000_000 },
    { end: '2026-01-31', val: 2_390_000_000 },
  ] } });
  assert.equal(latest.sharesOut, 2410);
  assert.equal(latest.sharesOutAsOf, '2026-07-31');
});

test('pickLatestShares handles missing/empty facts', () => {
  assert.equal(pickLatestShares({}), null);
  assert.equal(pickLatestShares({ units: { shares: [{ end: '2026-01-01', val: 0 }] } }), null);
});
