/**
 * @file inspector-adapters.ts
 * @description Inspector adapter 注册表 — 集中管理所有对象类型的 Inspector adapter
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectInspectorAdapter } from '../inspector.types';
import { pawnInspectorAdapter } from './pawn-inspector.adapter';
import { buildingInspectorAdapter } from './building-inspector.adapter';

/**
 * 已注册的 Inspector adapter 列表
 *
 * 顺序决定匹配优先级 — 第一个 supports() 返回 true 的 adapter 被使用
 * 后续 task 将在此列表中添加更多 adapter
 */
export const inspectorAdapters: ObjectInspectorAdapter[] = [
  pawnInspectorAdapter,
  buildingInspectorAdapter,
];
