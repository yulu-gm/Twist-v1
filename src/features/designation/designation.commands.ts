import {
  ObjectKind,
  DesignationType,
  WorkPriority,
  nextObjectId,
  MapId,
  ObjectId,
  CellCoord,
} from '../../core/types';
import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { Designation } from './designation.types';

// ── Helpers ──

function resolveMap(world: World, cmd: Command): GameMap | undefined {
  const mapId = cmd.payload.mapId as string | undefined;
  if (mapId) return world.maps.get(mapId);
  // Default to first map
  return world.maps.values().next().value as GameMap | undefined;
}

function resolveMapId(world: World, cmd: Command): string {
  const mapId = cmd.payload.mapId as string | undefined;
  if (mapId) return mapId;
  return world.maps.keys().next().value as string;
}

function createDesignation(
  mapId: MapId,
  designationType: DesignationType,
  priority: WorkPriority,
  targetObjectId?: ObjectId,
  targetCell?: CellCoord,
): Designation {
  return {
    id: nextObjectId(),
    kind: ObjectKind.Designation,
    defId: `designation_${designationType}`,
    mapId,
    cell: targetCell ?? { x: 0, y: 0 },
    tags: new Set(['designation']),
    destroyed: false,
    designationType,
    targetObjectId,
    targetCell,
    priority,
  };
}

// ── designate_harvest ──

export const designateHarvestHandler: CommandHandler = {
  type: 'designate_harvest',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    // Accept both targetObjectId and targetId
    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    if (!targetObjectId) return { valid: false, reason: 'No target specified' };

    const target = map.objects.get(targetObjectId);
    if (!target) return { valid: false, reason: `Target object ${targetObjectId} not found` };
    if (target.kind !== ObjectKind.Plant) {
      return { valid: false, reason: `Target ${targetObjectId} is not a plant` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;
    const target = map.objects.get(targetObjectId)!;

    const designation = createDesignation(
      mapId,
      DesignationType.Harvest,
      priority,
      targetObjectId,
      target.cell,
    );
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Harvest, targetObjectId },
      }],
    };
  },
};

// ── designate_mine ──

export const designateMineHandler: CommandHandler = {
  type: 'designate_mine',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    // Accept both targetCell and cell
    const targetCell = (cmd.payload.targetCell ?? cmd.payload.cell) as CellCoord;
    if (!targetCell) return { valid: false, reason: 'No target cell specified' };

    if (
      targetCell.x < 0 || targetCell.x >= map.width ||
      targetCell.y < 0 || targetCell.y >= map.height
    ) {
      return { valid: false, reason: `Cell (${targetCell.x},${targetCell.y}) out of bounds` };
    }

    // Check terrain is mineable
    const terrainDefId = map.terrain.get(targetCell.x, targetCell.y);
    const terrainDef = w.defs.terrains.get(terrainDefId);
    if (!terrainDef?.mineable) {
      return { valid: false, reason: `Terrain ${terrainDefId} at (${targetCell.x},${targetCell.y}) is not mineable` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetCell = (cmd.payload.targetCell ?? cmd.payload.cell) as CellCoord;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;

    const designation = createDesignation(
      mapId,
      DesignationType.Mine,
      priority,
      undefined,
      targetCell,
    );
    designation.cell = { x: targetCell.x, y: targetCell.y };
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Mine, targetCell },
      }],
    };
  },
};

// ── designate_cut ──

export const designateCutHandler: CommandHandler = {
  type: 'designate_cut',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    if (!targetObjectId) return { valid: false, reason: 'No target specified' };

    const target = map.objects.get(targetObjectId);
    if (!target) return { valid: false, reason: `Target object ${targetObjectId} not found` };
    if (target.kind !== ObjectKind.Plant) {
      return { valid: false, reason: `Target ${targetObjectId} is not a plant (cuttable)` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;
    const target = map.objects.get(targetObjectId)!;

    const designation = createDesignation(
      mapId,
      DesignationType.Cut,
      priority,
      targetObjectId,
      target.cell,
    );
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Cut, targetObjectId },
      }],
    };
  },
};

// ── cancel_designation ──

export const cancelDesignationHandler: CommandHandler = {
  type: 'cancel_designation',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    const designationId = (cmd.payload.designationId ?? cmd.payload.targetId) as ObjectId;
    if (!designationId) return { valid: false, reason: 'No designation specified' };

    const obj = map.objects.get(designationId);
    if (!obj) return { valid: false, reason: `Designation ${designationId} not found` };
    if (obj.kind !== ObjectKind.Designation) {
      return { valid: false, reason: `Object ${designationId} is not a designation` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = resolveMap(w, cmd)!;

    const designationId = (cmd.payload.designationId ?? cmd.payload.targetId) as ObjectId;
    const designation = map.objects.get(designationId)!;
    designation.destroyed = true;
    map.objects.remove(designationId);

    return {
      events: [{
        type: 'designation_cancelled',
        tick: w.tick,
        data: { designationId },
      }],
    };
  },
};

/** All designation command handlers for batch registration. */
export const designationCommandHandlers: CommandHandler[] = [
  designateHarvestHandler,
  designateMineHandler,
  designateCutHandler,
  cancelDesignationHandler,
];
