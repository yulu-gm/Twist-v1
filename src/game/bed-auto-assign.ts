/**
 * 无归属床铺（restSpot.ownerPawnId 未定义）在每帧末分配给仍无床的小人（与 sim 中 pawn id 对齐）。
 */

import type { RestSpotSnapshot } from "./entity/entity-types";
import type { WorldCore } from "./world-core-types";
import type { PawnState } from "./pawn-state";
import { cloneWorld, upsertEntityMutable } from "./world-internal";

export function assignUnownedBeds(world: WorldCore, pawns: readonly PawnState[]): WorldCore {
  const orderedPawns = [...pawns].sort((a, b) => a.id.localeCompare(b.id));
  const ownerIds = new Set<string>();
  for (const s of world.restSpots) {
    if (s.ownerPawnId !== undefined) {
      ownerIds.add(s.ownerPawnId);
    }
  }

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
