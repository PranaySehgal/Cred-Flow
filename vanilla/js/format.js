// CreditFlow Format Utilities (IST & INR)
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const IST = 'Asia/Kolkata';

export function toDate(value) {
  return typeof value === 'string' ? new Date(value) : value;
}

export function formatMoney(value) {
  return inr.format(Math.round(Number(value) || 0));
}

export function formatNumber(value) {
  return plain.format(Math.round(Number(value) || 0));
}

export function formatPercent(value, digits = 0) {
  return `${(Number(value) || 0).toFixed(digits)}%`;
}

export function formatDate(value) {
  return toDate(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  });
}

export function formatDayMonth(value) {
  return toDate(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: IST,
  });
}

export function formatWeekday(value) {
  return toDate(value).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: IST,
  });
}

export function formatTime(value) {
  return toDate(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  });
}

export function formatDateTime(value) {
  return `${formatDate(value)}, ${formatTime(value)} IST`;
}

export function relativeFromNow(value) {
  const diffMs = Date.now() - toDate(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function istDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(toDate(value));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDaysKey(days, from = new Date()) {
  const d = new Date(from.getTime() + days * 86400000);
  return istDateKey(d);
}

export function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00Z`).getTime();
  const b = new Date(`${toKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function keyToDate(key) {
  return new Date(`${key}T12:00:00+05:30`);
}

export function displayDayKey(key) {
  return formatDayMonth(keyToDate(key));
}
