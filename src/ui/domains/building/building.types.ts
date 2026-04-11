/**
 * @file building.types.ts
 * @description 建筑检视面板的视图模型类型
 * @part-of ui/domains/building — 建筑 UI 领域
 */

/** 建筑检视面板中的单条属性行 */
export interface BuildingInspectorStat {
  /** 属性名称（如 'Type'、'Position'） */
  label: string;
  /** 属性显示值 */
  value: string;
}

/** 建筑检视面板视图模型 */
export interface BuildingInspectorViewModel {
  /** 建筑对象ID */
  id: string;
  /** 建筑显示名称 */
  label: string;
  /** 属性列表 */
  stats: BuildingInspectorStat[];
}
