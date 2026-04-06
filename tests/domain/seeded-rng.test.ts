import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../src/game/util/seeded-rng";

function collectSequence(seed: number, count: number): number[] {
  const rng = createSeededRng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(rng());
  }
  return out;
}

describe("createSeededRng (mulberry32)", () => {
  it("produces identical sequences for the same seed over 100 draws", () => {
    const a = collectSequence(42, 100);
    const b = collectSequence(42, 100);
    expect(b).toEqual(a);
  });

  it("produces different sequences for different seeds", () => {
    const first = collectSequence(1, 100);
    const second = collectSequence(2, 100);
    expect(second).not.toEqual(first);
  });

  it("returns values in [0, 1)", () => {
    const rng = createSeededRng(99_001);
    for (let i = 0; i < 10_000; i += 1) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
