// Karte einer Routine und Heatmap-Kästchen, gemeinsam für Tages- und Wochenroutinen.
// Tagesroutinen: Heatmap 7 × n (FR-002). Wochenroutinen: eine Zeile, 1 Kästchen = 1 Woche (FR-017).
import { addDays, weekday, stats, weekStats, challenge, countOn, targetOn, isDue, isWeekly, entryKey, weekStart, isoWeek } from '../logic.js';
import { CHECK, esc, rgba, fmt, cellColor } from '../ui.js';

/** Anzahl Spalten (Wochen), die in die Breite passen – wie im Prototyp. */
export function weeksFitting(width) {
  const css = getComputedStyle(document.documentElement);
  const cell = parseFloat(css.getPropertyValue('--cell'));
  const gap = parseFloat(css.getPropertyValue('--gap'));
  return Math.max(8, Math.floor((width + gap) / (cell + gap)));
}

export function card(ctx, h, weeks) {
  const { data, today } = ctx.state;
  const weekly = isWeekly(h);
  const key = entryKey(h, today);
  const count = countOn(data, h, key);
  const s = weekly ? weekStats(data, h, today) : stats(data, h, today);
  const ch = challenge(data, h, today);
  const unit = n => (weekly ? (n === 1 ? 'Woche' : 'Wochen') : (n === 1 ? 'Tag' : 'Tage'));
  const el = document.createElement('section');
  el.className = 'card';
  el.dataset.id = h.id;

  let btn, btnStyle = '';
  if (count >= h.target) { btn = CHECK; btnStyle = `background:${h.color};color:#fff`; }
  else if (count > 0) { btn = `${count}/${h.target}`; btnStyle = `background:${rgba(h.color, .25)};color:${h.color}`; }
  else btn = h.target > 1 ? `0/${h.target}` : CHECK;

  const steps = h.steps && h.steps.length === h.target ? h.steps : null;
  const next = steps ? (count < h.target ? `Als Nächstes: <b>${esc(steps[count])}</b>` : '<b>Alle erledigt</b>') : '';

  el.innerHTML = `
    <div class="top">
      <div class="icon" style="background:${rgba(h.color, .16)}">${esc(h.icon)}</div>
      <div class="info">
        <div class="name"><a href="#/routine/${esc(h.id)}">${esc(h.name)}</a></div>
        <div class="desc">${esc(h.description)}</div>
      </div>
      <button class="check" style="${btnStyle}" aria-label="${esc(h.name)} ${weekly ? 'diese Woche' : 'heute'} abhaken">${btn}</button>
    </div>
    <div class="meta">
      <span>🔥 <b>${s.current}</b> ${unit(s.current)} in Folge</span>
      <span>Rekord <b>${s.best}</b></span>
      <span>${weekly ? '12 Wochen' : '30 Tage'} <b>${s.rate} %</b></span>
      ${next ? `<span>${next}</span>` : ''}
    </div>
    <div class="grid${weekly ? ' week-row' : ''}"></div>
    ${ch ? `
      <div class="challenge">
        <div class="label"><span>Challenge</span><span><b>${ch.done}</b> von ${ch.days} ${weekly ? 'Wochen' : 'Tagen'}${ch.complete ? ' · geschafft' : ''}</span></div>
        <div class="track"><i style="width:${Math.min(100, ch.done / ch.days * 100)}%;background:${h.color}"></i></div>
      </div>` : ''}`;

  el.querySelector('.check').addEventListener('click', () => ctx.cycle(h, key));

  const grid = el.querySelector('.grid');
  const frag = document.createDocumentFragment();
  if (weekly) {
    const cur = weekStart(today);
    for (let i = weeks - 1; i >= 0; i--) frag.appendChild(heatCell(ctx, h, addDays(cur, -7 * i)));
  } else {
    const start = addDays(addDays(today, -weekday(today)), -(weeks - 1) * 7);
    for (let i = 0; i < weeks * 7; i++) frag.appendChild(heatCell(ctx, h, addDays(start, i)));
  }
  grid.appendChild(frag);
  return el;
}

/** Ein Kästchen; Tipp trägt nach (FR-002). d ist ein Tag bzw. bei Wochenroutinen der Montag. */
export function heatCell(ctx, h, d) {
  const { data, today } = ctx.state;
  const weekly = isWeekly(h);
  const now = entryKey(h, today);
  const c = countOn(data, h, d);
  const target = targetOn(data, h, d);
  const b = document.createElement('button');
  b.className = 'cell' + (d > now ? ' future' : '') + (d === now ? ' today' : '') + (!weekly && !isDue(h, d) && !c ? ' off' : '');
  const bg = cellColor(h, c, target);
  if (bg) b.style.background = bg;
  b.title = weekly
    ? `KW ${isoWeek(d)} (${fmt(d, { day: 'numeric', month: 'numeric' })}–${fmt(addDays(d, 6), { day: 'numeric', month: 'numeric' })}): ${c}/${target}`
    : `${fmt(d, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}: ${c}/${target}`;
  b.setAttribute('aria-label', b.title);
  if (d > now || h.status !== 'aktiv') b.tabIndex = -1;
  if (h.status === 'aktiv') b.addEventListener('click', () => ctx.cycle(h, d));
  else b.style.cursor = 'default';
  return b;
}
