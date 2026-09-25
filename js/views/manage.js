// Routinenpflege (FR-007 bis FR-010): anlegen, bearbeiten, sortieren, archivieren,
// wiederherstellen, löschen (nur ohne Einträge). Geht nur mit Verbindung.
import { WEEKDAYS, todayIn } from '../logic.js';
import { esc, rgba, PALETTE, errorText, toast } from '../ui.js';

const hasEntries = (data, id) => Object.keys(data.entries[id] || {}).length > 0;
const summary = h => [
  `Ziel ${h.target}`,
  h.weekdays && h.weekdays.length ? h.weekdays.map(i => WEEKDAYS[i]).join(' ') : 'täglich',
  h.challengeDays ? `Challenge ${h.challengeDays} Tage` : ''
].filter(Boolean).join(' · ');

// ---------- Liste

export function renderList(ctx, root) {
  const { data } = ctx.state;
  const active = data.habits.filter(h => h.status === 'aktiv');
  const archived = data.habits.filter(h => h.status !== 'aktiv');
  const offline = !navigator.onLine;

  root.innerHTML = `
    <a class="back" href="#/einstellungen">‹ Einstellungen</a>
    <header><div><h1>Routinen</h1></div>
      <a class="btn primary ${offline ? 'hidden' : ''}" href="#/routinen/neu">+ Neu</a></header>
    ${offline ? '<div class="pill">Routinen lassen sich nur mit Verbindung ändern</div>' : ''}
    <div class="section-title">Aktiv</div>
    <section class="card" id="active">${active.length ? '' : '<div class="small">Keine aktiven Routinen.</div>'}</section>
    <div class="section-title">Archiviert</div>
    <section class="card" id="archived">${archived.length ? '' : '<div class="small">Nichts archiviert. Archivierte Routinen behalten ihren Verlauf und lassen sich wiederherstellen.</div>'}</section>`;

  const act = root.querySelector('#active');
  active.forEach((h, i) => {
    const row = listRow(h);
    row.querySelector('.actions').innerHTML = `
      <button class="btn ghost" data-move="-1" ${i === 0 || offline ? 'disabled' : ''} aria-label="${esc(h.name)} nach oben">↑</button>
      <button class="btn ghost" data-move="1" ${i === active.length - 1 || offline ? 'disabled' : ''} aria-label="${esc(h.name)} nach unten">↓</button>
      <a class="btn ${offline ? 'hidden' : ''}" href="#/routinen/bearbeiten/${esc(h.id)}">Bearbeiten</a>`;
    row.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => move(ctx, active, i, Number(b.dataset.move))));
    act.appendChild(row);
  });

  const arc = root.querySelector('#archived');
  archived.forEach(h => {
    const row = listRow(h);
    row.querySelector('.actions').innerHTML = `
      <a class="btn ghost" href="#/routine/${esc(h.id)}">Verlauf</a>
      <button class="btn" data-restore ${offline ? 'disabled' : ''}>Wiederherstellen</button>`;
    row.querySelector('[data-restore]').addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        const res = await ctx.api.restoreHabit(h.id);
        ctx.replaceHabit(res.habit);
        toast(`„${h.name}“ ist wieder aktiv`, 'ok');
        renderList(ctx, root);
      } catch (err) { e.target.disabled = false; toast(errorText(err)); }
    });
    arc.appendChild(row);
  });
}

function listRow(h) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="icon" style="background:${rgba(h.color, .16)}">${esc(h.icon)}</div>
    <div class="grow"><div class="name">${esc(h.name)}</div><div class="small">${esc(summary(h))}</div></div>
    <div class="actions row"></div>`;
  return row;
}

async function move(ctx, active, i, dir) {
  const ids = active.map(h => h.id);
  [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
  const all = ids.concat(ctx.state.data.habits.filter(h => h.status !== 'aktiv').map(h => h.id));
  try {
    const res = await ctx.api.reorderHabits(all);
    const order = res.ids || all;
    ctx.state.data.habits.forEach(h => { h.order = order.indexOf(h.id) + 1; });
    ctx.state.data.habits.sort((a, b) => a.order - b.order);
    ctx.saveData();
    ctx.rerender();
  } catch (err) { toast(errorText(err)); }
}

// ---------- Formular

export function renderForm(ctx, root, id) {
  const { data } = ctx.state;
  const h = id ? data.habits.find(x => x.id === id) : null;
  if (id && !h) { root.innerHTML = '<a class="back" href="#/routinen">‹ Routinen</a><div class="state">Diese Routine gibt es nicht (mehr).</div>'; return; }
  const v = h || { name: '', description: '', icon: '✅', color: PALETTE[data.habits.length % PALETTE.length], target: 1, steps: [], weekdays: [], challengeDays: null, challengeStart: null };
  const palette = PALETTE.includes(v.color) ? PALETTE : PALETTE.concat(v.color);
  const deletable = h && !hasEntries(data, h.id);

  root.innerHTML = `
    <a class="back" href="#/routinen">‹ Routinen</a>
    <header><div><h1>${h ? 'Bearbeiten' : 'Neue Routine'}</h1>${h ? `<div class="date">ID ${esc(h.id)} (bleibt fest)</div>` : ''}</div></header>
    <form class="card" id="form" novalidate>
      <label class="field"><span>Name</span><input name="name" maxlength="60" required value="${esc(v.name)}"></label>
      <label class="field"><span>Beschreibung</span><input name="description" maxlength="200" value="${esc(v.description)}"></label>
      <div class="two">
        <label class="field"><span>Icon (Emoji)</span><input name="icon" maxlength="16" value="${esc(v.icon)}"></label>
        <label class="field"><span>Ziel pro Tag</span><input name="target" type="number" min="1" max="20" inputmode="numeric" value="${v.target}">
          <div class="hint">Gilt ab heute; vergangene Tage behalten ihr Ziel.</div></label>
      </div>
      <div class="field"><span>Farbe</span><div class="swatches">${palette.map(c =>
        `<button type="button" class="swatch" data-color="${c}" style="background:${c}" aria-label="Farbe ${c}" aria-pressed="${c === v.color}"></button>`).join('')}</div></div>
      <label class="field"><span>Schritte (optional, einer pro Zeile)</span><textarea name="steps" rows="3">${esc((v.steps || []).join('\n'))}</textarea>
        <div class="hint">Anzahl = Ziel pro Tag, z. B. vier Schritte bei Ziel 4.</div></label>
      <div class="field"><span>Fällig an (keiner gewählt = täglich)</span><div class="toggles">${WEEKDAYS.map((n, i) =>
        `<button type="button" class="toggle" data-day="${i}" aria-pressed="${(v.weekdays || []).includes(i)}">${n}</button>`).join('')}</div></div>
      <div class="two">
        <label class="field"><span>Challenge (Tage, optional)</span><input name="challengeDays" type="number" min="0" max="3650" inputmode="numeric" value="${v.challengeDays || ''}"></label>
        <label class="field"><span>Challenge-Start</span><input name="challengeStart" type="date" value="${esc(v.challengeStart || '')}"></label>
      </div>
      <div class="error hidden" id="err"></div>
      <div class="btns">
        <button class="btn primary" type="submit">Speichern</button>
        <a class="btn" href="#/routinen">Abbrechen</a>
        ${h && h.status === 'aktiv' ? '<button class="btn" type="button" id="archive">Archivieren</button>' : ''}
        ${deletable ? '<button class="btn danger" type="button" id="del">Löschen</button>' : ''}
      </div>
      <div class="confirm hidden" id="confirm">Endgültig löschen? Das geht nur, weil diese Routine noch keinen Eintrag hat.
        <div class="btns"><button class="btn danger" type="button" id="del-yes">Ja, löschen</button><button class="btn" type="button" id="del-no">Behalten</button></div></div>
    </form>`;

  const form = root.querySelector('#form');
  const err = root.querySelector('#err');
  const showErr = msg => { err.textContent = msg; err.classList.remove('hidden'); };
  let color = v.color;
  form.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    form.querySelectorAll('.swatch').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  form.querySelectorAll('.toggle').forEach(b => b.addEventListener('click', () =>
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const habit = {
      name: f.get('name').trim(),
      description: f.get('description').trim(),
      icon: f.get('icon').trim(),
      color,
      target: Number(f.get('target')),
      steps: f.get('steps').split('\n').map(s => s.trim()).filter(Boolean),
      weekdays: [...form.querySelectorAll('.toggle[aria-pressed="true"]')].map(b => Number(b.dataset.day)),
      challengeDays: f.get('challengeDays') ? Number(f.get('challengeDays')) : null,
      challengeStart: f.get('challengeStart') || (f.get('challengeDays') ? todayIn() : null)
    };
    if (!habit.name) return showErr('Name fehlt');
    if (!Number.isInteger(habit.target) || habit.target < 1 || habit.target > 20) return showErr('Ziel pro Tag muss 1–20 sein');
    if (habit.steps.length && habit.steps.length !== habit.target) return showErr(`${habit.steps.length} Schritte, aber Ziel ${habit.target}: Die Anzahl muss gleich sein`);
    if (h) habit.id = h.id;
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const res = await ctx.api.saveHabit(habit);
      ctx.replaceHabit(res.habit);
      toast(h ? 'Gespeichert' : `„${res.habit.name}“ angelegt`, 'ok');
      location.hash = '#/routinen';
    } catch (x) { submit.disabled = false; showErr(errorText(x)); }
  });

  const arch = root.querySelector('#archive');
  if (arch) arch.addEventListener('click', async () => {
    arch.disabled = true;
    try {
      const res = await ctx.api.archiveHabit(h.id);
      ctx.replaceHabit(res.habit);
      toast(`„${h.name}“ archiviert, der Verlauf bleibt erhalten`, 'ok');
      location.hash = '#/routinen';
    } catch (x) { arch.disabled = false; showErr(errorText(x)); }
  });

  const del = root.querySelector('#del');
  if (del) {
    const box = root.querySelector('#confirm');
    del.addEventListener('click', () => box.classList.remove('hidden'));
    root.querySelector('#del-no').addEventListener('click', () => box.classList.add('hidden'));
    root.querySelector('#del-yes').addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        await ctx.api.deleteHabit(h.id);
        ctx.removeHabit(h.id);
        toast(`„${h.name}“ gelöscht`, 'ok');
        location.hash = '#/routinen';
      } catch (x) { e.target.disabled = false; showErr(errorText(x)); }
    });
  }
}
