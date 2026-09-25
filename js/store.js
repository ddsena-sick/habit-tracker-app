// Lokaler Speicher: Token, letzte Serverantwort, Warteschlange (FR-004, FR-005).
// Die Warteschlange hält je Routine und Tag nur den letzten Wert.

const K_TOKEN = 'ht.token';
const K_DATA = 'ht.data';
const K_QUEUE = 'ht.queue';

export function createStore(storage) {
  const read = (k, fallback) => {
    try { const v = storage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } };
  const remove = k => { try { storage.removeItem(k); } catch (e) { /* egal */ } };

  return {
    token: () => read(K_TOKEN, null),
    setToken: t => write(K_TOKEN, t),
    clearToken: () => remove(K_TOKEN),

    data: () => read(K_DATA, null),
    setData: d => write(K_DATA, d),
    clearData: () => remove(K_DATA),

    queue: () => read(K_QUEUE, {}),
    queueSize() { return Object.keys(this.queue()).length; },
    enqueue(habitId, date, count) {
      const q = this.queue();
      q[habitId + '|' + date] = { habitId, date, count };
      write(K_QUEUE, q);
    },
    /** Nach erfolgreichem Senden entfernen – aber nur, wenn inzwischen kein neuerer Wert kam. */
    dequeue(item) {
      const q = this.queue();
      const key = item.habitId + '|' + item.date;
      if (q[key] && q[key].count === item.count) { delete q[key]; write(K_QUEUE, q); }
    },
    clearQueue: () => remove(K_QUEUE)
  };
}
