// Seite "Diese Woche" (FR-017): Wochenroutinen mit derselben Karte, Heatmap als eine Zeile.
import { weekStart, addDays, isoWeek, countOn, weekHabits } from '../logic.js';
import { esc, rgba, fmt } from '../ui.js';
import { card, weeksFitting } from './card.js';

export function header(ctx) {
  const { data, today } = ctx.state;
  const mon = weekStart(today);
  const sun = addDays(mon, 6);
  const range = mon.slice(0, 7) === sun.slice(0, 7)
    ? `${fmt(mon, { day: 'numeric' })}.–${fmt(sun, { day: 'numeric', month: 'long' })}`
    : `${fmt(mon, { day: 'numeric', month: 'short' })} – ${fmt(sun, { day: 'numeric', month: 'short' })}`;
  const habits = weekHabits(data);
  return `
    <header>
      <div>
        <h1>Diese Woche</h1>
        <div class="date">KW ${isoWeek(today)} · ${esc(range)}</div>
      </div>
      <div class="hdr-right">
        <div class="dayscore" aria-label="Diese Woche erledigt">${habits.map(h => {
          const c = countOn(data, h, mon);
          return `<span title="${esc(h.name)}" style="background:${c ? rgba(h.color, c >= h.target ? 1 : .4) : ''}"></span>`;
        }).join('')}</div>
        <a class="iconbtn" href="#/einstellungen" aria-label="Einstellungen">⚙︎</a>
      </div>
    </header>`;
}

export function renderCards(ctx, main) {
  const habits = weekHabits(ctx.state.data);
  if (!habits.length) {
    main.innerHTML = '<div class="state">Noch keine Wochenroutinen.<br><a href="#/routinen/neu/woche" style="color:inherit">Wochenroutine anlegen</a></div>';
    return;
  }
  const weeks = weeksFitting(main.clientWidth - 32);
  habits.forEach(h => main.appendChild(card(ctx, h, weeks)));
}
