/**
 * @file inspector-adapters.ts
 * @description Inspector adapter 注册表 — 集中管理所有对象类型的 Inspector adapter
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectInspectorAdapter } from '../inspector.types';
import { pawnInspectorAdapter } from './pawn-inspector.adapter';
import { buildingInspectorAdapter } from './building-inspector.adapter';
import { blueprintInspectorAdapter } from './blueprint-inspector.adapter';
import { constructionSiteInspectorAdapter } from './construction-site-inspector.adapter';
import { itemInspectorAdapter } from './item-inspector.adapter';
import { plantInspectorAdapter } from './plant-inspector.adapter';

/**
 * 已注册的 Inspector adapter 列表
 *
 * 顺序决定匹配优先级 — 第一个 supports() 返回 true 的 adapter 被使用
 * 顺序：pawn > blueprint > construction_site > building > item > plant（与 KIND_PRIORITY 对齐）
 */
export const inspectorAdapters: ObjectInspectorAdapter[] = [
  pawnInspectorAdapter,
  blueprintInspectorAdapter,
  constructionSiteInspectorAdapter,
  buildingInspectorAdapter,
  itemInspectorAdapter,
  plantInspectorAdapter,
];
