/**
 * refactor-test：保留回归（createHeadlessSim 建造床直连），WORK-004 / BUILD-002 / INTERACT-003 主证据以场景
 * expectations + `scenario-runner.test.ts` 为准。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import {
  captureVisibleState,
  createHeadlessSim,
  recordScenarioPlayerSelection
} from "../../src/headless";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { BUILD_BED_FLOW_SCENARIO } from "../../scenarios/build-bed-flow.scenario";

const BED_CELL = { col: 11, row: 5 } as const;
const NEIGHBOR_CELL = { col: 12, row: 5 } as const;

describe("INTERACT-003 single-cell build input", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("commits a single-cell placement through the player input entry and only feeds back the clicked bed cell", () => {
    const sim = createHeadlessSim({ seed: BUILD_BED_FLOW_SCENARIO.seed });
    sim.spawnPawn("Builder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);

    expect(sim.getWorldPort().getWorld().workItems.size).toBe(0);
    expect(sim.getWorldPort().getWorld().markers.size).toBe(0);

    const cellKey = coordKey(BED_CELL);
    const outcome = sim.commitPlayerSelection({
      commandId: "place-bed",
      selectionModifier: "replace",
      cellKeys: new Set([cellKey]),
      inputShape: "single-cell",
      currentMarkers: new Map(),
      nowMs: 0
    });
    const selection = recordScenarioPlayerSelection(
      {
        label: "interact-003-single-cell",
        commandId: "place-bed",
        selectionModifier: "replace",
        cellKeys: [cellKey],
        inputShape: "single-cell"
      },
      outcome
    );

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.nextMarkers.size).toBe(1);
    expect(outcome.nextMarkers.has(cellKey)).toBe(true);

    const worldAfterSubmit = sim.getWorldPort().getWorld();
    const blueprints = [...worldAfterSubmit.entities.values()].filter(
      (entity) => entity.kind === "blueprint" && entity.blueprintKind === "bed"
    );
    const constructs = [...worldAfterSubmit.workItems.values()].filter(
      (item) => item.kind === "construct-blueprint" && item.status === "open"
    );

    expect(blueprints).toHaveLength(1);
    expect(blueprints[0]!.cell).toEqual(BED_CELL);
    expect(
      blueprints.some(
        (entity) => entity.cell.col === NEIGHBOR_CELL.col && entity.cell.row === NEIGHBOR_CELL.row
      )
    ).toBe(false);
    expect(constructs).toHaveLength(1);
    expect(constructs[0]!.anchorCell).toEqual(BED_CELL);

    const visible = captureVisibleState(sim, { playerSelections: [selection] });
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
