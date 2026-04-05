import type { BuildingKind } from "../entity/entity-types";
import type { GridCoord } from "../map/world-grid";
import type { WorldCore } from "../world-core-types";
import {
  attachWorkItemToEntityMutable,
  cloneWorld,
  findExistingWorkItem,
  makeWorkItemId,
  spawnWorldEntity
} from "../world-internal";

export function safePlaceBlueprint(
  world: WorldCore,
  input: Readonly<{
    buildingKind: BuildingKind;
    cell: GridCoord;
    occupiedCells?: readonly GridCoord[];
  }>
): Readonly<
  | { ok: true; world: WorldCore; blueprintEntityId: string; workItemId: string }
  | { ok: false; world: WorldCore; reason: string }
> {
  const spawned = spawnWorldEntity(world, {
    kind: "blueprint",
    cell: input.cell,
    occupiedCells: input.occupiedCells ?? [input.cell],
    blueprintKind: input.buildingKind,
    label: `${input.buildingKind}-blueprint`,
    buildProgress01: 0,
    buildState: "planned"
  });
  if (spawned.outcome.kind !== "created") {
    const reason =
      spawned.outcome.kind === "conflict"
        ? `与实体 ${spawned.outcome.blockingEntityId} 占用冲突`
        : spawned.outcome.kind === "out-of-bounds"
          ? "蓝图超出地图边界"
          : "无法放置蓝图";
    return { ok: false, world, reason };
  }

  const nextWorld = cloneWorld(spawned.world);
  const existingWorkItem = findExistingWorkItem(nextWorld, "construct-blueprint", spawned.entityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "construct-blueprint",
      anchorCell: input.cell,
      targetEntityId: spawned.entityId,
      status: "open",
      failureCount: 0
    });
  }
  attachWorkItemToEntityMutable(nextWorld, spawned.entityId, workItemId);

  return {
    ok: true,
    world: nextWorld,
    blueprintEntityId: spawned.entityId,
    workItemId
  };
}

export function placeBlueprint(
  world: WorldCore,
  input: Readonly<{
    buildingKind: BuildingKind;
    cell: GridCoord;
    occupiedCells?: readonly GridCoord[];
  }>
): Readonly<{ world: WorldCore; blueprintEntityId: string; workItemId: string }> {
  const r = safePlaceBlueprint(world, input);
  if (!r.ok) {
    throw new Error(`world-core: failed to place blueprint: ${r.reason}`);
  }
  return { world: r.world, blueprintEntityId: r.blueprintEntityId, workItemId: r.workItemId };
}
