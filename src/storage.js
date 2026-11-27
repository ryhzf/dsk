/**
 * Small wrapper around window.localStorage with a safe in-memory fallback.
 * The app never sends wallet state anywhere.
 */

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

export function createBrowserStorage(scope = globalThis) {
  try {
    const storage = scope.localStorage;
    const probe = '__reddit_archive_demo_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return { storage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
