// Erfolgshistorie je Routine (FR-012): Jahres-Heatmap, Quoten je Monat und Wochentag, Serien.
import { addDays, stats, weekStats, challenge, historyStart, monthRates, weekdayRates, streaks, weekMonthRates, weekStreaks, weekStart, isWeekly, WEEKDAYS } from '../logic.js';
import { esc, rgba, fmt, plural } from '../ui.js';
import { heatCell } from './card.js';

export const live = true;

export function render(ctx, root, id) {
  const { data, today } = ctx.state;
  const h = data.habits.find(x => x.id === id);
  if (!h) {
    root.innerHTML = '<a class="back" href="#/">‹ Heute</a><div class="state">Diese Routine gibt es nicht (mehr).</div>';
    return;
  }
  const weekly = isWeekly(h);
  const from = historyStart(data, h, today);
  const s = weekly ? weekStats(data, h, today) : stats(data, h, today);
  const ch = challenge(data, h, today);
  const months = weekly ? weekMonthRates(data, h, from, today) : monthRates(data, h, from, today);
  const overall = months.reduce((a, m) => ({ due: a.due + m.due, done: a.done + m.done }), { due: 0, done: 0 });
  const wdays = weekly ? [] : weekdayRates(data, h, from, today);
  const top = (weekly ? weekStreaks(data, h, from, today) : streaks(data, h, from, today)).slice(0, 5);
  const unit = n => (weekly ? plural(n, 'Woche', 'Wochen') : plural(n, 'Tag', 'Tage'));
  const back = h.status !== 'aktiv' ? '#/routinen' : weekly ? '#/woche' : '#/';

  root.innerHTML = `
    <a class="back" href="${back}">‹ ${h.status !== 'aktiv' ? 'Routinen' : weekly ? 'Diese Woche' : 'Heute'}</a>
    <section class="card">
      <div class="top">
        <div class="icon" style="background:${rgba(h.color, .16)}">${esc(h.icon)}</div>
        <div class="info">
          <div class="name">${esc(h.name)}</div>
          <div class="desc">${esc(h.description)}</div>
        </div>
        <a class="iconbtn" href="#/routinen/bearbeiten/${esc(h.id)}" aria-label="Routine bearbeiten">✎</a>
      </div>
      <div class="meta">
        <span>Seit <b>${esc(fmt(from, { day: 'numeric', month: 'long', year: 'numeric' }))}</b></span>
        <span>Ziel <b>${h.target}</b> pro ${weekly ? 'Woche' : 'Tag'}</span>
        <span>${weekly ? '<b>wöchentlich</b>' : h.weekdays && h.weekdays.length ? 'Fällig <b>' + h.weekdays.map(i => WEEKDAYS[i]).join(' ') + '</b>' : '<b>täglich</b>'}</span>
        ${h.status !== 'aktiv' ? `<span><b>archiviert</b>${h.archivedAt ? ' am ' + esc(fmt(h.archivedAt, { day: 'numeric', month: 'short', year: 'numeric' })) : ''}</span>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><b>${s.current}</b><span>in Folge</span></div>
        <div class="stat"><b>${s.best}</b><span>Rekord</span></div>
        <div class="stat"><b>${s.total}</b><span>erfüllte ${weekly ? 'Wochen' : 'Tage'}</span></div>
        <div class="stat"><b>${overall.due ? Math.round(overall.done / overall.due * 100) : 0} %</b><span>Quote gesamt</span></div>
      </div>
      ${ch ? `
        <div class="challenge">
          <div class="label"><span>Challenge ab ${esc(fmt(ch.start, { day: 'numeric', month: 'short' }))}</span><span><b>${ch.done}</b> von ${ch.days} ${weekly ? 'Wochen' : 'Tagen'}${ch.complete ? ' · geschafft' : ''}</span></div>
          <div class="track"><i style="width:${Math.min(100, ch.done / ch.days * 100)}%;background:${h.color}"></i></div>
        </div>` : ''}
    </section>

    <div class="section-title">Letzte 12 Monate</div>
    <section class="card"><div class="year" id="year"></div></section>

    <div class="section-title">Quote je Monat</div>
    <section class="card bars">${months.slice(0, 12).map(m => bar(h, fmt(m.month + '-01', { month: 'short', year: '2-digit' }), m)).join('')}</section>

    ${weekly ? '' : `<div class="section-title">Quote je Wochentag</div>
    <section class="card bars">${wdays.map(w => bar(h, w.name, w)).join('')}</section>`}

    <div class="section-title">Längste Serien</div>
    <section class="card">${top.length ? `<ul class="streaks">${top.map(x => `
      <li><span>${esc(fmt(x.start, { day: 'numeric', month: 'short', year: 'numeric' }))} – ${esc(fmt(x.end, { day: 'numeric', month: 'short', year: 'numeric' }))}</span><b>${unit(x.length)}</b></li>`).join('')}</ul>`
      : `<div class="small">Noch keine erfüllten ${weekly ? 'Wochen' : 'Tage'}.</div>`}</section>`;

  yearGrid(ctx, h, root.querySelector('#year'));
}

function bar(h, label, x) {
  const rate = x.rate === null ? null : x.rate;
  return `<div class="bar"><span>${esc(label)}</span>
    <div class="track"><i style="width:${rate || 0}%;background:${h.color}"></i></div>
    <span class="val">${rate === null ? '–' : rate + ' %'}</span></div>`;
}

/** 53 Wochen bis heute mit Monats- und Wochentagsbeschriftung; bei Wochenroutinen eine Zeile. */
function yearGrid(ctx, h, host) {
  const { today } = ctx.state;
  const weeks = 53;
  const weekly = isWeekly(h);
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  const inner = document.createElement('div');
  inner.className = 'year-inner';

  const wdl = document.createElement('div');
  wdl.className = 'wdl';
  wdl.innerHTML = weekly ? '' : WEEKDAYS.map((n, i) => `<span>${i % 2 === 0 ? n : ''}</span>`).join('');
  if (weekly) wdl.style.gridTemplateRows = 'var(--cell)';

  const right = document.createElement('div');
  const months = document.createElement('div');
  months.className = 'months';
  let last = '';
  for (let w = 0; w < weeks; w++) {
    const d = addDays(start, w * 7);
    const m = d.slice(0, 7);
    const span = document.createElement('span');
    if (m !== last && (w > 0 || d.slice(8) <= '07')) span.textContent = fmt(d, { month: 'short' }).replace('.', '');
    last = m;
    months.appendChild(span);
  }
  const grid = document.createElement('div');
  grid.className = 'grid' + (weekly ? ' week-row' : '');
  if (weekly) for (let w = 0; w < weeks; w++) grid.appendChild(heatCell(ctx, h, addDays(start, w * 7)));
  else for (let i = 0; i < weeks * 7; i++) grid.appendChild(heatCell(ctx, h, addDays(start, i)));
  right.append(months, grid);
  inner.append(wdl, right);
  host.appendChild(inner);
  host.scrollLeft = host.scrollWidth;
}
