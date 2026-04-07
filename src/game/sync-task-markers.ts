import type { EntityRegistry } from "./entity-system";
import type { WorkRegistry } from "./work-system";
import { generateFellingWork, generateMiningWork, generatePickupWork, WORK_TYPE_FELLING, WORK_TYPE_MINING, WORK_TYPE_PICKUP } from "./work-generation";
import { gridCoordFromKey } from "./world-grid";

function pruneTaskMarkersAgainstWorld(registry: EntityRegistry, taskMarkersByCell: Map<string, string>): void {
  for (const [cellKey, label] of [...taskMarkersByCell.entries()]) {
    const coord = gridCoordFromKey(cellKey);
    if (!coord) {
      taskMarkersByCell.delete(cellKey);
      continue;
    }
    const entities = registry.listEntitiesAtCell(coord);
    if (label === "伐木" && !entities.some((e) => e.kind === "tree")) {
      taskMarkersByCell.delete(cellKey);
    } else if (label === "开采" && !entities.some((e) => e.kind === "rock")) {
      taskMarkersByCell.delete(cellKey);
    } else if (
      label === "拾取" &&
      !entities.some((e) => e.kind === "material" && e.containerKind === "map")
    ) {
      taskMarkersByCell.delete(cellKey);
    }
  }
}

export function syncTaskMarkersToEntities(
  registry: EntityRegistry,
  workRegistry: WorkRegistry,
  taskMarkersByCell: Map<string, string>
): void {
  pruneTaskMarkersAgainstWorld(registry, taskMarkersByCell);

  // 1. Reset all markers on entities
  for (const tree of registry.listEntitiesByKind("tree")) {
    if (tree.lumberMarked) {
      registry.registerTree({ ...tree, lumberMarked: false });
    }
  }
  for (const rock of registry.listEntitiesByKind("rock")) {
    if (rock.miningMarked) {
      registry.registerRock({ ...rock, miningMarked: false });
    }
  }
  for (const mat of registry.listEntitiesByKind("material")) {
    if (mat.pickupMarked) {
      registry.updateMaterial({ ...mat, pickupMarked: false });
    }
  }

  // 2. Apply markers from taskMarkersByCell
  for (const [cellKey, label] of taskMarkersByCell.entries()) {
    const coord = gridCoordFromKey(cellKey);
    if (!coord) continue;

    if (label === "伐木") {
      const entities = registry.listEntitiesAtCell(coord);
      for (const ent of entities) {
        if (ent.kind === "tree") {
          registry.registerTree({ ...ent, lumberMarked: true });
        }
      }
    } else if (label === "开采") {
      const entities = registry.listEntitiesAtCell(coord);
      for (const ent of entities) {
        if (ent.kind === "rock") {
          registry.registerRock({ ...ent, miningMarked: true });
        }
      }
    } else if (label === "拾取") {
      const entities = registry.listEntitiesAtCell(coord);
      for (const ent of entities) {
        if (ent.kind === "material" && ent.containerKind === "map") {
          registry.updateMaterial({ ...ent, pickupMarked: true });
        }
      }
    }
  }

  // 3. Generate or cancel work orders based on updated markers
  // Felling
  for (const tree of registry.listEntitiesByKind("tree")) {
    if (tree.lumberMarked && !tree.occupied) {
      generateFellingWork(registry, workRegistry, tree.id);
    } else if (!tree.lumberMarked) {
      cancelPendingWorkForTarget(workRegistry, WORK_TYPE_FELLING, tree.id);
    }
  }

  // Mining
  for (const rock of registry.listEntitiesByKind("rock")) {
    if (rock.miningMarked && !rock.occupied) {
      generateMiningWork(registry, workRegistry, rock.id);
    } else if (!rock.miningMarked) {
      cancelPendingWorkForTarget(workRegistry, WORK_TYPE_MINING, rock.id);
    }
  }

  // Pickup
  for (const mat of registry.listEntitiesByKind("material")) {
    if (mat.pickupMarked && mat.containerKind === "map" && !mat.reservedByPawnId) {
      generatePickupWork(registry, workRegistry, mat.id);
    } else if (!mat.pickupMarked) {
      cancelPendingWorkForTarget(workRegistry, WORK_TYPE_PICKUP, mat.id);
    }
  }
}

function cancelPendingWorkForTarget(workRegistry: WorkRegistry, workType: string, targetEntityId: string): void {
  for (const o of workRegistry.listByWorkTypeAndStatus(workType, "pending")) {
    if (o.targetEntityId === targetEntityId) {
      workRegistry.removeWork(o.id);
    }
  }
}
