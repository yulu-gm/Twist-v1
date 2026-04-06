/**
 * refactor-test：保留回归（createHeadlessSim 全链），WORK-001 / ENTITY-002 主证据以场景 expectations
 * + `scenario-runner.test.ts` 为准；本文件补充搬运链细粒度。
 */
import { describe, expect, it } from "vitest";
import type { WorldEntitySnapshot } from "../../src/game/entity/entity-types";
import { coordKey } from "../../src/game/map";
import { captureVisibleState, createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import { CHOP_HAUL_FULL_CHAIN_SCENARIO } from "../../scenarios/chop-haul-full-chain.scenario";

/** ENTITY-002：拾取→搬运→放下后的容器与格点断言（主路径为玩家选区 + tick，非 pickUpResource/dropResource）。 */
function assertEntity002CarryAndDropOutcome(params: {
  entities: Iterable<WorldEntitySnapshot>;
  storageZoneId: string;
  storageCoveredKeys: Set<string>;
}): void {
  const list = [...params.entities];
  const storedWood = list.find(
    (entity) =>
      entity.kind === "resource" &&
      entity.materialKind === "wood" &&
      entity.containerKind === "zone" &&
      entity.containerEntityId === params.storageZoneId
  );
  expect(storedWood).toBeDefined();
  expect(params.storageCoveredKeys.has(coordKey(storedWood!.cell))).toBe(true);
  expect(
    list.some(
      (entity) =>
        entity.kind === "resource" &&
        entity.materialKind === "wood" &&
        entity.containerKind === "ground"
    )
  ).toBe(false);
}

describe("WORK-001 chop-haul-full-chain", () => {
  it("drives chop -> pick up -> haul into storage from one lumber selection", () => {
    const sim = createHeadlessSim({ seed: CHOP_HAUL_FULL_CHAIN_SCENARIO.seed });
    hydrateScenario(sim, {
      ...CHOP_HAUL_FULL_CHAIN_SCENARIO,
      domainCommandsAfterHydrate: undefined,
      expectations: undefined
    });

    const treeCell = CHOP_HAUL_FULL_CHAIN_SCENARIO.trees![0]!.cell;
    const storageZone = [...sim.getWorldPort().getWorld().entities.values()].find(
      (entity) => entity.kind === "zone" && entity.zoneKind === "storage"
    );
    expect(storageZone).toBeDefined();

    const outcome = sim.commitPlayerSelection({
      toolId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(treeCell)]),
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("assign_tool_task:lumber");
    expect(outcome.submitResult?.accepted).toBe(true);
    expect(outcome.nextMarkers.has(coordKey(treeCell))).toBe(true);
    expect(
      captureVisibleState(sim).workItems.some(
        (item) => item.kind === "chop-tree" && item.status === "open"
      )
    ).toBe(true);

    const chopped = sim.runUntil(
      () =>
        [...sim.getWorldPort().getWorld().workItems.values()].some(
          (item) => item.kind === "chop-tree" && item.status === "completed"
        ),
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(chopped.reachedPredicate).toBe(true);

    let world = sim.getWorldPort().getWorld();
    expect([...world.entities.values()].some((entity) => entity.kind === "tree")).toBe(false);
    const groundWood = [...world.entities.values()].find(
      (entity) =>
        entity.kind === "resource" &&
        entity.materialKind === "wood" &&
        entity.containerKind === "ground"
    );
    expect(groundWood?.pickupAllowed).toBe(true);
    expect(
      [...world.workItems.values()].some((item) => item.kind === "pick-up-resource")
    ).toBe(true);

    const haulQueued = sim.runUntil(
      () =>
        [...sim.getWorldPort().getWorld().workItems.values()].some(
          (item) => item.kind === "haul-to-zone"
        ),
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(haulQueued.reachedPredicate).toBe(true);

    world = sim.getWorldPort().getWorld();
    // ENTITY-002：搬运途中木头进入 pawn 容器（与拾取工单推进一致，非直调 pickUpResource）。
    const carriedWood = [...world.entities.values()].find(
      (entity) =>
        entity.kind === "resource" &&
        entity.materialKind === "wood" &&
        entity.containerKind === "pawn"
    );
    expect(carriedWood).toBeDefined();

    const stored = sim.runUntil(
      () => {
        const latestWorld = sim.getWorldPort().getWorld();
        const storedWood = [...latestWorld.entities.values()].find(
          (entity) =>
            entity.kind === "resource" &&
            entity.materialKind === "wood" &&
            entity.containerKind === "zone" &&
            entity.containerEntityId === storageZone!.id
        );
        const completedKinds = new Set(
          [...latestWorld.workItems.values()]
            .filter((item) => item.status === "completed")
            .map((item) => item.kind)
        );
        return (
          storedWood !== undefined &&
          completedKinds.has("chop-tree") &&
          completedKinds.has("pick-up-resource") &&
          completedKinds.has("haul-to-zone")
        );
      },
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(stored.reachedPredicate).toBe(true);

    world = sim.getWorldPort().getWorld();
    const coveredKeys = new Set(
      (storageZone!.coveredCells ?? [storageZone!.cell]).map((cell) => coordKey(cell))
    );
    assertEntity002CarryAndDropOutcome({
      entities: world.entities.values(),
      storageZoneId: storageZone!.id,
      storageCoveredKeys: coveredKeys
    });

    expect(sim.getSimEventCollector().getEventsByKind("pawn-moved").length).toBeGreaterThan(0);

    const visible = captureVisibleState(sim);
    expect(
      visible.workItems.some((item) => item.kind === "chop-tree" && item.status === "completed")
    ).toBe(true);
    expect(
      visible.workItems.some(
        (item) => item.kind === "pick-up-resource" && item.status === "completed"
      )
    ).toBe(true);
    expect(
      visible.workItems.some((item) => item.kind === "haul-to-zone" && item.status === "completed")
    ).toBe(true);
  });
});
