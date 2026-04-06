import { describe, expect, it } from "vitest";
import {
  ENTITY_RESOURCE_CONFLICT_CELL,
  ENTITY_RESOURCE_CONFLICT_SCENARIO
} from "../../scenarios/entity-resource-conflict.scenario";
import {
  assertVisibleFailureFeedback,
  runScenarioHeadless
} from "../../src/headless";

/**
 * ENTITY-004：在已标记冲突的物资格上发起第二次 haul 选区 → 网关拒绝 + 玩家通道可见反馈；
 * 世界仍仅一份地面 wood，无小人错误携带、无 zone 内重复副本。
 * 不调用 validateCarrying / validateResourceLocation 作为主断言。
 * refactor-test：本文件为 ENTITY-004 主验收入口；`tests/domain/*` 直调仅保留守门。
 */
describe("ENTITY-004 entity-resource-conflict", () => {
  it("第二次争夺选区被拒绝，资源仍 singular 且留在原格地面", () => {
    const { results, sim, hydration } = runScenarioHeadless(ENTITY_RESOURCE_CONFLICT_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const conflictSel = hydration.playerSelections.find(
      (s) => s.label === "second-claim-on-contended-resource"
    );
    expect(conflictSel).toBeDefined();
    expect(conflictSel!.didSubmitToWorld).toBe(true);
    expect(conflictSel!.accepted).toBe(false);

    expect(
      assertVisibleFailureFeedback(
        sim,
        {
          source: "submit-result",
          accepted: false,
          textIncludes: "世界网关：拒绝"
        },
        { playerSelections: hydration.playerSelections }
      ).passed
    ).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const resources = [...world.entities.values()].filter((e) => e.kind === "resource");
    expect(resources).toHaveLength(1);
    const wood = resources[0]!;
    expect(wood.materialKind).toBe("wood");
    expect(wood.cell.col).toBe(ENTITY_RESOURCE_CONFLICT_CELL.col);
    expect(wood.cell.row).toBe(ENTITY_RESOURCE_CONFLICT_CELL.row);
    expect(wood.containerKind).toBe("ground");

    const carriedWood = [...world.entities.values()].filter(
      (e) =>
        e.kind === "resource" &&
        e.materialKind === "wood" &&
        e.containerKind === "pawn"
    );
    expect(carriedWood).toHaveLength(0);

    const zoneStoredDup = [...world.entities.values()].filter(
      (e) =>
        e.kind === "resource" &&
        e.materialKind === "wood" &&
        e.containerKind === "zone"
    );
    expect(zoneStoredDup).toHaveLength(0);
  });
});
