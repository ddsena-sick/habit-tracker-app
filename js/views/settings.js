// Einrichtung (FR-004) und Einstellungen: Token, ungesendete Einträge, Cache, Hinweise.
import { esc, fmt, errorText, toast, plural } from '../ui.js';
import { VERSION } from '../version.js';

export function renderSetup(ctx, root) {
  root.innerHTML = `
    <header><div><h1>Einrichten</h1><div class="date">Einmal pro Gerät</div></div></header>
    <form class="card" id="form" novalidate>
      <p class="desc" style="margin-top:0">Gib das Token ein, das die Funktion <b>einrichten()</b> im Apps-Script-Editor ausgegeben hat.
        Es bleibt nur auf diesem Gerät gespeichert.</p>
      <label class="field"><span>Token</span><input name="token" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
      <div class="error hidden" id="err"></div>
      <div class="btns"><button class="btn primary" type="submit">Verbinden</button></div>
    </form>`;
  bindTokenForm(ctx, root, () => { location.hash = '#/'; });
}

function bindTokenForm(ctx, root, done) {
  const form = root.querySelector('#form');
  const err = root.querySelector('#err');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const token = new FormData(form).get('token').trim();
    if (!token) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    err.classList.add('hidden');
    try {
      const data = await ctx.api.data({ token });
      ctx.store.setToken(token);
      ctx.state.authError = false;
      ctx.setServerData(data);
      toast('Verbunden', 'ok');
      done();
      ctx.flush();
    } catch (x) {
      btn.disabled = false;
      err.textContent = x.code === 'unauthorized' ? 'Das Token passt nicht. Bitte prüfen.' : errorText(x);
      err.classList.remove('hidden');
    }
  });
}

export function renderSettings(ctx, root) {
  const queue = Object.values(ctx.store.queue());
  const names = Object.fromEntries((ctx.state.data ? ctx.state.data.habits : []).map(h => [h.id, h.name]));
  const problems = (ctx.state.data && ctx.state.data.problems) || [];

  root.innerHTML = `
    <a class="back" href="#/">‹ Heute</a>
    <header><div><h1>Einstellungen</h1></div></header>

    <a class="card row" href="#/routinen" style="text-decoration:none;color:inherit">
      <div class="grow"><div class="name">Routinen verwalten</div><div class="small">Anlegen, bearbeiten, sortieren, archivieren</div></div><span>›</span></a>

    <div class="section-title">Nicht gesendet</div>
    <section class="card">
      ${queue.length ? `<ul class="streaks">${queue.map(q => `<li><span>${esc(names[q.habitId] || q.habitId)} · ${esc(fmt(q.date, { day: 'numeric', month: 'short' }))}</span><b>${q.count}</b></li>`).join('')}</ul>
        <div class="btns"><button class="btn" id="send">Jetzt senden</button></div>`
      : '<div class="small">Alle Einträge sind gespeichert.</div>'}
    </section>

    ${problems.length ? `<div class="section-title">Hinweise zu „Habits“</div>
    <section class="card"><ul class="streaks">${problems.map(p => `<li><span>${esc(p.message)}</span></li>`).join('')}</ul>
      <div class="small" style="margin-top:8px">Diese Zeilen ignoriert die App, bis sie im Sheet korrigiert sind (siehe WARTUNG.md).</div></section>` : ''}

    <div class="section-title">Token</div>
    <form class="card" id="form" novalidate>
      <label class="field"><span>Neues Token</span><input name="token" type="password" autocomplete="off" spellcheck="false" placeholder="${ctx.store.token() ? 'gespeichert, zum Ändern neu eingeben' : ''}"></label>
      <div class="error hidden" id="err"></div>
      <div class="btns"><button class="btn primary" type="submit">Speichern</button>
        <button class="btn" type="button" id="drop" ${ctx.store.token() ? '' : 'disabled'}>Token löschen</button></div>
      <div class="confirm hidden" id="confirm">Token von diesem Gerät löschen? Ohne Token kann die App nichts laden und nichts speichern.
        ${queue.length ? `Die ${plural(queue.length, 'ungesendeten Eintrag', 'ungesendeten Einträge')} bleiben lokal liegen.` : ''}
        <div class="btns"><button class="btn danger" type="button" id="drop-yes">Ja, löschen</button><button class="btn" type="button" id="drop-no">Behalten</button></div></div>
    </form>

    <div class="section-title">App</div>
    <section class="card">
      <div class="small">Version ${esc(VERSION)}. Neue Versionen kommen beim nächsten Start an.</div>
      <div class="btns"><button class="btn" id="clear">Cache leeren und neu laden</button></div>
    </section>`;

  const send = root.querySelector('#send');
  if (send) send.addEventListener('click', async () => {
    send.disabled = true;
    await ctx.flush();
    renderSettings(ctx, root);
    if (ctx.store.queueSize()) toast('Noch nicht alles gesendet: ' + (navigator.onLine ? 'API nicht erreichbar' : 'keine Verbindung'));
    else toast('Alles gesendet', 'ok');
  });

  bindTokenForm(ctx, root, () => renderSettings(ctx, root));

  const box = root.querySelector('#confirm');
  root.querySelector('#drop').addEventListener('click', () => box.classList.remove('hidden'));
  root.querySelector('#drop-no').addEventListener('click', () => box.classList.add('hidden'));
  root.querySelector('#drop-yes').addEventListener('click', () => {
    ctx.store.clearToken();
    toast('Token gelöscht', 'ok');
    location.hash = '#/einrichten';
  });

  root.querySelector('#clear').addEventListener('click', async () => {
    ctx.store.clearData();
    try {
      if ('caches' in window) for (const k of await caches.keys()) if (k.startsWith('ht-')) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { /* egal, neu laden hilft trotzdem */ }
    location.reload();
  });
}
