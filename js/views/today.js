// Heute-Ansicht (FR-001 bis FR-003): Aufbau und Verhalten wie im Prototyp.
import { addDays, weekday, stats, challenge, countOn, targetOn, isDue, todayHabits } from '../logic.js';
import { CHECK, esc, rgba, fmt, cellColor, plural } from '../ui.js';

export const live = true;

export function render(ctx, root) {
  const { data, today } = ctx.state;
  const habits = todayHabits(data, today);
  const notDue = data.habits.filter(h => h.status === 'aktiv' && !isDue(h, today));
  const pending = ctx.store.queueSize();

  root.innerHTML = `
    <header>
      <div>
        <h1>Heute</h1>
        <div class="date">${esc(fmt(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      </div>
      <div class="hdr-right">
        <div class="dayscore" aria-label="Heute erledigt">${habits.map(h => {
          const c = countOn(data, h, today);
          return `<span title="${esc(h.name)}" style="background:${c ? rgba(h.color, c >= h.target ? 1 : .4) : ''}"></span>`;
        }).join('')}</div>
        <a class="iconbtn" href="#/einstellungen" aria-label="Einstellungen">⚙︎</a>
      </div>
    </header>
    ${ctx.state.authError ? '<a class="pill" href="#/einstellungen">Token ungültig: <b>in den Einstellungen neu eingeben</b></a>' : ''}
    ${pending ? `<a class="pill" href="#/einstellungen"><b>${plural(pending, 'Eintrag', 'Einträge')}</b> noch nicht gesendet</a>` : ''}
    ${data.problems && data.problems.length ? `<div class="problems">${plural(data.problems.length, 'Zeile', 'Zeilen')} in „Habits“ nicht lesbar, siehe <a href="#/einstellungen">Einstellungen</a></div>` : ''}
    <main id="habits"></main>
    ${notDue.length ? `<div class="notdue">Heute nicht fällig: ${notDue.map(h => `<a href="#/routine/${esc(h.id)}" style="color:inherit">${esc(h.icon)} ${esc(h.name)}</a>`).join(', ')}</div>` : ''}`;

  const main = root.querySelector('#habits');
  if (!data.habits.length) {
    main.innerHTML = '<div class="state">Noch keine Routinen. <a href="#/routinen" style="color:inherit">Routine anlegen</a></div>';
    return;
  }
  if (!habits.length) {
    main.innerHTML = '<div class="state">Heute ist keine Routine fällig.</div>';
    return;
  }
  const width = main.clientWidth - 32;
  const css = getComputedStyle(document.documentElement);
  const cell = parseFloat(css.getPropertyValue('--cell'));
  const gap = parseFloat(css.getPropertyValue('--gap'));
  const weeks = Math.max(8, Math.floor((width + gap) / (cell + gap)));
  const start = addDays(addDays(today, -weekday(today)), -(weeks - 1) * 7);
  habits.forEach(h => main.appendChild(card(ctx, h, start, weeks)));
}

function card(ctx, h, start, weeks) {
  const { data, today } = ctx.state;
  const count = countOn(data, h, today);
  const s = stats(data, h, today);
  const ch = challenge(data, h, today);
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
      <button class="check" style="${btnStyle}" aria-label="${esc(h.name)} heute abhaken">${btn}</button>
    </div>
    <div class="meta">
      <span>🔥 <b>${s.current}</b> ${s.current === 1 ? 'Tag' : 'Tage'} in Folge</span>
      <span>Rekord <b>${s.best}</b></span>
      <span>30 Tage <b>${s.rate} %</b></span>
      ${next ? `<span>${next}</span>` : ''}
    </div>
    <div class="grid"></div>
    ${ch ? `
      <div class="challenge">
        <div class="label"><span>Challenge</span><span><b>${ch.done}</b> von ${ch.days} Tagen${ch.complete ? ' · geschafft' : ''}</span></div>
        <div class="track"><i style="width:${Math.min(100, ch.done / ch.days * 100)}%;background:${h.color}"></i></div>
      </div>` : ''}`;

  el.querySelector('.check').addEventListener('click', () => ctx.cycle(h, today));

  const grid = el.querySelector('.grid');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    frag.appendChild(heatCell(ctx, h, d));
  }
  grid.appendChild(frag);
  return el;
}

/** Ein Kästchen der Heatmap; Tipp trägt nach (FR-002). Nicht fällige Tage gedämpft (FR-011). */
export function heatCell(ctx, h, d) {
  const { data, today } = ctx.state;
  const c = countOn(data, h, d);
  const target = targetOn(data, h, d);
  const b = document.createElement('button');
  b.className = 'cell' + (d > today ? ' future' : '') + (d === today ? ' today' : '') + (!isDue(h, d) && !c ? ' off' : '');
  const bg = cellColor(h, c, target);
  if (bg) b.style.background = bg;
  b.title = `${fmt(d, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}: ${c}/${target}`;
  b.setAttribute('aria-label', b.title);
  if (d > today || h.status !== 'aktiv') b.tabIndex = -1;
  if (h.status === 'aktiv') b.addEventListener('click', () => ctx.cycle(h, d));
  else b.style.cursor = 'default';
  return b;
}
