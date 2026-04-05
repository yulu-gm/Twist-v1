import { describe, expect, it } from "vitest";
import { createEntityRegistry } from "../../src/game/entity/entity-registry";
import { transformTreeToResource } from "../../src/game/entity/lifecycle-rules";
import { createZone, getZoneAtCell } from "../../src/game/map/zone-manager";
import { runChopFlowScenario } from "../../src/game/flows/chop-flow";
import { createWorkRegistry } from "../../src/game/work/work-registry";

describe("chop-flow", () => {
  it("有存储区：木头卸在区内，getZoneAtCell 命中存储区", () => {
    const entities = createEntityRegistry();
    const treeCell = { col: 2, row: 2 };
    const tree = entities.create({
      kind: "tree",
      cell: treeCell,
      loggingMarked: true,
      occupied: false
    });
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 70,
      energy: 70
    });

    const zone = createZone(
      entities,
      [
        { col: 10, row: 5 },
        { col: 11, row: 5 }
      ],
      "storage",
      "wood-stock",
      ["wood"]
    );
    const dropCell = { col: 10, row: 5 };

    const work = createWorkRegistry();
    const res = runChopFlowScenario(entities, work, tree.id, pawn.id, {
      storageZone: zone,
      haulDropCell: dropCell
    });

    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;

    expect(res.finalCell).toEqual(dropCell);
    const wood = entities.get(res.woodResourceId);
    expect(wood?.kind).toBe("resource");
    if (wood?.kind !== "resource") return;
    expect(wood.materialKind).toBe("wood");
    expect(wood.containerKind).toBe("ground");

    const hit = getZoneAtCell(entities, res.finalCell);
    expect(hit?.id).toBe(zone.id);
  });

  it("无存储区：木头落在伐木原位地面", () => {
    const entities = createEntityRegistry();
    const treeCell = { col: 3, row: 4 };
    const tree = entities.create({
      kind: "tree",
      cell: treeCell,
      loggingMarked: true,
      occupied: false
    });
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 9, row: 9 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 60,
      energy: 60
    });

    const work = createWorkRegistry();
    const res = runChopFlowScenario(entities, work, tree.id, pawn.id);

    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;

    expect(res.finalCell).toEqual(treeCell);
    const wood = entities.get(res.woodResourceId);
    expect(wood?.kind).toBe("resource");
    if (wood?.kind !== "resource") return;
    expect(wood.containerKind).toBe("ground");
    expect(wood.cell).toEqual(treeCell);
    expect(getZoneAtCell(entities, treeCell)).toBeUndefined();
  });

  it("transformTreeToResource 对照：单树转化产出木头", () => {
    const entities = createEntityRegistry();
    const tree = entities.create({
      kind: "tree",
      cell: { col: 1, row: 1 },
      loggingMarked: true,
      occupied: false
    });
    const out = transformTreeToResource(entities, tree.id);
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;
    const wood = entities.get(out.resourceId);
    expect(wood?.kind).toBe("resource");
    if (wood?.kind !== "resource") return;
    expect(wood.materialKind).toBe("wood");
    expect(wood.cell).toEqual({ col: 1, row: 1 });
  });
});
