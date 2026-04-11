/**
 * @file colonist.selectors.ts
 * @description 殖民者领域的选择器 — 从 EngineSnapshot + UiState 派生列表和检查器视图模型
 * @dependencies ui/kernel/ui-types — EngineSnapshot, UiState, ColonistNode；
 *               colonist.types — ColonistRosterRow, ColonistInspectorViewModel, NeedViewModel；
 *               colonist.schemas — needDefs
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import type { EngineSnapshot, UiState, ColonistNode } from '../../kernel/ui-types';
import type { ColonistRosterRow, ColonistInspectorViewModel, NeedViewModel, WorkQueueRowViewModel } from './colonist.types';
import { needDefs } from './colonist.schemas';

/**
 * 选择殖民者列表行 — 从快照中提取所有殖民者并应用搜索和排序
 *
 * @param snapshot - 引擎快照
 * @param uiState - UI 本地状态（提供搜索词和排序方式）
 * @returns 排序过滤后的殖民者行列表
 *
 * 操作：构建行数据 → 按搜索词过滤 → 按排序字段排序
 */
export function selectColonistRosterRows(
  snapshot: EngineSnapshot,
  uiState: UiState,
): ColonistRosterRow[] {
  const selectedIds = new Set(snapshot.selection.selectedIds);
  const rows: ColonistRosterRow[] = Object.values(snapshot.colonists).map(c => ({
    id: c.id,
    name: c.name,
    currentJob: c.currentJob,
    currentJobLabel: c.currentJobLabel,
    mood: c.needs.mood,
    isSelected: selectedIds.has(c.id),
  }));

  // 按搜索关键词过滤（不区分大小写）
  const search = uiState.colonistSearch.toLowerCase();
  const filtered = search
    ? rows.filter(r => r.name.toLowerCase().includes(search))
    : rows;

  // 按指定字段排序
  return filtered.sort((a, b) => {
    switch (uiState.colonistSort) {
      case 'mood':
        return b.mood - a.mood;
      case 'job':
        return a.currentJob.localeCompare(b.currentJob);
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

/**
 * 选择殖民者检查器视图模型 — 当前选中的单个殖民者详情
 *
 * @param snapshot - 引擎快照
 * @param _uiState - UI 本地状态（预留，当前未使用）
 * @returns 检查器视图模型，无选中时返回 null
 */
export function selectColonistInspector(
  snapshot: EngineSnapshot,
  _uiState: UiState,
): ColonistInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId) return null;

  const colonist = snapshot.colonists[primaryId];
  if (!colonist) return null;

  return buildInspectorViewModel(colonist);
}

/**
 * 从殖民者节点数据构建检查器视图模型
 *
 * @param c - 殖民者节点（来自快照）
 * @returns 包含需求条列表和工作队列的完整检查器视图模型
 */
function buildInspectorViewModel(c: ColonistNode): ColonistInspectorViewModel {
  const needs: NeedViewModel[] = needDefs.map(def => ({
    key: def.key,
    label: def.label,
    value: c.needs[def.key as keyof typeof c.needs],
    color: def.color,
  }));

  return {
    id: c.id,
    name: c.name,
    cell: c.cell,
    factionId: c.factionId,
    jobLabel: c.currentJobLabel,
    health: c.health,
    needs,
    workQueue: buildWorkQueue(c),
  };
}

/**
 * 从殖民者节点的工作决策快照构建工作队列行
 *
 * @param c - 殖民者节点（来自快照）
 * @returns 工作队列行列表，无快照时返回空数组
 */
function buildWorkQueue(c: ColonistNode): WorkQueueRowViewModel[] {
  if (!c.workDecision) return [];

  return c.workDecision.options.map(option => {
    if (option.status === 'active') {
      const toilLabel = c.workDecision?.activeToilLabel ?? 'unknown';
      const toilState = c.workDecision?.activeToilState ?? 'unknown';
      return { label: option.label, tone: 'active' as const, detail: `${toilLabel} (${toilState})` };
    }
    if (option.status === 'blocked') {
      return { label: option.label, tone: 'blocked' as const, detail: option.failureReasonText };
    }
    return { label: option.label, tone: 'deferred' as const, detail: null };
  });
}
