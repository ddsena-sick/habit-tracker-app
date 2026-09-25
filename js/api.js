// Zugriff auf die Apps-Script-API. POST als text/plain ohne eigene Header,
// damit kein CORS-Preflight entsteht; Erfolg steht in `ok`, nicht im HTTP-Status.

export class ApiError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export function createApi({ url, getToken, useGet = false, fetchFn = (...a) => fetch(...a), timeoutMs = 20000 }) {
  async function call(action, params = {}, { write = false, token } = {}) {
    const t = token || getToken();
    if (!t) throw new ApiError('no_token');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      if (write && !useGet) {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ token: t, action }, params)),
          signal: ctrl && ctrl.signal
        });
      } else {
        const q = new URLSearchParams({ action, token: t });
        for (const [k, v] of Object.entries(params)) q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        res = await fetchFn(url + '?' + q.toString(), { signal: ctrl && ctrl.signal });
      }
    } catch (e) {
      throw new ApiError('offline', 'Keine Verbindung');
    } finally {
      if (timer) clearTimeout(timer);
    }
    let body;
    try { body = await res.json(); } catch (e) { throw new ApiError('bad_response', 'Unerwartete Antwort der API'); }
    if (!body || body.ok !== true) throw new ApiError((body && body.error) || 'error', body && body.message);
    return body;
  }

  return {
    data: opts => call('data', {}, opts),
    setCount: (habitId, date, count) => call('setCount', { habitId, date, count }, { write: true }),
    saveHabit: habit => call('saveHabit', { habit }, { write: true }),
    archiveHabit: id => call('archiveHabit', { id }, { write: true }),
    restoreHabit: id => call('restoreHabit', { id }, { write: true }),
    reorderHabits: ids => call('reorderHabits', { ids }, { write: true }),
    deleteHabit: id => call('deleteHabit', { id }, { write: true })
  };
}
