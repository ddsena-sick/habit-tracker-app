// Startansicht mit zwei Seiten (FR-018): "Heute" (Tagesroutinen, FR-001 bis FR-003)
// und "Diese Woche" (Wochenroutinen, FR-017). Gewechselt wird per Wischen
// (CSS-Scroll-Snap), per Seitenpunkt oder mit den Pfeiltasten.
import { countOn, isDue, isWeekly, todayHabits } from '../logic.js';
import { esc, rgba, fmt, plural } from '../ui.js';
import { card, weeksFitting } from './card.js';
import * as week from './week.js';

export { heatCell } from './card.js';
export const live = true;
const PAGES = ['#/', '#/woche'];

export function render(ctx, root) {
  const { data, today } = ctx.state;
  const habits = todayHabits(data, today);
  const notDue = data.habits.filter(h => h.status === 'aktiv' && !isWeekly(h) && !isDue(h, today));
  const pending = ctx.store.queueSize();
  const page = ctx.state.page || 0;

  const notices = `
    ${ctx.state.authError ? '<a class="pill" href="#/einstellungen">Token ungültig: <b>in den Einstellungen neu eingeben</b></a>' : ''}
    ${pending ? `<a class="pill" href="#/einstellungen"><b>${plural(pending, 'Eintrag', 'Einträge')}</b> noch nicht gesendet</a>` : ''}
    ${data.problems && data.problems.length ? `<div class="problems">${plural(data.problems.length, 'Zeile', 'Zeilen')} in „Habits“ nicht lesbar, siehe <a href="#/einstellungen">Einstellungen</a></div>` : ''}`;

  root.innerHTML = `
    <nav class="dots" aria-label="Seiten">
      <button type="button" data-page="0" aria-label="Heute" aria-current="${page === 0}"></button>
      <button type="button" data-page="1" aria-label="Diese Woche" aria-current="${page === 1}"></button>
    </nav>
    <div class="pages">
      <section class="page" aria-label="Heute">
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
        ${notices}
        <main id="habits"></main>
        ${notDue.length ? `<div class="notdue">Heute nicht fällig: ${notDue.map(h => `<a href="#/routine/${esc(h.id)}" style="color:inherit">${esc(h.icon)} ${esc(h.name)}</a>`).join(', ')}</div>` : ''}
      </section>
      <section class="page" aria-label="Diese Woche">
        ${week.header(ctx)}
        ${notices}
        <main id="weekly"></main>
      </section>
    </div>`;

  const main = root.querySelector('#habits');
  if (!data.habits.length) {
    main.innerHTML = '<div class="state">Noch keine Routinen. <a href="#/routinen" style="color:inherit">Routine anlegen</a></div>';
  } else if (!habits.length) {
    main.innerHTML = '<div class="state">Heute ist keine Tagesroutine fällig.</div>';
  } else {
    const weeks = weeksFitting(main.clientWidth - 32);
    habits.forEach(h => main.appendChild(card(ctx, h, weeks)));
  }
  week.renderCards(ctx, root.querySelector('#weekly'));

  bindPager(ctx, root);
}

function bindPager(ctx, root) {
  const pager = root.querySelector('.pages');
  const dots = [...root.querySelectorAll('.dots button')];
  // Angezeigte Seite nach dem Neuzeichnen ohne Animation wiederherstellen (CC10)
  pager.scrollLeft = (ctx.state.page || 0) * pager.clientWidth;

  const setPage = i => {
    ctx.state.page = i;
    dots.forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
    if (location.hash !== PAGES[i] && !(i === 0 && location.hash === '')) history.replaceState(null, '', PAGES[i]);
  };
  let t;
  pager.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => setPage(Math.round(pager.scrollLeft / pager.clientWidth)), 80);
  }, { passive: true });
  dots.forEach(d => d.addEventListener('click', () => goTo(pager, Number(d.dataset.page))));
}

function goTo(pager, i) {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  pager.scrollTo({ left: i * pager.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}

// Pfeiltasten am PC (nur auf der Startansicht, nicht in Eingabefeldern)
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const pager = document.querySelector('.pages');
  if (!pager || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  goTo(pager, e.key === 'ArrowRight' ? 1 : 0);
});
