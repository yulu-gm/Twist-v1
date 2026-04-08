/**
 * @file construction.system.ts
 * @description 建造进度系统，负责蓝图→施工工地→建筑的两阶段转换
 * @dependencies core/types, core/tick-runner, core/logger, world/world, world/game-map,
 *               blueprint.types, construction-site.types, building/building.types
 * @part-of 建造系统（construction）
 *
 * 组成部分：
 *   - constructionProgressSystem：每 tick 执行，遍历所有地图处理蓝图和施工工地
 *   - processBlueprints：检测蓝图材料是否齐全，齐全则转换为施工工地
 *   - processConstructionSites：检测施工工地进度是否完成，完成则转换为建筑
 */

import {
  ObjectKind, TickPhase, nextObjectId,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { Blueprint } from './blueprint.types';
import { ConstructionSite } from './construction-site.types';
import { Building } from '../building/building.types';

/**
 * 建造进度系统注册配置
 * 每 tick 执行，在 EXECUTION 阶段处理蓝图转换和施工进度
 */
export const constructionProgressSystem: SystemRegistration = {
  id: 'constructionProgress',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processBlueprints(world, map);
      processConstructionSites(world, map);
    }
  },
};

/**
 * 处理蓝图→施工工地的转换
 * 遍历地图上所有蓝图，检查材料是否全部到位；
 * 若齐全，则移除蓝图，创建施工工地并发出事件
 *
 * @param world - 游戏世界实例，用于访问建筑定义和事件缓冲
 * @param map - 要处理的地图实例
 */
/** When all materials are delivered to a Blueprint, convert it to a ConstructionSite */
function processBlueprints(world: World, map: GameMap): void {
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];

  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    // 检查所有材料是否已运送到位
    // Check if all materials delivered
    let allDelivered = true;
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const required = bp.materialsRequired[i];
      const delivered = bp.materialsDelivered[i];
      if (!delivered || delivered.count < required.count) {
        allDelivered = false;
        break;
      }
    }

    if (!allDelivered) continue;

    // 从建筑定义中获取建造所需总工作量
    // Look up building def for work amount
    const buildingDef = world.defs.buildings.get(bp.targetDefId);
    const totalWork = buildingDef?.workToBuild ?? 100;

    // 创建施工工地对象，继承蓝图的位置和朝向信息
    // Create ConstructionSite
    const site: ConstructionSite = {
      id: nextObjectId(),
      kind: ObjectKind.ConstructionSite,
      defId: `site_${bp.targetDefId}`,
      mapId: bp.mapId,
      cell: { x: bp.cell.x, y: bp.cell.y },
      footprint: bp.footprint,
      tags: new Set(['construction_site', 'construction']),
      destroyed: false,
      targetDefId: bp.targetDefId,
      rotation: bp.rotation,
      buildProgress: 0,
      totalWorkAmount: totalWork,
      workDone: 0,
    };

    // 移除蓝图，将施工工地添加到地图
    // Remove blueprint, add construction site
    map.objects.remove(bp.id);
    map.objects.add(site);

    log.info('construction', `Blueprint ${bp.id} converted to construction site ${site.id}`);

    world.eventBuffer.push({
      type: 'construction_site_created',
      tick: world.tick,
      data: {
        siteId: site.id,
        targetDefId: bp.targetDefId,
        cell: site.cell,
      },
    });
  }
}

/**
 * 处理施工工地→建筑的转换
 * 遍历地图上所有施工工地，检查建造进度是否达到 1.0；
 * 若完成，则移除工地，创建最终建筑，更新寻路网格和房间状态
 *
 * @param world - 游戏世界实例
 * @param map - 要处理的地图实例
 */
/** When a ConstructionSite reaches full progress, convert it to the target Building */
function processConstructionSites(world: World, map: GameMap): void {
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];

  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress < 1.0) continue;

    // 查找建筑定义
    // Look up building def
    const buildingDef = world.defs.buildings.get(site.targetDefId);
    if (!buildingDef) {
      log.error('construction', `Building def ${site.targetDefId} not found for site ${site.id}`);
      continue;
    }

    // 根据定义创建最终建筑对象
    // Create Building object
    const building: Building = {
      id: nextObjectId(),
      kind: ObjectKind.Building,
      defId: site.targetDefId,
      mapId: site.mapId,
      cell: { x: site.cell.x, y: site.cell.y },
      footprint: buildingDef.size,
      tags: new Set(buildingDef.tags),
      destroyed: false,
      hpCurrent: buildingDef.maxHp,
      hpMax: buildingDef.maxHp,
      rotation: site.rotation,
    };

    // 若建筑定义了交互格偏移量，则挂载交互组件
    // Attach interaction component if building has an interaction cell offset
    if (buildingDef.interactionCellOffset) {
      building.interaction = {
        interactionCell: {
          x: site.cell.x + buildingDef.interactionCellOffset.x,
          y: site.cell.y + buildingDef.interactionCellOffset.y,
        },
      };
    }

    // 移除施工工地，将建筑添加到地图
    // Remove site, add building
    map.objects.remove(site.id);
    map.objects.add(building);

    // 若建筑阻挡移动，更新寻路网格将其占用的格子标记为不可通行
    // Update pathGrid if building blocks movement
    if (buildingDef.blocksMovement) {
      const fp = buildingDef.size;
      for (let dy = 0; dy < fp.height; dy++) {
        for (let dx = 0; dx < fp.width; dx++) {
          map.pathGrid.setPassable(site.cell.x + dx, site.cell.y + dy, false);
        }
      }
    }

    // 标记房间系统为脏状态 —— 新的墙壁/门可能形成新房间
    // Mark rooms dirty — new wall/door may form new rooms
    map.rooms.markDirty();

    log.info('construction', `Construction complete: ${site.targetDefId} at (${site.cell.x},${site.cell.y})`, {
      buildingId: building.id,
    });

    world.eventBuffer.push({
      type: 'construction_completed',
      tick: world.tick,
      data: {
        buildingId: building.id,
        defId: site.targetDefId,
        cell: site.cell,
      },
    });
  }
}
