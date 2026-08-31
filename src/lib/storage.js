/* localStorage helpers — every read/write is guarded, so private windows or
 * blocked storage degrade to in-memory defaults instead of crashing. */
const PREFIX = 'nova.';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
