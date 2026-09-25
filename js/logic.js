// Reine Logik ohne DOM: Datum, Fälligkeit, Serien, Quoten, Challenge, Historie.
// Alle Datumswerte sind "yyyy-mm-dd"-Strings und werden in UTC gerechnet,
// damit Sommerzeitwechsel keine Tage verschieben (NFR-004).

export const DAY = 86400000;
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const toMs = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const toStr = ms => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => toStr(toMs(s) + n * DAY);
export const weekday = s => (new Date(toMs(s)).getUTCDay() + 6) % 7; // Mo = 0
export const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY);

/** "Heute" in Europe/Berlin, auch offline im Client berechnet. */
export function todayIn(timeZone = 'Europe/Berlin', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const isDue = (h, d) => !h.weekdays || !h.weekdays.length || h.weekdays.includes(weekday(d));
export const countOn = (data, h, d) => (data.entries[h.id] && data.entries[h.id][d]) || 0;
/** Ziel eines Tages: laut Log-Zeile, wenn es vom aktuellen abweicht (ADR-004, Punkt 4). */
export const targetOn = (data, h, d) => (data.targets && data.targets[h.id] && data.targets[h.id][d]) || h.target;
export const isDone = (data, h, d) => { const c = countOn(data, h, d); return c > 0 && c >= targetOn(data, h, d); };
export const nextCount = (count, target) => (count >= target ? 0 : count + 1);

/** Erster Tag, ab dem die Routine zählt: "Angelegt" oder ein früherer Eintrag. */
export function historyStart(data, h, today) {
  let start = h.created && h.created <= today ? h.created : today;
  for (const d of Object.keys(data.entries[h.id] || {})) if (d < start) start = d;
  return start;
}

/**
 * Kennzahlen der Karte (FR-003, FR-011). Nicht fällige Tage zählen nicht in die
 * Quote und brechen keine Serie; ist an einem solchen Tag trotzdem etwas
 * erfüllt, verlängert es die Serie. Heute unerledigt bricht die Serie nicht.
 */
export function stats(data, h, today) {
  const done = d => isDone(data, h, d);
  const start = historyStart(data, h, today);

  let current = 0;
  let d = today;
  if (!done(d)) d = addDays(d, -1);
  while (d >= start) {
    if (done(d)) current++;
    else if (isDue(h, d)) break;
    d = addDays(d, -1);
  }

  let best = 0, run = 0, total = 0;
  for (let x = start; x <= today; x = addDays(x, 1)) {
    if (done(x)) { run++; total++; best = Math.max(best, run); }
    else if (isDue(h, x) && x !== today) run = 0;
  }

  let due30 = 0, done30 = 0;
  for (let i = 0; i < 30; i++) {
    const x = addDays(today, -i);
    if (done(x)) { done30++; due30++; } else if (isDue(h, x)) due30++;
  }
  return { current, best, total, rate: due30 ? Math.round(done30 / due30 * 100) : 0 };
}

/** Challenge ab festem Start (FR-013): erfüllte Tage seit Start, gedeckelt auf die Dauer. */
export function challenge(data, h, today) {
  if (!h.challengeDays) return null;
  let start = h.challengeStart || historyStart(data, h, today);
  if (isWeekly(h)) start = addDays(start, -weekday(start)); // ganze Wochen ab dem Montag der Startwoche
  let n = 0;
  for (const d of Object.keys(data.entries[h.id] || {})) if (d >= start && d <= today && isDone(data, h, d)) n++;
  return { start, days: h.challengeDays, done: Math.min(n, h.challengeDays), complete: n >= h.challengeDays };
}

/** Quote je Monat im Zeitraum [from, to], neuester Monat zuerst. */
export function monthRates(data, h, from, to) {
  const months = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = d.slice(0, 7);
    if (!months.has(key)) months.set(key, { month: key, due: 0, done: 0 });
    const m = months.get(key);
    if (isDone(data, h, d)) { m.done++; m.due++; } else if (isDue(h, d)) m.due++;
  }
  return [...months.values()].reverse().map(m => ({ ...m, rate: m.due ? Math.round(m.done / m.due * 100) : null }));
}

/** Quote je Wochentag (Mo … So) im Zeitraum [from, to]. */
export function weekdayRates(data, h, from, to) {
  const w = WEEKDAYS.map((name, i) => ({ day: i, name, due: 0, done: 0 }));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = w[weekday(d)];
    if (isDone(data, h, d)) { x.done++; x.due++; } else if (isDue(h, d)) x.due++;
  }
  return w.map(x => ({ ...x, rate: x.due ? Math.round(x.done / x.due * 100) : null }));
}

/** Alle Serien im Zeitraum, längste zuerst (bei Gleichstand die neuere). */
export function streaks(data, h, from, to) {
  const list = [];
  let cur = null;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isDone(data, h, d)) {
      if (!cur) cur = { start: d, end: d, length: 0 };
      cur.end = d; cur.length++;
    } else if (isDue(h, d) && d !== to) {
      if (cur) list.push(cur);
      cur = null;
    }
  }
  if (cur) list.push(cur);
  return list.sort((a, b) => b.length - a.length || (b.end > a.end ? 1 : -1));
}

/** Lokale, noch nicht gesendete Werte über eine frische Serverantwort legen. */
export function applyQueue(data, queue) {
  for (const item of Object.values(queue)) {
    const e = data.entries[item.habitId];
    if (!e) continue;
    if (item.count > 0) e[item.date] = item.count; else delete e[item.date];
    if (data.targets && data.targets[item.habitId]) delete data.targets[item.habitId][item.date];
  }
  return data;
}

// ---------- Wochenroutinen (FR-017, ADR-006): ein Eintrag pro Woche, Schlüssel = Montag

export const isWeekly = h => h.rhythm === 'wöchentlich';
export const weekStart = d => addDays(d, -weekday(d));
/** Schlüssel des aktuellen Eintrags: heute bzw. Montag dieser Woche. */
export const entryKey = (h, today) => (isWeekly(h) ? weekStart(today) : today);

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(d) {
  const thu = addDays(weekStart(d), 3);
  const jan4 = thu.slice(0, 4) + '-01-04';
  return 1 + Math.round(daysBetween(weekStart(jan4), weekStart(thu)) / 7);
}

/** Kennzahlen einer Wochenroutine: Serie und Rekord in Wochen, Quote über 12 Wochen. Die laufende Woche bricht nichts. */
export function weekStats(data, h, today) {
  const cur = weekStart(today);
  const start = weekStart(historyStart(data, h, today));
  const done = w => isDone(data, h, w);
  let current = 0;
  let w = done(cur) ? cur : addDays(cur, -7);
  while (w >= start && done(w)) { current++; w = addDays(w, -7); }
  let best = 0, run = 0, total = 0;
  for (let x = start; x <= cur; x = addDays(x, 7)) {
    if (done(x)) { run++; total++; best = Math.max(best, run); }
    else if (x !== cur) run = 0;
  }
  let done12 = 0;
  for (let i = 0; i < 12; i++) if (done(addDays(cur, -7 * i))) done12++;
  return { current, best, total, rate: Math.round(done12 / 12 * 100) };
}

/** Quote je Monat für Wochenroutinen; eine Woche zählt zum Monat ihres Montags. */
export function weekMonthRates(data, h, from, to) {
  const months = new Map();
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    const key = w.slice(0, 7);
    if (!months.has(key)) months.set(key, { month: key, due: 0, done: 0 });
    const m = months.get(key);
    m.due++;
    if (isDone(data, h, w)) m.done++;
  }
  return [...months.values()].reverse().map(m => ({ ...m, rate: m.due ? Math.round(m.done / m.due * 100) : null }));
}

/** Serien erfüllter Wochen, längste zuerst; die laufende Woche bricht keine Serie. */
export function weekStreaks(data, h, from, to) {
  const cur = weekStart(to);
  const list = [];
  let run = null;
  for (let w = weekStart(from); w <= cur; w = addDays(w, 7)) {
    if (isDone(data, h, w)) {
      if (!run) run = { start: w, end: w, length: 0 };
      run.end = w; run.length++;
    } else if (w !== cur) {
      if (run) list.push(run);
      run = null;
    }
  }
  if (run) list.push(run);
  return list.sort((a, b) => b.length - a.length || (b.end > a.end ? 1 : -1));
}

/** Routinen für "Heute": aktive, heute fällige Tagesroutinen, in ihrer Reihenfolge. */
export const todayHabits = (data, today) => data.habits.filter(h => h.status === 'aktiv' && !isWeekly(h) && isDue(h, today));
/** Routinen für "Diese Woche": aktive Wochenroutinen. */
export const weekHabits = data => data.habits.filter(h => h.status === 'aktiv' && isWeekly(h));
