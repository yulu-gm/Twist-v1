/**
 * refactor-test：保留回归（认领/拾取直连），WORK-002 / INTERACT-001 主证据以 `haul-mark-pickup.scenario.ts`
 * expectations + `scenario-runner.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import {
  captureVisibleState,
  createHeadlessSim,
  recordScenarioPlayerSelection
} from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import { HAUL_MARK_PICKUP_SCENARIO } from "../../scenarios/haul-mark-pickup.scenario";

function groundFoodResources(sim: ReturnType<typeof createHeadlessSim>) {
  return [...sim.getWorldPort().getWorld().entities.values()].filter(
    (entity) =>
      entity.kind === "resource" &&
      entity.materialKind === "food" &&
      entity.containerKind === "ground"
  );
}

describe("INTERACT-001 rect-selection haul input", () => {
  it("commits a rect-selection through the player input entry and only feeds back covered pickup targets", () => {
    const sim = createHeadlessSim({ seed: HAUL_MARK_PICKUP_SCENARIO.seed });
    hydrateScenario(sim, {
      ...HAUL_MARK_PICKUP_SCENARIO,
      domainCommandsAfterHydrate: undefined,
      expectations: undefined
    });

    expect(groundFoodResources(sim)).toHaveLength(2);
    expect(groundFoodResources(sim).every((entity) => entity.pickupAllowed === false)).toBe(true);
    expect(sim.getWorldPort().getWorld().workItems.size).toBe(0);
    expect(sim.getWorldPort().getWorld().markers.size).toBe(0);

    const selectedCells = [
      ...HAUL_MARK_PICKUP_SCENARIO.resources!.map((resource) => coordKey(resource.cell)),
      coordKey({ col: 12, row: 5 })
    ];
    const outcome = sim.commitPlayerSelection({
      commandId: "haul",
      selectionModifier: "replace",
      cellKeys: new Set(selectedCells),
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 0
    });
    const selection = recordScenarioPlayerSelection(
      {
        label: "interact-001-rect-selection",
        commandId: "haul",
        selectionModifier: "replace",
        cellKeys: selectedCells,
        inputShape: "rect-selection"
      },
      outcome
    );

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.nextMarkers.size).toBe(2);
    expect(outcome.nextMarkers.has(coordKey({ col: 12, row: 5 }))).toBe(false);

    const resources = groundFoodResources(sim);
    expect(resources).toHaveLength(2);
    expect(resources.every((entity) => entity.pickupAllowed === true)).toBe(true);

    const visible = captureVisibleState(sim, { playerSelections: [selection] });
    const openPickupItems = visible.workItems.filter(
      (item) => item.kind === "pick-up-resource" && item.status === "open"
    );

    expect(openPickupItems).toHaveLength(2);
    expect(
      openPickupItems.every((item) =>
        HAUL_MARK_PICKUP_SCENARIO.resources!.some(
          (resource) =>
            item.anchorCell.col === resource.cell.col && item.anchorCell.row === resource.cell.row
        )
      )
    ).toBe(true);
    expect(
      visible.failures.some(
        (item) =>
          item.source === "submit-result" &&
          item.accepted === true &&
          item.text.length > 0
      )
    ).toBe(true);
  });
});
