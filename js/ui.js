// Gemeinsame Helfer für die Ansichten (aus dem Prototyp übernommen).
import { toMs } from './logic.js';

export const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export const PALETTE = ['#34c77b', '#a77bf3', '#3d9bff', '#ffb020', '#ff6b6b', '#ff8fb1', '#2ec4b6', '#7c83fd', '#f4d35e', '#9aa0a6'];

export const fmt = (s, opts) => new Date(toMs(s)).toLocaleDateString('de-DE', Object.assign({ timeZone: 'UTC' }, opts));
export const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Farbe eines Heatmap-Kästchens wie im Prototyp. */
export function cellColor(h, count, target) {
  if (!count) return '';
  return rgba(h.color, count >= target ? 1 : .25 + .5 * count / target);
}

/** Rückmeldung unten; rot nur bei Fehlern, sonst neutral (kind = 'ok'). */
export function toast(msg, kind) {
  const t = document.getElementById('toast');
  t.textContent = typeof msg === 'string' ? msg : (msg.message || String(msg));
  t.classList.toggle('ok', kind === 'ok');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 4000);
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Meldungen der API in Klartext. */
export function errorText(e) {
  const map = {
    offline: 'Keine Verbindung',
    unauthorized: 'Token ungültig oder erneuert',
    no_token: 'Kein Token eingerichtet',
    has_entries: 'Die Routine hat Einträge und kann nur archiviert werden',
    archived: 'Die Routine ist archiviert',
    rhythm_locked: 'Der Rhythmus lässt sich nur ändern, solange die Routine keine Einträge hat',
    bad_response: 'Unerwartete Antwort der API'
  };
  return map[e && e.code] || (e && e.message) || 'Unbekannter Fehler';
}
