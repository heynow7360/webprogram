const Storage = (() => {
  const KEY = 'study-records';

  function getAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const records = raw ? JSON.parse(raw) : [];
      return records.sort((a, b) => {
        const da = a.date + (a.startTime || '');
        const db = b.date + (b.startTime || '');
        return db.localeCompare(da);
      });
    } catch {
      return [];
    }
  }

  function save(record) {
    const records = getAll();
    const newRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      ...record,
      createdAt: new Date().toISOString(),
    };
    records.push(newRecord);
    localStorage.setItem(KEY, JSON.stringify(records));
    return newRecord;
  }

  function remove(id) {
    const records = getAll().filter(r => r.id !== id);
    localStorage.setItem(KEY, JSON.stringify(records));
  }

  function getById(id) {
    return getAll().find(r => r.id === id) || null;
  }

  return { getAll, save, remove, getById };
})();
