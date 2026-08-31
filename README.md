<p align="center">
  <img src="public/brand/nova-full.png" alt="Nova" width="260" />
</p>

# Nova — AI for public markets

Nova is a prototype platform for public-markets desks. Its core idea is
**crowding, corrected**: reported short interest misstates how crowded a name
really is, so Nova computes **fundamental SI** and shows both lenses everywhere:

```
Fundamental SI = (raw SI − convert delta hedge) ÷ (float − ETF/passive − insider)
```

On top of that sits an LLM analyst ("Nova") grounded in the desk's book and
screen, eleven reusable desk skills (idea generation, client inquiry, morning
email…), a screener, charting, and a team chat workspace where Nova participates
in rooms.

> **Status: prototype.** All market data is deterministic mock data (as of
> Aug 22, 2026). No live feeds, no real accounts. See `CLAUDE.md` for the full
> project state and roadmap.

## Running it

```bash
npm install
npm run dev        # web on :5173, API proxy on :8787
```

Open http://localhost:5173 — the marketing site is at `/`, the platform at
`#/app` (Sign in on the site takes you there).

### Live model answers (optional)

Without a key, Nova answers from a built-in offline mock (labeled as such in
the UI). For live answers, give the **server** an Anthropic key:

```bash
cp .env.example .env       # then set ANTHROPIC_API_KEY
ANTHROPIC_API_KEY=sk-... npm run dev
```

The key stays on the server (`server/index.mjs`); the browser only ever calls
`/api/nova`. Model defaults to `claude-opus-5` (`NOVA_MODEL` to override).

### Production

```bash
npm run build
ANTHROPIC_API_KEY=sk-... npm start   # serves dist/ + API on :8787
```

## Layout

| Path | What |
|---|---|
| `src/App.jsx` | The platform: onboarding, Ask Nova, Rooms, Skills, Screener, single-name view |
| `src/Site.jsx` | Marketing site with interactive positioning demo |
| `src/lib/nova.js` | Model client (proxy call + offline mock fallback) |
| `server/index.mjs` | Claude API proxy + production static server |
| `prototype/` | The original artifact prototype files, preserved verbatim |
| `CLAUDE.md` | Project memory: state, decisions, architecture map, roadmap |

## Compliance posture

Every model prompt carries the desk rails: informational market color only, no
recommendations or solicitation, broker-attributed views, timestamped data, no
fabricated figures, and never re-pitching a name already in the book. Client-
facing output is always a draft for a human to red-line.
