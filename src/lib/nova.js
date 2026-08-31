/* Client for Nova's model calls.
 *
 * All live traffic goes through the server proxy at /api/nova — the browser
 * never holds an API key. When the proxy is unreachable or has no key
 * configured, `askNova` degrades to a deterministic offline mock so every
 * surface of the prototype still demos end-to-end.
 */

let cachedHealth = null;

export async function novaHealth() {
  if (cachedHealth) return cachedHealth;
  try {
    const res = await fetch('/api/health');
    cachedHealth = await res.json();
  } catch {
    cachedHealth = { ok: false, live: false, model: 'offline mock' };
  }
  return cachedHealth;
}

/**
 * @param {{system?: string, messages: {role:string, content:string}[],
 *          maxTokens?: number, followups?: boolean}} opts
 * @returns {Promise<{text: string, model: string, source: 'live'|'mock', refused?: boolean}>}
 */
export async function askNova({ system, messages, maxTokens = 1024, followups = false }) {
  try {
    const res = await fetch('/api/nova', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages, maxTokens }),
    });
    const data = await res.json();
    if (res.ok && data.text) {
      return { text: data.text, model: data.model, source: 'live', refused: data.refused };
    }
    if (res.status === 429) throw Object.assign(new Error(data.message), { fatal: true });
    // 503 no key / other proxy errors → mock below
  } catch (err) {
    if (err.fatal) throw err;
  }
  return { text: mockReply(messages, followups), model: 'offline mock', source: 'mock' };
}

/* ── offline mock ─────────────────────────────────────────────────────────
 * Not a model — a canned desk-flavored response keyed off the question, so
 * the chat surfaces stay usable with no key and no network. */
function mockReply(messages, followups) {
  const q = String(messages[messages.length - 1]?.content || '').toLowerCase();
  let body;
  if (/mstr|squeeze|convert/.test(q)) {
    body = `Call: the MSTR short is technical, not fundamental.
Reported SI: 38.1% of float. Roughly two-thirds is convert-arb delta hedging.
Fundamental SI: 17.9% over active float — heavy, not historic.
Catalyst: convert refi 9/8 unwinds the technical leg.
Risk: borrow at 480bps erodes carry while you wait.
Source: FINRA 8/15 settle; convert terms per filings.`;
  } else if (/overlap|book|position/.test(q)) {
    body = `Three names in the screen touch existing book exposure.
PLTR — held short; lockup 9/12 sits on the position. Fundamental SI 8.7% vs 6.7% reported: more crowded than tape shows.
OXY — held long; divest close 8/29 already in the price per the last two sessions.
JPM — held long; CCAR follow-up 9/4 is the next mark.
No re-pitch on any of the three — flagged as adds/trims only.`;
  } else if (/factor|momentum|value|rotation/.test(q)) {
    body = `Momentum +1.24% risk-adjusted on the week; value −0.98%. Spread is stretched vs its 6-month range.
The book is implicitly long momentum through the crowded tech shorts.
Watch the 9/20 index rebal for a factor snap.
Energy is the firmest sector rotation into OPEC 9/1.`;
  } else {
    body = `Working from the 8/22 snapshot: 16-name universe, 4 positions on.
Highest fundamental crowding: MSTR 17.9%, PLTR 8.7% — both diverge from reported SI, in opposite directions.
Nearest catalysts: OXY divest close 8/29, OPEC 9/1, MSTR refi 9/8, PLTR lockup 9/12.
Ask about a name, the factor scorecard, or book overlap for the detail.
(Offline mock — set ANTHROPIC_API_KEY on the server for live answers.)`;
  }
  if (followups) {
    body += `\nFOLLOWUPS: Where does fundamental SI diverge most from reported? | What does the 9/8 MSTR refi do to the short? | Which catalysts hit the book this week?`;
  }
  return body;
}
