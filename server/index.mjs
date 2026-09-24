/* Nova API proxy.
 *
 * The browser never talks to Anthropic directly — it POSTs to /api/nova and
 * this process holds the key. In dev, Vite proxies /api here (see
 * vite.config.js); in production this same process also serves dist/.
 *
 * With no ANTHROPIC_API_KEY set, /api/nova returns 503 and the client falls
 * back to its offline mock, so the prototype stays demoable without a key.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { getSI } from './si.mjs';

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.NOVA_MODEL || 'claude-opus-5';
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const client = HAS_KEY ? new Anthropic() : null;

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json',
};

const readBody = req => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => resolve(data));
  req.on('error', reject);
});

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function handleNova(req, res) {
  if (!HAS_KEY) {
    return json(res, 503, { error: 'no_api_key',
      message: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }
  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch { return json(res, 400, { error: 'bad_json' }); }

  const { system, messages, maxTokens } = payload || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(res, 400, { error: 'bad_request', message: 'messages[] required' });
  }

  try {
    const request = {
      model: MODEL,
      max_tokens: Math.min(Number(maxTokens) || 1024, 4096),
      system: typeof system === 'string' ? system : undefined,
      // Only role/content pass through — nothing else from the browser.
      messages: messages.slice(-24).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 20000),
      })),
    };
    // Server-side refusal fallbacks (beta): if the primary model declines for
    // safety-classifier reasons, the API re-runs the request on a fallback.
    const response = /^claude-(opus-5|fable-5)/.test(MODEL)
      ? await client.beta.messages.create({
          ...request, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(request);

    if (response.stop_reason === 'refusal') {
      return json(res, 200, {
        text: 'Nova declined to answer that one. Rephrase, or narrow the ask.',
        model: response.model, refused: true,
      });
    }
    const text = response.content
      .filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return json(res, 200, { text, model: response.model, usage: response.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return json(res, 502, { error: 'auth', message: 'Invalid ANTHROPIC_API_KEY.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json(res, 429, { error: 'rate_limited', message: 'Rate limited — retry shortly.' });
    }
    if (err instanceof Anthropic.APIError) {
      return json(res, 502, { error: 'api_error', message: err.message, status: err.status });
    }
    console.error(err);
    return json(res, 500, { error: 'server_error' });
  }
}

function serveStatic(req, res) {
  const url = (req.url || '/').split('?')[0];
  let file = path.join(dist, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(dist, 'index.html'); // SPA fallback
  }
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not built — run npm run build'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api/nova') && req.method === 'POST') return handleNova(req, res);
  if (req.url?.startsWith('/api/si')) {
    try {
      return json(res, 200, await getSI({ forceRefresh: req.url.includes('refresh=1') }));
    } catch (err) {
      console.error(err);
      return json(res, 200, { live: false, errors: [String(err.message || err)] });
    }
  }
  if (req.url?.startsWith('/api/health')) {
    return json(res, 200, { ok: true, model: MODEL, live: HAS_KEY });
  }
  if (process.env.NODE_ENV === 'production') return serveStatic(req, res);
  json(res, 404, { error: 'not_found' });
}).listen(PORT, () => {
  console.log(`Nova API proxy on :${PORT} — model ${MODEL}, key ${HAS_KEY ? 'set' : 'MISSING (mock mode)'}`);
});
