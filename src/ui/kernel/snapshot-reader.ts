import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import type { PresentationState } from '../../presentation/presentation-state';
import { ObjectKind } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import type { Building } from '../../features/building/building.types';
import type {
  EngineSnapshot,
  ColonistNode,
  BuildingNode,
  FeedbackSnapshot,
} from './ui-types';

export function readEngineSnapshot(
  world: World,
  map: GameMap,
  presentation: PresentationState,
  feedbackBuffer: FeedbackSnapshot,
): EngineSnapshot {
  const selectedIds = Array.from(presentation.selectedObjectIds);
  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;

  const colonists: Record<string, ColonistNode> = {};
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);
  for (const pawn of pawns) {
    const jobDefId = pawn.ai?.currentJob?.defId ?? 'idle';
    colonists[pawn.id] = {
      id: pawn.id,
      name: pawn.name ?? pawn.id,
      cell: { x: pawn.cell.x, y: pawn.cell.y },
      factionId: pawn.factionId ?? '',
      currentJob: jobDefId,
      currentJobLabel: formatJobLabel(jobDefId),
      needs: {
        food: pawn.needs?.food ?? 0,
        rest: pawn.needs?.rest ?? 0,
        joy: pawn.needs?.joy ?? 0,
        mood: pawn.needs?.mood ?? 0,
      },
      health: {
        hp: pawn.health?.hp ?? 100,
        maxHp: pawn.health?.maxHp ?? 100,
      },
    };
  }

  const buildings: Record<string, BuildingNode> = {};
  const placedBuildings = map.objects.allOfKind(ObjectKind.Building) as Building[];
  for (const building of placedBuildings) {
    const def = world.defs.buildings.get(building.defId);
    buildings[building.id] = {
      id: building.id,
      label: def?.label ?? building.defId,
      defId: building.defId,
      cell: { x: building.cell.x, y: building.cell.y },
      footprint: building.footprint ?? { width: 1, height: 1 },
      category: building.category,
      usageType: building.furniture?.usageType,
      bed: building.bed ? {
        role: building.bed.role,
        ownerPawnId: building.bed.ownerPawnId ?? null,
        occupantPawnId: building.bed.occupantPawnId ?? null,
        autoAssignable: building.bed.autoAssignable,
      } : undefined,
    };
  }

  const activeModeLabel = formatToolModeLabel(
    presentation.activeTool,
    presentation.activeDesignationType,
    presentation.activeBuildDefId,
    presentation.activeZoneType,
  );

  const debugInfo = buildDebugInfo(map, presentation);

  return {
    tick: world.tick,
    speed: world.speed,
    clockDisplay: getClockDisplay(world.clock),
    colonistCount: pawns.length,
    presentation: {
      activeTool: presentation.activeTool,
      activeDesignationType: presentation.activeDesignationType,
      activeZoneType: presentation.activeZoneType,
      activeBuildDefId: presentation.activeBuildDefId,
      hoveredCell: presentation.hoveredCell ? { x: presentation.hoveredCell.x, y: presentation.hoveredCell.y } : null,
      selectedIds,
      showDebugPanel: presentation.showDebugPanel,
      showGrid: presentation.showGrid,
    },
    selection: {
      primaryId,
      selectedIds,
    },
    colonists,
    buildings,
    build: {
      activeTool: presentation.activeTool,
      activeDesignationType: presentation.activeDesignationType,
      activeZoneType: presentation.activeZoneType,
      lastZoneType: presentation.lastZoneType,
      activeBuildDefId: presentation.activeBuildDefId,
      activeModeLabel,
    },
    feedback: feedbackBuffer,
    debugInfo,
  };
}

function formatJobLabel(defId: string): string {
  if (defId === 'idle') return 'Idle';
  return defId
    .replace(/^job_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatToolModeLabel(
  tool: string,
  desType: string | null,
  buildDefId: string | null,
  zoneType: string | null,
): string {
  switch (tool) {
    case 'select': return 'Select';
    case 'build': return buildDefId ? `Build: ${buildDefId}` : 'Build';
    case 'designate': return desType ? `${desType.charAt(0).toUpperCase()}${desType.slice(1)}` : 'Designate';
    case 'zone': return zoneType ? `Zone: ${zoneType}` : 'Zone';
    case 'cancel': return 'Cancel';
    default: return tool;
  }
}

function buildDebugInfo(map: GameMap, presentation: PresentationState): string {
  let dbg = `--- Debug ---\n`;
  dbg += `Tool: ${presentation.activeTool}\n`;
  const hovered = presentation.hoveredCell;
  if (hovered) {
    dbg += `Hover: (${hovered.x}, ${hovered.y})\n`;
    const terrain = map.terrain.get(hovered.x, hovered.y);
    dbg += `Terrain: ${terrain}\n`;
    const objs = map.spatial.getAt(hovered);
    dbg += `Objects: ${objs.length}\n`;
    for (const id of objs) {
      const object = map.objects.get(id);
      if (object) dbg += `  ${object.kind}: ${object.id}\n`;
    }
    dbg += `Passable: ${map.spatial.isPassable(hovered)}\n`;
  }
  dbg += `Total objects: ${map.objects.size}\n`;
  const reservations = map.reservations.getAll();
  dbg += `Reservations: ${reservations.length}\n`;
  return dbg;
}
