import { describe, expect, it } from "vitest";
import { needSignalsFromNeeds } from "../../src/player/need-signals";

describe("needSignalsFromNeeds", () => {
  it("marks allowInterrupt when hunger is critical", () => {
    const s = needSignalsFromNeeds({
      hunger: 85,
      rest: 10,
      recreation: 10
    });
    expect(s.allowInterruptWorkForHunger).toBe(true);
    expect(s.hungerUrgency).toBe("critical");
  });

  it("uses stable summary when needs are low", () => {
    const s = needSignalsFromNeeds({
      hunger: 20,
      rest: 10,
      recreation: 20
    });
    expect(s.summaryLine).toBe("需求稳定");
    expect(s.allowInterruptWorkForHunger).toBe(false);
  });
});
