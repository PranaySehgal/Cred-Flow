const KEY = 'creditflow-demo-db';

export function clearDb() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}

export function persistDb() {}

export function restoreDb() {
  clearDb();
}

restoreDb();
