/**
 * @file inspector.selectors.ts
 * @description 统一 Object Inspector 选择器 — 从 EngineSnapshot + UiState 构建 Inspector 视图模型
 * @dependencies ui/kernel/ui-types — EngineSnapshot, UiState, ObjectNode
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { EngineSnapshot, UiState, ObjectNode } from '../../kernel/ui-types';
import type {
  ObjectInspectorViewModel,
  ObjectStackEntryViewModel,
  ObjectInspectorAdapter,
} from './inspector.types';
import { inspectorAdapters } from './adapters/inspector-adapters';

/** 已注册的 Inspector adapter 列表 — 默认使用全局 adapter 注册表 */
let registeredAdapters: ObjectInspectorAdapter[] = inspectorAdapters;

/**
 * 注册 Inspector adapter 列表（可用于测试替换）
 */
export function registerInspectorAdapters(adapters: ObjectInspectorAdapter[]): void {
  registeredAdapters = adapters;
}

/** 对象类型排序优先级：Pawn > Blueprint > ConstructionSite > Building > Item > Plant > 其他 */
const KIND_PRIORITY: Record<string, number> = {
  pawn: 0,
  blueprint: 1,
  construction_site: 2,
  building: 3,
  item: 4,
  plant: 5,
};

/** 比较两个对象在 Inspector 栈中的优先级 */
function compareInspectorPriority(a: ObjectNode, b: ObjectNode): number {
  const pa = KIND_PRIORITY[a.kind] ?? 99;
  const pb = KIND_PRIORITY[b.kind] ?? 99;
  return pa - pb;
}

/**
 * 从引擎快照和 UI 状态构建统一 Object Inspector 视图模型
 *
 * @param snapshot - 引擎快照
 * @param uiState - UI 本地状态
 * @returns Inspector 视图模型，无选中时返回 null
 *
 * 逻辑：
 * 1. 取主选中对象 → 找到同格所有对象 → 排序生成对象栈
 * 2. 从 uiState.inspectorTargetId 或 primaryId 确定当前 target
 * 3. 遍历已注册 adapter，找到第一个支持该对象的 adapter → 专属模式
 * 4. 无匹配 adapter → generic fallback 模式
 */
export function selectObjectInspector(
  snapshot: EngineSnapshot,
  uiState: UiState,
): ObjectInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId) return null;

  const primary = snapshot.objects[primaryId];
  if (!primary) return null;

  // 找到同格的所有对象并按优先级排序
  const stackObjects = Object.values(snapshot.objects)
    .filter(obj => obj.cell.x === primary.cell.x && obj.cell.y === primary.cell.y && !obj.destroyed)
    .sort(compareInspectorPriority);

  // 确定当前 Inspector target：优先使用 uiState.inspectorTargetId（若在栈中）
  const targetId = uiState.inspectorTargetId && stackObjects.some(obj => obj.id === uiState.inspectorTargetId)
    ? uiState.inspectorTargetId
    : primaryId;
  const target = stackObjects.find(obj => obj.id === targetId) ?? primary;

  // 构建对象栈条目
  const stack: ObjectStackEntryViewModel[] = stackObjects.map(obj => ({
    id: obj.id,
    label: obj.label,
    kind: obj.kind,
    isActive: obj.id === targetId,
  }));

  // 尝试匹配专属 adapter
  const adapter = registeredAdapters.find(a => a.supports(target));
  if (adapter) {
    return adapter.buildViewModel(target, { targetId, stack, snapshot });
  }

  // 无匹配 adapter → generic fallback
  return {
    mode: 'generic',
    targetId,
    title: target.label,
    subtitle: target.kind,
    stack,
    fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
    stats: [
      { label: 'Kind', value: target.kind },
      { label: 'Def', value: target.defId },
      { label: 'Position', value: `(${target.cell.x}, ${target.cell.y})` },
      { label: 'Size', value: `${target.footprint.width}x${target.footprint.height}` },
    ],
  };
}
