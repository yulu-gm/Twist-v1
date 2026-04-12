/**
 * @file inspector.types.ts
 * @description 统一 Object Inspector 的视图模型类型定义
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ComponentChildren } from 'preact';
import type { ObjectNode } from '../../kernel/ui-types';

/** 对象栈条目 — 同格对象导航中的单个对象 */
export interface ObjectStackEntryViewModel {
  /** 对象 ID */
  id: string;
  /** 对象显示名称 */
  label: string;
  /** 对象类型 */
  kind: string;
  /** 是否为当前 Inspector target */
  isActive: boolean;
}

/** 通用属性行 */
export interface InspectorStatRow {
  /** 属性名称 */
  label: string;
  /** 属性显示值 */
  value: string;
}

/** 专属 Inspector 区块 */
export interface InspectorSection {
  /** 区块 ID */
  id: string;
  /** 区块标题 */
  title: string;
  /** 区块内的属性行 */
  rows: InspectorStatRow[];
}

/** 专属 Inspector 操作按钮 */
export interface InspectorAction {
  /** 操作 ID */
  id: string;
  /** 操作显示名称 */
  label: string;
  /** 是否可用 */
  enabled: boolean;
}

/** Inspector body 区域的回调接口 — 传给 renderBody 供交互元素使用 */
export interface InspectorBodyCallbacks {
  /** 执行通用操作按钮 */
  onRunAction: (actionId: string, targetId: string) => void;
  /** 指派床位所有者 */
  onAssignBedOwner: (bedId: string, pawnId: string) => void;
  /** 清除床位所有者 */
  onClearBedOwner: (bedId: string) => void;
}

/** Generic fallback 视图模型 — 对象缺少专用 Inspector 时的降级态 */
export interface GenericInspectorViewModel {
  /** 视图模式标识 */
  mode: 'generic';
  /** 当前 Inspector target 的对象 ID */
  targetId: string;
  /** 对象显示名称 */
  title: string;
  /** 对象类型标签 */
  subtitle: string;
  /** 同格对象栈 */
  stack: ObjectStackEntryViewModel[];
  /** 降级提示文案 */
  fallbackNotice: string;
  /** 基础属性列表 */
  stats: InspectorStatRow[];
}

/** 专属 Inspector 视图模型 — 有对应 adapter 的对象 */
export interface SpecializedInspectorViewModel {
  /** 视图模式标识 */
  mode: 'specialized';
  /** 当前 Inspector target 的对象 ID */
  targetId: string;
  /** 对象显示名称 */
  title: string;
  /** 对象类型标签 */
  subtitle: string;
  /** 同格对象栈 */
  stack: ObjectStackEntryViewModel[];
  /** 专属区块列表（renderBody 未提供时使用的降级渲染数据） */
  sections: InspectorSection[];
  /** 操作按钮列表 */
  actions: InspectorAction[];
  /** 自定义渲染体 — adapter 提供的富内容渲染函数，优先于 sections 渲染 */
  renderBody?: (callbacks: InspectorBodyCallbacks) => ComponentChildren;
}

/** 统一 Inspector 视图模型联合类型 */
export type ObjectInspectorViewModel = GenericInspectorViewModel | SpecializedInspectorViewModel;

/** Inspector adapter 接口 — 对象类型专属 Inspector 的适配器 */
export interface ObjectInspectorAdapter {
  /** adapter ID */
  id: string;
  /** 判断是否支持给定对象 */
  supports(object: ObjectNode): boolean;
  /** 构建专属视图模型 */
  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel;
}

/** adapter 构建上下文 */
export interface AdapterContext {
  /** 当前 target ID */
  targetId: string;
  /** 同格对象栈 */
  stack: ObjectStackEntryViewModel[];
  /** 完整快照（adapter 可能需要读取其他数据） */
  snapshot: import('../../kernel/ui-types').EngineSnapshot;
}
