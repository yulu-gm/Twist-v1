/**
 * refactor-test：保留回归（分区创建直连），MAP-002 主证据以 `zone-create.scenario.ts` expectations
 * + `scenario-runner.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import {
  beginFloorSelection,
  commitFloorSelection,
  createFloorSelectionState,
  updateFloorSelection
} from "../../src/game/interaction/floor-selection";
import { coordKey, listStorageGroupLabels } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import type { DomainCommand } from "../../src/player/s0-contract";
import { ZONE_CREATE_SCENARIO } from "../../scenarios/zone-create.scenario";

function sortedKeys(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

function makeZoneCreateCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-zone-${targetCellKeys.join("-")}`,
    verb: "zone_create",
    targetCellKeys: [...targetCellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "zone_create" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("MAP-002 legal zone selection", () => {
  it("shows a legal rectangle preview, confirms it, and lands one storage zone on the committed cells", () => {
    const sim = createHeadlessSim({ seed: ZONE_CREATE_SCENARIO.seed });
    hydrateScenario(sim, ZONE_CREATE_SCENARIO);

    const grid = sim.getWorldPort().getWorld().grid;
    const started = beginFloorSelection(
      createFloorSelectionState(),
      grid,
      { col: 7, row: 5 },
      "replace"
    );
    const dragged = updateFloorSelection(started, grid, { col: 8, row: 6 });
    const expectedSelection = ["7,5", "7,6", "8,5", "8,6"];

    expect(sortedKeys(dragged.draft!.cellKeys)).toEqual(expectedSelection);
    expect(sortedKeys(dragged.draft!.previewSelectedCellKeys)).toEqual(expectedSelection);

    const committed = commitFloorSelection(dragged);
    expect(sortedKeys(committed.selectedCellKeys)).toEqual(expectedSelection);

    const result = sim
      .getWorldPort()
      .submit(makeZoneCreateCommand(sortedKeys(committed.selectedCellKeys)), 1);

    expect(result.accepted).toBe(true);
    expect(result.messages.some((message) => message.includes("storage"))).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const zones = [...world.entities.values()].filter((entity) => entity.kind === "zone");
    expect(zones).toHaveLength(1);

    const zone = zones[0]!;
    expect(zone.zoneKind).toBe("storage");
    expect(sortedKeys((zone.coveredCells ?? []).map((cell) => coordKey(cell)))).toEqual(expectedSelection);
    expect(zone.occupiedCells).toHaveLength(0);
    expect(listStorageGroupLabels(world)).toMatchObject([
      {
        text: "存储区",
        anchorCell: { col: 7, row: 5 }
      }
    ]);

    for (const key of expectedSelection) {
      expect(world.occupancy.get(key)).toBeUndefined();
    }
  });
});
