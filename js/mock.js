// Beispieldaten und Schein-API für lokale Tests (?mock). Keine echten Daten.
import { todayIn, addDays, weekday } from './logic.js';

export function sampleData(today = todayIn()) {
  const habits = [
    { id: 'lesen', name: 'Zehn Seiten lesen', description: 'Vor dem Schlafen, ohne Handy', icon: '📖', color: '#34c77b', target: 1, steps: [], weekdays: [], challengeDays: null, challengeStart: null, order: 1, status: 'aktiv', created: addDays(today, -200), archivedAt: null },
    { id: 'dehnen', name: 'Dehnen', description: 'Viermal am Tag kurz dehnen', icon: '🧘', color: '#a77bf3', target: 4, steps: ['Morgens', 'Mittags', 'Abends', 'Vor dem Schlafen'], weekdays: [], challengeDays: 30, challengeStart: addDays(today, -20), order: 2, status: 'aktiv', created: addDays(today, -60), archivedAt: null },
    { id: 'trinken', name: 'Zwei Liter trinken', description: 'Flasche morgens bereitstellen', icon: '💧', color: '#3d9bff', target: 1, steps: [], weekdays: [], challengeDays: null, challengeStart: null, order: 3, status: 'aktiv', created: addDays(today, -150), archivedAt: null },
    { id: 'stehen', name: 'Stehend arbeiten', description: 'Mindestens die Hälfte der Bürozeit', icon: '🧍', color: '#ffb020', target: 1, steps: [], weekdays: [0, 1, 2, 3, 4], challengeDays: null, challengeStart: null, order: 4, status: 'aktiv', created: addDays(today, -120), archivedAt: null },
    { id: 'joggen', name: 'Joggen', description: '', icon: '🏃', color: '#ff6b6b', target: 1, steps: [], weekdays: [], challengeDays: null, challengeStart: null, order: 5, status: 'archiviert', created: addDays(today, -300), archivedAt: addDays(today, -100) }
  ];
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const entries = {};
  for (const h of habits) {
    entries[h.id] = {};
    const end = h.archivedAt || today;
    for (let d = h.created; d <= end; d = addDays(d, 1)) {
      if (h.weekdays.length && !h.weekdays.includes(weekday(d))) continue;
      if (rnd() < 0.72) entries[h.id][d] = h.target > 1 ? 1 + Math.floor(rnd() * h.target) : 1;
    }
  }
  delete entries.lesen[today];
  entries.dehnen[today] = 2;
  return { habits, entries, targets: {}, problems: [], today };
}

export function createMockApi() {
  const db = sampleData();
  const wait = v => new Promise(r => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 150));
  const find = id => db.habits.find(h => h.id === id);
  return {
    data: () => wait(Object.assign({ ok: true }, db)),
    setCount: (habitId, date, count) => { if (count) db.entries[habitId][date] = count; else delete db.entries[habitId][date]; return wait({ ok: true, habitId, date, count }); },
    saveHabit: habit => {
      if (habit.id) { Object.assign(find(habit.id), habit); return wait({ ok: true, habit: find(habit.id) }); }
      const h = Object.assign({ id: 'neu-' + db.habits.length, order: db.habits.length + 1, status: 'aktiv', created: todayIn(), archivedAt: null }, habit);
      db.habits.push(h); db.entries[h.id] = {};
      return wait({ ok: true, habit: h });
    },
    archiveHabit: id => { Object.assign(find(id), { status: 'archiviert', archivedAt: todayIn() }); return wait({ ok: true, habit: find(id) }); },
    restoreHabit: id => { Object.assign(find(id), { status: 'aktiv', archivedAt: null }); return wait({ ok: true, habit: find(id) }); },
    reorderHabits: ids => { db.habits.forEach(h => { h.order = ids.indexOf(h.id) + 1; }); db.habits.sort((a, b) => a.order - b.order); return wait({ ok: true, ids }); },
    deleteHabit: id => { db.habits = db.habits.filter(h => h.id !== id); delete db.entries[id]; return wait({ ok: true, id }); }
  };
}
