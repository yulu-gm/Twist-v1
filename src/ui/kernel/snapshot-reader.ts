/**
 * @file snapshot-reader.ts
 * @description 引擎快照读取器 — 从游戏世界状态构建完整的 EngineSnapshot
 * @dependencies world/world — 世界状态；world/game-map — 地图数据；
 *               presentation — 展示层状态；core/types — ObjectKind；
 *               core/clock — 时钟显示格式化；ui-types — 快照类型定义
 *               （含 EngineSnapshot/ColonistNode/BuildingNode/ObjectNode/
 *                WorkOrderNode/WorkOrderItemNode/WorkOrdersSnapshot/FeedbackSnapshot）；
 *               features/pawn — Pawn 类型（殖民者数据提取）；
 *               features/building — Building 类型（建筑数据提取）；
 *               features/construction — Blueprint/ConstructionSite 类型；
 *               features/item — Item 类型；features/plant — Plant 类型
 * @part-of ui/kernel — UI 内核层
 *
 * 这是 Phaser 游戏世界与 Preact UI 之间的数据转换层。
 * 每帧由 bridge.emit() 调用一次，将可变的游戏对象转换为不可变的纯数据快照。
 */

import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import type { PresentationState } from '../../presentation/presentation-state';
import { ObjectKind } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import type { Building } from '../../features/building/building.types';
import type { Blueprint } from '../../features/construction/blueprint.types';
import type { ConstructionSite } from '../../features/construction/construction-site.types';
import type { Item } from '../../features/item/item.types';
import type { Plant } from '../../features/plant/plant.types';
import type {
  EngineSnapshot,
  ColonistNode,
  BuildingNode,
  ObjectNode,
  FeedbackSnapshot,
  WorkOrderNode,
  WorkOrderItemNode,
  WorkOrdersSnapshot,
} from './ui-types';

/**
 * 读取引擎快照 — 从游戏状态构建完整的 UI 数据包
 *
 * @param world - 游戏世界对象
 * @param map - 当前激活的地图
 * @param presentation - 展示层状态
 * @param feedbackBuffer - 事件反馈缓冲（由 eventBus.onAny 持续填充）
 * @returns 完整的引擎快照，供 UI 组件消费
 *
 * 操作：
 * 1. 提取选中 ID 列表
 * 2. 遍历所有 Pawn 构建殖民者数据映射
 * 3. 遍历所有 Building 构建建筑数据映射
 * 4. 构建统一对象节点字典（含 Pawn/Building/Blueprint/ConstructionSite/Item/Plant）
 * 5. 格式化工具模式标签
 * 6. 构建调试信息文本
 * 7. 组装并返回完整快照
 */
export function readEngineSnapshot(
  world: World,
  map: GameMap,
  presentation: PresentationState,
  feedbackBuffer: FeedbackSnapshot,
): EngineSnapshot {
  const selectedIds = Array.from(presentation.selectedObjectIds);
  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;

  // 遍历所有 Pawn 对象，提取殖民者数据
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
      workDecision: pawn.ai.workDecision ? {
        evaluatedAtTick: pawn.ai.workDecision.evaluatedAtTick,
        selectedWorkKind: pawn.ai.workDecision.selectedWorkKind,
        selectedWorkLabel: pawn.ai.workDecision.selectedWorkLabel,
        // 从当前 job 实时读取 toil 信息，而非使用冻结快照中的过期值
        activeToilLabel: pawn.ai.currentJob?.toils[pawn.ai.currentJob.currentToilIndex]?.type ?? null,
        activeToilState: pawn.ai.currentJob?.toils[pawn.ai.currentJob.currentToilIndex]?.state ?? null,
        options: pawn.ai.workDecision.options.map(option => ({
          kind: option.kind,
          label: option.label,
          status: option.status,
          detail: option.detail,
          failureReasonText: option.failureReasonText,
        })),
      } : null,
    };
  }

  // 遍历所有 Building 对象，提取建筑数据
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

  // 构建统一对象节点字典 — Inspector 数据源
  const objects: Record<string, ObjectNode> = {};

  // 将已映射的 Pawn 加入统一字典
  for (const pawn of pawns) {
    const c = colonists[pawn.id];
    objects[pawn.id] = {
      id: pawn.id,
      kind: 'pawn',
      label: c.name,
      defId: 'pawn',
      cell: { x: pawn.cell.x, y: pawn.cell.y },
      footprint: pawn.footprint ?? { width: 1, height: 1 },
      currentJobLabel: c.currentJobLabel,
      needs: c.needs,
      health: c.health,
      workDecision: c.workDecision,
    };
  }

  // 将已映射的 Building 加入统一字典
  for (const building of placedBuildings) {
    const b = buildings[building.id];
    objects[building.id] = {
      id: building.id,
      kind: 'building',
      label: b.label,
      defId: b.defId,
      cell: b.cell,
      footprint: b.footprint,
      category: b.category,
      usageType: b.usageType,
      bed: b.bed,
    };
  }

  // 映射 Blueprint 对象
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint) as Blueprint[];
  for (const bp of blueprints) {
    objects[bp.id] = {
      id: bp.id,
      kind: 'blueprint',
      label: `Blueprint: ${bp.targetDefId}`,
      defId: bp.defId,
      cell: { x: bp.cell.x, y: bp.cell.y },
      footprint: bp.footprint ?? { width: 1, height: 1 },
      targetDefId: bp.targetDefId,
      materialsRequired: bp.materialsRequired.map(m => ({ defId: m.defId, count: m.count })),
      materialsDelivered: bp.materialsDelivered.map(m => ({ defId: m.defId, count: m.count })),
    };
  }

  // 映射 ConstructionSite 对象
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite) as ConstructionSite[];
  for (const site of sites) {
    objects[site.id] = {
      id: site.id,
      kind: 'construction_site',
      label: `Construction: ${site.targetDefId}`,
      defId: site.defId,
      cell: { x: site.cell.x, y: site.cell.y },
      footprint: site.footprint ?? { width: 1, height: 1 },
      targetDefId: site.targetDefId,
      buildProgress: site.buildProgress,
    };
  }

  // 映射 Item 对象
  const items = map.objects.allOfKind(ObjectKind.Item) as Item[];
  for (const item of items) {
    const itemDef = world.defs.items.get(item.defId);
    objects[item.id] = {
      id: item.id,
      kind: 'item',
      label: itemDef?.label ?? item.defId,
      defId: item.defId,
      cell: { x: item.cell.x, y: item.cell.y },
      footprint: item.footprint ?? { width: 1, height: 1 },
      stackCount: item.stackCount,
    };
  }

  // 映射 Plant 对象
  const plants = map.objects.allOfKind(ObjectKind.Plant) as Plant[];
  for (const plant of plants) {
    const plantDef = world.defs.plants.get(plant.defId);
    objects[plant.id] = {
      id: plant.id,
      kind: 'plant',
      label: plantDef?.label ?? plant.defId,
      defId: plant.defId,
      cell: { x: plant.cell.x, y: plant.cell.y },
      footprint: plant.footprint ?? { width: 1, height: 1 },
      growth: plant.growthProgress,
      harvestReady: plant.harvestReady,
    };
  }

  // 格式化工具模式标签（如 "Select"、"Build: wall_wood"、"Zone: stockpile"）
  const activeModeLabel = formatToolModeLabel(
    presentation.activeTool,
    presentation.activeDesignationType,
    presentation.activeBuildDefId,
    presentation.activeZoneType,
  );

  // 投影工作订单 — 看板/详情面板的数据源；list 与 byId 中的节点必须是同一引用
  const workOrders = buildWorkOrdersSnapshot(map);

  // 构建调试面板的信息文本
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
      // 命令栏菜单路径以独立拷贝下发，确保快照不可变
      commandMenuPath: [...presentation.commandMenuPath],
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
    objects,
    build: {
      activeTool: presentation.activeTool,
      activeDesignationType: presentation.activeDesignationType,
      activeZoneType: presentation.activeZoneType,
      lastZoneType: presentation.lastZoneType,
      activeBuildDefId: presentation.activeBuildDefId,
      activeModeLabel,
    },
    feedback: feedbackBuffer,
    workOrders,
    debugInfo,
  };
}

/**
 * 格式化任务定义 ID 为可读标签
 *
 * @param defId - 任务定义 ID（如 'idle'、'job_haul_item'）
 * @returns 格式化后的标签（如 'Idle'、'Haul Item'）
 */
function formatJobLabel(defId: string): string {
  if (defId === 'idle') return 'Idle';
  return defId
    .replace(/^job_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * 格式化工具模式为显示标签
 *
 * @param tool - 工具类型
 * @param desType - 指派类型（可选）
 * @param buildDefId - 建筑定义 ID（可选）
 * @param zoneType - 区域类型（可选）
 * @returns 模式标签（如 'Select'、'Build: wall_wood'、'Zone: stockpile'）
 */
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

/**
 * 构建调试面板的信息文本
 *
 * @param map - 当前地图（用于查询地形/对象/预约）
 * @param presentation - 展示层状态（用于获取悬停格子信息）
 * @returns 预格式化的多行调试字符串
 */
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

/**
 * 投影 WorkOrderStore 为只读 WorkOrdersSnapshot
 *
 * 字段语义：
 * - totalItemCount = items.length
 * - doneItemCount = items 中 status='done' 的个数
 * - activeWorkerCount = items 中 truthy claimedByPawnId 的去重数量
 * - blocked = 没有任何 item 处于 open/claimed/working
 *   （即所有 item 都在 blocked/invalid/done 之中 — 订单失去推进能力）
 *
 * `byId[id]` 与 `list` 中对应元素必须是同一对象引用，便于 Preact memo 等值比较。
 *
 * @param map - 当前地图（其 workOrders 为订单源）
 * @returns 工作订单快照
 */
function buildWorkOrdersSnapshot(map: GameMap): WorkOrdersSnapshot {
  const orders = map.workOrders.list();
  const list: WorkOrderNode[] = [];
  const byId: Record<string, WorkOrderNode> = {};

  for (const order of orders) {
    let doneItemCount = 0;
    // 用 Set 去重活跃工人 ID
    const activeWorkers = new Set<string>();
    // 推进能力探测 — 一旦有 item 仍处可推进态（open/claimed/working），订单不算 blocked
    let hasProgressable = false;

    const items: WorkOrderItemNode[] = order.items.map(it => {
      if (it.status === 'done') doneItemCount += 1;
      if (it.claimedByPawnId) activeWorkers.add(it.claimedByPawnId);
      if (it.status === 'open' || it.status === 'claimed' || it.status === 'working') {
        hasProgressable = true;
      }
      return {
        id: it.id,
        status: it.status,
        currentStage: it.currentStage ?? null,
        claimedByPawnId: it.claimedByPawnId ?? null,
        blockedReason: it.blockedReason ?? null,
      };
    });

    const node: WorkOrderNode = {
      id: order.id,
      title: order.title,
      orderKind: order.orderKind,
      sourceKind: order.sourceKind,
      status: order.status,
      priorityIndex: order.priorityIndex,
      totalItemCount: order.items.length,
      doneItemCount,
      activeWorkerCount: activeWorkers.size,
      // 订单整体阻塞 — 没有可推进 item 时为 true（包括空 item 列表的极端情形）
      blocked: !hasProgressable,
      items,
    };

    list.push(node);
    byId[order.id] = node;
  }

  return { list, byId };
}
