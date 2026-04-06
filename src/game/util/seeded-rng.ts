/**
 * Returns a deterministic pseudo-random number generator from a 32-bit seed.
 * Each call yields a float in the half-open interval [0, 1), using the mulberry32 algorithm.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
