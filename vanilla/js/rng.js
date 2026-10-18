// Deterministic pseudo-random number generator (Mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function between(next, min, max) {
  return min + next() * (max - min);
}

export function intBetween(next, min, max) {
  return Math.round(between(next, min, max));
}

export function pickOne(next, items) {
  return items[Math.floor(next() * items.length) % items.length];
}
