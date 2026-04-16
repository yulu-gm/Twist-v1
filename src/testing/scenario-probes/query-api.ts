/**
 * @file query-api.ts
 * @description 只读查询 API — 基于 ScenarioHarness 构建，供 CommandContext 和 ProbeContext 使用。
 *              所有方法只读取世界状态，不做任何修改。
 * @dependencies core/types — 坐标和对象类型；scenario-harness — 测试世界
 * @part-of testing/scenario-probes — 场景观察层
 */

import { ObjectKind, cellKey } from '@core/types';
import type { ScenarioQueryApi } from '../scenario-dsl/scenario.types';
import type { ScenarioHarness } from '../scenario-harness/scenario-harness';

/**
 * 创建只读查询 API
 *
 * @param harness - 场景 harness 实例
 * @param aliases - 别名注册表（alias → objectId 映射）
 * @returns ScenarioQueryApi 实现
 */
export function createScenarioQueryApi(
  harness: ScenarioHarness,
  aliases: Map<string, string>,
): ScenarioQueryApi {
  return {
    findPawnByName(name) {
      return harness.map.objects.allOfKind(ObjectKind.Pawn).find(pawn => pawn.name === name) ?? null;
    },

    findItemAt(defId, cell) {
      return harness.map.objects.allOfKind(ObjectKind.Item).find(item => {
        return item.defId === defId && item.cell.x === cell.x && item.cell.y === cell.y;
      }) ?? null;
    },

    findItemsByDef(defId) {
      return harness.map.objects.allOfKind(ObjectKind.Item).filter(item => item.defId === defId);
    },

    getZoneAt(cell) {
      return harness.map.zones.getZoneAt(cellKey(cell)) ?? null;
    },

    getZonesByType(zoneType) {
      return harness.map.zones.getAll().filter(zone => zone.zoneType === zoneType);
    },

    isReserved(targetId) {
      return harness.map.reservations.isReserved(targetId);
    },

    resolveAlias(alias) {
      return aliases.get(alias) ?? null;
    },

    totalItemCountInCells(defId, cells) {
      const keys = new Set(cells.map(cell => cellKey(cell)));
      return harness.map.objects
        .allOfKind(ObjectKind.Item)
        .filter(item => item.defId === defId && keys.has(cellKey(item.cell)))
        .reduce((sum, item) => sum + item.stackCount, 0);
    },

    totalMaterialCountInWorld(defId) {
      const freeItems = harness.map.objects
        .allOfKind(ObjectKind.Item)
        .filter(item => item.defId === defId)
        .reduce((sum, item) => sum + item.stackCount, 0);

      const deliveredToBlueprints = harness.map.objects
        .allOfKind(ObjectKind.Blueprint)
        .reduce((sum, blueprint: any) => {
          const delivered = blueprint.materialsDelivered
            .filter((entry: any) => entry.defId === defId)
            .reduce((subtotal: number, entry: any) => subtotal + entry.count, 0);
          return sum + delivered;
        }, 0);

      const embeddedInSites = harness.map.objects
        .allOfKind(ObjectKind.ConstructionSite)
        .reduce((sum, site: any) => {
          const buildingDef = harness.world.defs.buildings.get(site.targetDefId);
          const materialCount = buildingDef?.costList
            .filter(cost => cost.defId === defId)
            .reduce((subtotal, cost) => subtotal + cost.count, 0) ?? 0;
          return sum + materialCount;
        }, 0);

      const embeddedInBuildings = harness.map.objects
        .allOfKind(ObjectKind.Building)
        .reduce((sum, building) => {
          const buildingDef = harness.world.defs.buildings.get(building.defId);
          const materialCount = buildingDef?.costList
            .filter(cost => cost.defId === defId)
            .reduce((subtotal, cost) => subtotal + cost.count, 0) ?? 0;
          return sum + materialCount;
        }, 0);

      return freeItems + deliveredToBlueprints + embeddedInSites + embeddedInBuildings;
    },

    findBuildingAt(defId, cell) {
      return harness.map.objects.allOfKind(ObjectKind.Building).find(building => {
        return building.defId === defId && building.cell.x === cell.x && building.cell.y === cell.y;
      }) ?? null;
    },

    findConstructionSiteAt(targetDefId, cell) {
      return harness.map.objects.allOfKind(ObjectKind.ConstructionSite).find((site: any) => {
        return site.targetDefId === targetDefId && site.cell.x === cell.x && site.cell.y === cell.y;
      }) ?? null;
    },

    findBlueprintsByTargetDef(defId) {
      return harness.map.objects.allOfKind(ObjectKind.Blueprint).filter(
        (blueprint: any) => blueprint.targetDefId === defId,
      );
    },

    findPlantAt(cell) {
      return harness.map.objects.allOfKind(ObjectKind.Plant).find(
        plant => plant.cell.x === cell.x && plant.cell.y === cell.y,
      ) ?? null;
    },
  };
}
