/**
 * @file zone.types.ts
 * @description 区域类型的重导出模块——从 world 层和 core 层统一导出区域相关类型与默认配置工具
 * @dependencies Zone/ZoneConfig — 来自 world/zone-manager；ZoneType — 来自 core/types
 * @part-of features/zone — 区域管理功能
 */

export type {
  Zone,
  ZoneConfig,
} from '../../world/zone-manager';
export {
  createDefaultZoneConfig,
  normalizeZoneConfig,
} from '../../world/zone-manager';
export { ZoneType } from '../../core/types';
