/**
 * 床铺自动归属：主路径为木床在 `work-operations.completeBlueprintWork` 落成时立即尝试分配一名无床小人；
 * 全量扫描 `assignUnownedBeds` 仅作可选兜底（默认关闭），与 oh-gen-doc「新床建成」触发一致。
 */

import type { RestSpotSnapshot } from "./entity/entity-types";
import type { WorldCore } from "./world-core-types";
import type { PawnState } from "./pawn-state";
import { cloneWorld, upsertEntityMutable } from "./world-internal";

/**
 * 是否在每帧末运行全量 `assignUnownedBeds`。主路径已改为落成时分配；开启仅用于排查数据不一致等兜底场景。
 */
export const ENABLE_PER_FRAME_UNOWNED_BED_FALLBACK = false;

function ownerIdsFromRestSpots(restSpots: readonly RestSpotSnapshot[]): Set<string> {
  const ownerIds = new Set<string>();
  for (const s of restSpots) {
    if (s.ownerPawnId !== undefined) {
      ownerIds.add(s.ownerPawnId);
    }
  }
  return ownerIds;
}

/** 优先认领工单的施工者；否则按 id 序选第一个尚无 restSpot 归属的小人。 */
function pickPawnIdForNewUnownedSlot(
  ownerIds: ReadonlySet<string>,
  pawns: readonly PawnState[] | undefined,
  preferredPawnId: string | undefined
): string | undefined {
  if (preferredPawnId !== undefined && !ownerIds.has(preferredPawnId)) {
    return preferredPawnId;
  }
  if (!pawns?.length) {
    return undefined;
  }
  const ordered = [...pawns].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.find((p) => !ownerIds.has(p.id))?.id;
}

/**
 * 在已建成木床且对应 restSpot 仍无主时，为一名小人写入归属（与 `assignUnownedBeds` 单床语义一致）。
 */
export function tryAssignUnownedBedForBuilding(
  world: WorldCore,
  bedBuildingId: string,
  pawns: readonly PawnState[] | undefined,
  preferredPawnId: string | undefined
): WorldCore {
  const spotIndex = world.restSpots.findIndex((s) => s.buildingEntityId === bedBuildingId);
  if (spotIndex < 0) {
    return world;
  }
  const spot = world.restSpots[spotIndex]!;
  if (spot.ownerPawnId !== undefined) {
    return world;
  }

  const ownerIds = ownerIdsFromRestSpots(world.restSpots);
  const candidateId = pickPawnIdForNewUnownedSlot(ownerIds, pawns, preferredPawnId);
  if (candidateId === undefined) {
    return world;
  }

  const nextWorld = cloneWorld(world);
  const nextSpots = [...nextWorld.restSpots];
  nextSpots[spotIndex] = {
    ...spot,
    cell: { ...spot.cell },
    ownerPawnId: candidateId,
    assignmentReason: spot.assignmentReason
  };
  nextWorld.restSpots = nextSpots;

  const ent = nextWorld.entities.get(bedBuildingId);
  if (ent && ent.kind === "building" && ent.buildingKind === "bed") {
    upsertEntityMutable(nextWorld, {
      ...ent,
      cell: { ...ent.cell },
      occupiedCells: ent.occupiedCells.map((c) => ({ ...c })),
      relatedWorkItemIds: [...ent.relatedWorkItemIds],
      interactionCapabilities: ent.interactionCapabilities
        ? [...ent.interactionCapabilities]
        : undefined,
      ownership: { ownerPawnId: candidateId, assignmentReason: "unassigned" }
    });
  }
  return nextWorld;
}

export function assignUnownedBeds(world: WorldCore, pawns: readonly PawnState[]): WorldCore {
  const orderedPawns = [...pawns].sort((a, b) => a.id.localeCompare(b.id));
  const ownerIds = ownerIdsFromRestSpots(world.restSpots);

  const nextSpots: RestSpotSnapshot[] = [];
  let changed = false;
  const buildingPatches = new Map<string, string>();

  for (const spot of world.restSpots) {
    if (spot.ownerPawnId !== undefined) {
      nextSpots.push(spot);
      continue;
    }
    const candidate = orderedPawns.find((p) => !ownerIds.has(p.id));
    if (candidate === undefined) {
      nextSpots.push(spot);
      continue;
    }
    changed = true;
    ownerIds.add(candidate.id);
    nextSpots.push({
      ...spot,
      cell: { ...spot.cell },
      ownerPawnId: candidate.id,
      assignmentReason: spot.assignmentReason
    });
    buildingPatches.set(spot.buildingEntityId, candidate.id);
  }

  if (!changed) {
    return world;
  }

  const nextWorld = cloneWorld(world);
  nextWorld.restSpots = nextSpots;
  for (const [buildingId, ownerPawnId] of buildingPatches) {
    const ent = nextWorld.entities.get(buildingId);
    if (!ent || ent.kind !== "building" || ent.buildingKind !== "bed") {
      continue;
    }
    upsertEntityMutable(nextWorld, {
      ...ent,
      cell: { ...ent.cell },
      occupiedCells: ent.occupiedCells.map((c) => ({ ...c })),
      relatedWorkItemIds: [...ent.relatedWorkItemIds],
      interactionCapabilities: ent.interactionCapabilities
        ? [...ent.interactionCapabilities]
        : undefined,
      ownership: { ownerPawnId, assignmentReason: "unassigned" }
    });
  }
  return nextWorld;
}
