import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import {
  captureVisibleState,
  createHeadlessSim,
  recordScenarioPlayerSelection,
  runScenarioHeadless
} from "../../src/headless";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { BUILD_WALL_FLOW_SCENARIO } from "../../scenarios/build-wall-flow.scenario";

const WALL_CELLS = [
  { col: 14, row: 5 },
  { col: 15, row: 5 },
  { col: 16, row: 5 }
] as const;

/**
 * ENTITY-003：build 笔刷 → 墙蓝图 + construct 工单 → tick 后蓝图消失、墙占格与笔刷一致。
 * 不调用 transformBlueprintToBuilding；完成态从世界与可见工单读取。
 * refactor-test：相对 BUILD-001 / INTERACT-002 / UI-001，本文件为 createHeadlessSim 直连回归；
 * 玩家选区同形主证据以 `runScenarioHeadless(BUILD_WALL_FLOW_SCENARIO)` 段与 `ui-menu-mode-switch.test.ts` 为准。
 */
describe("ENTITY-003 wall blueprint to building", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("construct-blueprint 从 open 到 completed，蓝图清除且墙落在笔刷格", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);

    const outcome = sim.commitPlayerSelection({
      commandId: "build-wall",
      selectionModifier: "replace",
      cellKeys: new Set(WALL_CELLS.map((cell) => coordKey(cell))),
      inputShape: "brush-stroke",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("build_wall_blueprint");
    expect(outcome.submitResult?.accepted).toBe(true);

    const worldAfterSubmit = sim.getWorldPort().getWorld();
    const constructOpen = [...worldAfterSubmit.workItems.values()].filter(
      (item) => item.kind === "construct-blueprint" && item.status === "open"
    );
    expect(constructOpen).toHaveLength(WALL_CELLS.length);

    const completed = sim.runUntil(() => {
      const world = sim.getWorldPort().getWorld();
      const builtWalls = [...world.entities.values()].filter(
        (entity) => entity.kind === "building" && entity.buildingKind === "wall"
      );
      const remainingBlueprints = [...world.entities.values()].filter(
        (entity) => entity.kind === "blueprint" && entity.blueprintKind === "wall"
      );
      const pendingConstructs = [...world.workItems.values()].filter(
        (item) => item.kind === "construct-blueprint" && item.status !== "completed"
      );

      return (
        builtWalls.length === WALL_CELLS.length &&
        WALL_CELLS.every((cell) =>
          builtWalls.some((wall) => wall.cell.col === cell.col && wall.cell.row === cell.row)
        ) &&
        remainingBlueprints.length === 0 &&
        pendingConstructs.length === 0
      );
    }, { maxTicks: 20_000, deltaMs: 16 });

    expect(completed.reachedPredicate).toBe(true);

    const visible = captureVisibleState(sim);
    const constructs = visible.workItems.filter((w) => w.kind === "construct-blueprint");
    expect(constructs.length).toBe(WALL_CELLS.length);
    expect(constructs.every((w) => w.status === "completed")).toBe(true);

    const workCompleted = sim.getSimEventCollector().getEventsByKind("work-completed");
    expect(workCompleted.length).toBeGreaterThanOrEqual(WALL_CELLS.length);
  });
});

describe("INTERACT-002 brush-stroke build input", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("commits a brush stroke through the player input entry and only feeds back the stroked wall path", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);

    expect(sim.getWorldPort().getWorld().workItems.size).toBe(0);
    expect(sim.getWorldPort().getWorld().markers.size).toBe(0);

    const cellKeys = WALL_CELLS.map((cell) => coordKey(cell));
    const outcome = sim.commitPlayerSelection({
      commandId: "build-wall",
      selectionModifier: "replace",
      cellKeys: new Set(cellKeys),
      inputShape: "brush-stroke",
      currentMarkers: new Map(),
      nowMs: 0
    });
    const selection = recordScenarioPlayerSelection(
      {
        label: "interact-002-brush-stroke",
        commandId: "build-wall",
        selectionModifier: "replace",
        cellKeys,
        inputShape: "brush-stroke"
      },
      outcome
    );

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.nextMarkers.size).toBe(WALL_CELLS.length);

    const worldAfterSubmit = sim.getWorldPort().getWorld();
    const wallBlueprints = [...worldAfterSubmit.entities.values()].filter(
      (entity) => entity.kind === "blueprint" && entity.blueprintKind === "wall"
    );
    const constructWorkItems = [...worldAfterSubmit.workItems.values()].filter(
      (item) => item.kind === "construct-blueprint" && item.status === "open"
    );

    expect(wallBlueprints).toHaveLength(WALL_CELLS.length);
    expect(
      wallBlueprints.every((entity) =>
        WALL_CELLS.some(
          (cell) => entity.cell.col === cell.col && entity.cell.row === cell.row
        )
      )
    ).toBe(true);
    expect(constructWorkItems).toHaveLength(WALL_CELLS.length);
    expect(
      constructWorkItems.every((item) =>
        WALL_CELLS.some(
          (cell) => item.anchorCell.col === cell.col && item.anchorCell.row === cell.row
        )
      )
    ).toBe(true);

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

  it("scenario replay still records INTERACT-002 as brush-stroke input instead of another input mode", () => {
    const { hydration, results, sim } = runScenarioHeadless(BUILD_WALL_FLOW_SCENARIO);
    const selection = hydration.playerSelections[0]!;
    const visible = captureVisibleState(sim, { playerSelections: hydration.playerSelections });

    expect(results.every((result) => result.passed)).toBe(true);
    expect(hydration.playerSelections).toHaveLength(1);
    expect(selection.markerToolId).toBe("build");
    expect(selection.semantic).toBe("brush-stroke");
    expect(selection.inputShape).toBe("brush-stroke");
    expect(selection.didSubmitToWorld).toBe(true);
    expect(selection.accepted).toBe(true);
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
