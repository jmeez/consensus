# Nova — project memory / context

This file is the working memory for Claude sessions on this repo. Read it first;
update it whenever the project state, decisions, or roadmap change.

## What Nova is

Nova is a side project by John Miesner (johnmiesner1@gmail.com): an AI platform
for public-markets desks (sales & trading / buy-side). Its differentiating idea
is **"crowding, corrected"** — fundamental short interest instead of reported SI:

```
Fundamental SI = (raw SI shares − convert delta hedge) ÷ (float − ETF/passive − insider)
```

Reported SI misstates crowding in both directions (convert-arb hedging inflates
it; passive/insider shares shrink the real float). Nova computes and shows both
lenses everywhere, plus an LLM analyst ("Nova") grounded in the desk's book,
with compliance rails baked into every prompt (informational color only, broker
attribution, timestamps, no fabrication, never re-pitch a held name).

## Current state (as of 2026-08-31)

**Prototype → working v1 scaffold.** No live data, no domain, no users, no
backend database. Everything runs on deterministic mock data (seeded RNG,
16-name equity universe, "as of Aug 22, 2026").

- Originally three standalone JSX files built in claude.ai artifacts (preserved
  verbatim in `prototype/`). `nova.jsx` is an exact subset of `nova-chat.jsx` —
  ignore it; `nova-chat.jsx` was the definitive app.
- This session turned it into a runnable Vite + React project (see Architecture).

## Architecture

```
index.html            Vite entry (dark bg, mark favicon)
src/main.jsx          Hash router: "/" → Site (marketing), "#/app" → App (platform)
src/Site.jsx          Marketing site (from prototype/nova-site.jsx)
src/App.jsx           The platform (from prototype/nova-chat.jsx), ~2700 lines, single file
src/lib/nova.js       Model client: POST /api/nova; falls back to offline mock if no key/server
src/lib/storage.js    Guarded localStorage helpers (prefix "nova.")
server/index.mjs      Node API proxy (@anthropic-ai/sdk) + prod static server for dist/
public/brand/*.png    Logo lockup + mark (extracted from the base64 in the prototypes)
prototype/            Original uploaded artifact files, untouched — provenance only
```

`npm run dev` = Vite (:5173, proxies /api) + node server (:8787).
`npm run build` then `npm start` = production single-process serve.

### App.jsx internal map (section comments in-file)

brand → mock data (SEC universe, genOHLC, factors/rotation) → skills (RAILS,
BASE_SKILLS: 11 desk skills with {param} templating) → primitives → first run
(splash → account → onboarding slides that pre-select skills by seat/mandate) →
Chat ("Ask Nova", STATE() JSON grounding, FOLLOWUPS parsing) → Home (indices,
desk summary, book, connectors) → SkillsPage (browse/run/create skills) →
ProChart (candles/MA/RSI/vol, fib/trend/hline drawing) → Screen (SI scatter +
table, raw vs fundamental lens) → NameView (SI bridge, float composition) →
ChatWorkspace ("Rooms": channels/securities/DMs, seeded threads, structured
Nova blocks, decision capture regex, AI-memory panel, search, $/@// composer)
→ shell (sidebar, sessions, search, view switch).

## LLM integration (decided this session)

- Browser never holds an API key. `src/lib/nova.js` → `POST /api/nova` →
  `server/index.mjs` → Anthropic SDK. No key configured ⇒ proxy returns 503 and
  the client answers from a deterministic offline mock, labeled "offline mock"
  in the UI, so every surface demos without credentials.
- Model: `claude-opus-5` by default (env `NOVA_MODEL` overrides). For opus/fable
  models the proxy sends server-side refusal fallbacks
  (`betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"`) and maps
  `stop_reason: "refusal"` to a polite decline.
- The proxy clamps max_tokens (≤4096), truncates history (last 24 msgs, 20k
  chars each), and only passes role/content through.

## Retention/persistence (decided this session)

localStorage keys (all under `nova.`): `user`, `prefs` (onboarding answers),
`skills` ({enabled map, custom skills}), `sessions` (last 20 chats, real —
replaced the fake hardcoded sidebar list), `demoRequests` (site form). Sign-out
button in the sidebar footer clears all and returns to first-run. Storage reads
and writes are try/catch-guarded.

## Conventions

- Styling: inline style objects + tiny CSS strings; palette in `C`; fonts Inter
  (UI) / Newsreader (display serif) / IBM Plex Mono (numbers) via Google Fonts.
  Dark-only by design. Match this idiom — no Tailwind, no CSS files.
- All figures are mock; the UI labels them ("Mock data · prototype",
  "offline mock"). Keep those labels until live data exists.
- Keep `prototype/` untouched. New work goes in `src/`.
- Git: work on branch `claude/nova-prototype-setup-yl46zg` (repo jmeez/consensus).

## Roadmap (agreed direction: working first version soon)

Near-term candidates, roughly in order of value:
1. **Live prices** — swap genOHLC for a free equities API (e.g. Polygon/Tiingo)
   behind the same server proxy; keep mock as fallback.
2. **Real SI inputs** — FINRA short interest files + 13F/N-PORT parsing to
   compute fundamental SI for real, replacing the hand-set SEC constants.
3. **Streaming responses** in Ask Nova (proxy → SSE) once answers get longer.
4. **Skill runs on schedule** (Morning Email) — needs a job runner + email out.
5. **Auth for real** — accounts are currently client-side make-believe.
6. **Split App.jsx** into modules once churn slows (data / skills / views).

## Session log

- **2026-08-31**: Initial import. Restructured artifact prototype into Vite
  project; added server proxy + offline mock, localStorage persistence, real
  chat sessions, sign-out, site↔app routing, extracted logo PNGs; wrote docs;
  build + headless-browser smoke test pass.
