/**
 * @file render-utils.ts
 * @description 渲染层共享常量和颜色工具函数
 * @part-of adapter/render — 渲染模块
 */

import { ObjectKind, MapObjectBase, ZoneType } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';

/** 地图格子像素大小 */
export const TILE_SIZE = 32;

/** 渲染层名称与 depth 映射 */
export const LAYER_DEPTH = {
  terrain: 0,
  grid: 1,
  zone: 1.5,
  designation: 2,
  item: 3,
  plant: 4,
  building: 5,
  pawn: 6,
  worldUI: 7,
} as const;

export type LayerName = keyof typeof LAYER_DEPTH;

/** 区域类型 → 基础渲染颜色 */
export function getZoneColor(zoneType: ZoneType): number {
  switch (zoneType) {
    case ZoneType.Stockpile:
      return 0x4dd0e1;
    case ZoneType.Growing:
      return 0x66bb6a;
    case ZoneType.Animal:
      return 0xffb74d;
    default:
      return 0x90a4ae;
  }
}

/** ObjectKind → Container 层映射 */
export function kindToLayer(kind: ObjectKind): LayerName {
  switch (kind) {
    case ObjectKind.Designation: return 'designation';
    case ObjectKind.Item: return 'item';
    case ObjectKind.Plant: return 'plant';
    case ObjectKind.Building: return 'building';
    case ObjectKind.Blueprint: return 'building';
    case ObjectKind.ConstructionSite: return 'building';
    case ObjectKind.Fire: return 'building';
    case ObjectKind.Corpse: return 'item';
    case ObjectKind.Pawn: return 'pawn';
    default: return 'building';
  }
}

// ── 颜色工具函数 ──

/** 将 0xRRGGBB 整数拆分为 {r, g, b} (0-255) */
export function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

/** 将 {r, g, b} 合并为 0xRRGGBB 整数 */
export function rgbToHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/** 对颜色按比例缩放亮度（factor < 1 变暗，> 1 变亮） */
export function scaleColor(hex: number, factor: number): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, Math.max(0, Math.round(r * factor))),
    Math.min(255, Math.max(0, Math.round(g * factor))),
    Math.min(255, Math.max(0, Math.round(b * factor))),
  );
}

/** 根据对象类型和定义获取精灵颜色 */
export function getSpriteColor(obj: MapObjectBase, defs: DefDatabase): number {
  switch (obj.kind) {
    case ObjectKind.Pawn:
      return 0x4fc3f7;
    case ObjectKind.Building: {
      const bDef = defs.buildings.get(obj.defId);
      return bDef?.color ?? 0x888888;
    }
    case ObjectKind.Item: {
      const iDef = defs.items.get(obj.defId);
      return iDef?.color ?? 0xcccccc;
    }
    case ObjectKind.Plant: {
      const pDef = defs.plants.get(obj.defId);
      return pDef?.color ?? 0x22aa22;
    }
    case ObjectKind.Fire:
      return 0xff4500;
    case ObjectKind.Corpse:
      return 0x555555;
    case ObjectKind.Blueprint:
      return 0x66aaff;
    case ObjectKind.ConstructionSite:
      return 0xffaa33;
    case ObjectKind.Designation:
      return 0xffffff;
    default:
      return 0xffffff;
  }
}

/** 根据对象 footprint 获取精灵像素尺寸 */
export function getSpriteSize(obj: MapObjectBase): { w: number; h: number } {
  const fp = obj.footprint ?? { width: 1, height: 1 };
  return { w: fp.width * TILE_SIZE, h: fp.height * TILE_SIZE };
}
