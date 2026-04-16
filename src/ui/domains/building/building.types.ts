/**
 * @file building.types.ts
 * @description 建筑检视面板的视图模型类型
 * @part-of ui/domains/building — 建筑 UI 领域
 */

/** 建筑检视面板中的单条属性行 */
interface BuildingInspectorStat {
  /** 属性名称（如 'Type'、'Position'） */
  label: string;
  /** 属性显示值 */
  value: string;
}

/** 建筑检视面板基础信息（所有建筑共享） */
export interface BuildingInspectorBaseViewModel {
  /** 建筑对象ID */
  id: string;
  /** 建筑显示名称 */
  label: string;
  /** 属性列表 */
  stats: BuildingInspectorStat[];
}

/** 床位检视面板专属信息 */
export interface BedInspectorDetailViewModel {
  /** 床位角色（如 'Public'、'Owned'） */
  role: string;
  /** 所有者显示标签（无主时为 'Unassigned'） */
  ownerLabel: string;
  /** 占用者显示标签（空床时为 'Empty'） */
  occupantLabel: string;
  /** 可分配的殖民者列表 */
  availableOwners: Array<{ id: string; label: string }>;
}

/** 建筑检视面板视图模型 — 通用建筑或床位专属 */
export type BuildingInspectorViewModel =
  | { kind: 'generic'; base: BuildingInspectorBaseViewModel }
  | { kind: 'bed'; base: BuildingInspectorBaseViewModel; detail: BedInspectorDetailViewModel };
