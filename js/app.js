// Einstieg: Zustand, Synchronisierung, Routing.
// Start aus der letzten Antwort (NFR-005), Aktualisierung im Hintergrund,
// Schreiben über die Warteschlange mit 600 ms Ruhe (FR-005).
import { API_URL, USE_GET } from '../config.js';
import { createApi } from './api.js';
import { createStore } from './store.js';
import { todayIn, nextCount, applyQueue, todayHabits, entryKey } from './logic.js';
import { toast, errorText } from './ui.js';
import * as today from './views/today.js';
import * as history from './views/history.js';
import * as manage from './views/manage.js';
import * as settings from './views/settings.js';

const MOCK = new URLSearchParams(location.search).has('mock');
const root = document.getElementById('app');

let storage;
try { storage = window.localStorage; storage.getItem('x'); } catch (e) { storage = null; }
if (MOCK || !storage) {
  const m = new Map();
  storage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
const store = createStore(storage);

let api;
if (MOCK) {
  const { createMockApi } = await import('./mock.js');
  api = createMockApi();
  store.setToken('mock');
} else {
  api = createApi({ url: API_URL, getToken: () => store.token(), useGet: USE_GET });
}

const ctx = {
  store, api,
  state: { data: store.data(), today: todayIn(), authError: false },
  view: null,

  setServerData(data) {
    applyQueue(data, store.queue());
    ctx.state.data = data;
    store.setData(data);
  },
  saveData() { store.setData(ctx.state.data); },
  replaceHabit(h) {
    const list = ctx.state.data.habits;
    const i = list.findIndex(x => x.id === h.id);
    if (i >= 0) list[i] = h; else { list.push(h); ctx.state.data.entries[h.id] = {}; }
    list.sort((a, b) => a.order - b.order);
    ctx.saveData();
  },
  removeHabit(id) {
    ctx.state.data.habits = ctx.state.data.habits.filter(h => h.id !== id);
    delete ctx.state.data.entries[id];
    ctx.saveData();
  },
  rerender: () => route(),
  cycle, flush
};

// ---------- Routing

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);

  if (!store.token() && parts[0] !== 'einrichten') { location.hash = '#/einrichten'; return; }
  if (parts[0] === 'einrichten') return show(null, () => settings.renderSetup(ctx, root));
  if (parts[0] === 'einstellungen') return show(null, () => settings.renderSettings(ctx, root));

  if (!ctx.state.data) {
    root.innerHTML = '<div class="state loading">Lade deine Gewohnheiten …</div>';
    ctx.view = null;
    return;
  }
  if (parts[0] === 'routinen' && parts[1] === 'neu') return show(null, () => manage.renderForm(ctx, root, null, parts[2] === 'woche'));
  if (parts[0] === 'routinen' && parts[1] === 'bearbeiten') return show(null, () => manage.renderForm(ctx, root, parts[2]));
  if (parts[0] === 'routinen') return show(null, () => manage.renderList(ctx, root));
  if (parts[0] === 'routine') return show(() => history.render(ctx, root, parts[1]), null);
  ctx.state.page = parts[0] === 'woche' ? 1 : 0;
  return show(() => today.render(ctx, root), null);
}

/** Live-Ansichten werden bei neuen Daten neu gezeichnet, Formulare nicht. */
function show(liveRender, staticRender) {
  ctx.view = liveRender;
  (liveRender || staticRender)();
}

function render() {
  if (ctx.view) {
    const y = window.scrollY;
    ctx.view();
    window.scrollTo(0, y);
  } else if (root.querySelector(':scope > .state.loading')) {
    // Nur die Ladeanzeige ersetzen. Formulare (Einrichtung, Einstellungen) nie neu
    // zeichnen – sonst geht Getipptes verloren (Befund Browsertest 2026-09-25).
    route();
  }
}

// ---------- Daten

let refreshing = null;
async function refresh() {
  if (!store.token()) return;
  if (refreshing) return refreshing;
  // Zuweisung erst nach dem Start, Freigabe per finally: Eine async-Funktion ohne
  // await läuft synchron durch und würde ein "= null" im Rumpf überholen.
  refreshing = (async () => {
    try {
      const data = await api.data();
      ctx.state.authError = false;
      ctx.setServerData(data);
      // Lade- oder Fehleranzeige ersetzen, sobald Daten da sind
      if (!ctx.view && root.querySelector(':scope > .state')) route();
    } catch (e) {
      if (e.code === 'unauthorized') ctx.state.authError = true;
      if (!ctx.state.data) {
        if (e.code === 'unauthorized') { location.hash = '#/einstellungen'; return; }
        if (!ctx.view && root.querySelector(':scope > .state.loading')) {
          root.innerHTML = `<div class="state">Daten konnten nicht geladen werden.<br>${errorText(e)}<br><br><a href="#/einstellungen" style="color:inherit">Einstellungen</a></div>`;
        }
        return;
      }
      if (e.code !== 'offline') toast(errorText(e));
    } finally {
      ctx.state.today = todayIn();
    }
    render();
  })().finally(() => { refreshing = null; });
  return refreshing;
}

let flushTimer = null;
let flushing = null;

function cycle(h, date) {
  const data = ctx.state.data;
  const e = data.entries[h.id] || (data.entries[h.id] = {});
  const prev = e[date] || 0;
  const next = nextCount(prev, h.target);
  if (next) e[date] = next; else delete e[date];
  if (data.targets && data.targets[h.id]) delete data.targets[h.id][date];
  store.setData(data);
  store.enqueue(h.id, date, next);
  if (navigator.vibrate) navigator.vibrate(8);
  render();
  if (date === entryKey(h, ctx.state.today) && next >= h.target) {
    const btn = root.querySelector(`.card[data-id="${CSS.escape(h.id)}"] .check`);
    if (btn) btn.classList.add('pop');
  }
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 600);
}

/** Sendet die Warteschlange; bleibt bei Netzfehlern liegen und wird später erneut versucht. */
function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    let failedHard = false;
    for (let round = 0; round < 3; round++) {
      const items = Object.values(store.queue());
      if (!items.length || !store.token()) break;
      let stop = false;
      for (const item of items) {
        try {
          await api.setCount(item.habitId, item.date, item.count);
          store.dequeue(item);
        } catch (e) {
          if (['offline', 'unauthorized', 'no_token', 'bad_response', 'server_error', 'error'].includes(e.code)) {
            if (e.code === 'unauthorized') ctx.state.authError = true;
            stop = true;
            break;
          }
          // Fachlich abgelehnt (z. B. archiviert): verwerfen und den Serverstand holen
          store.dequeue(item);
          failedHard = true;
          toast('Nicht gespeichert: ' + errorText(e));
        }
      }
      if (stop) break;
    }
    if (failedHard) await refresh(); else render();
  })().finally(() => { flushing = null; });
  return flushing;
}

// ---------- Ereignisse

window.addEventListener('hashchange', route);
window.addEventListener('online', () => { flush().then(refresh); });
window.addEventListener('offline', render);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  ctx.state.today = todayIn();
  if (!flushTimer && !store.queueSize()) refresh(); else flush();
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

if (!MOCK && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne SW läuft die App trotzdem */ });
}

route();
refresh().then(() => flush());

// Für Tests in der Browserkonsole
window.__ht = { ctx, todayHabits };
