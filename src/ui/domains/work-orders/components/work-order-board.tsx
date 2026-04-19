/**
 * @file work-order-board.tsx
 * @description 工作订单看板 — 左侧面板，标题条始终可见，列表区可折叠
 * @dependencies work-order.types — WorkOrderRow, WorkOrderDetailViewModel；
 *               work-order-detail — 详情子面板
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 设计要点：
 * - 标题条 "工作订单" 始终可见，前置雪佛龙 ▸/▾，整条可点击触发 onToggle
 * - 列表区根据 expanded 决定渲染（收起态完全不渲染列表与详情）
 * - 行内显示：优先级编号 + 标题 + 来源/进度/工人/状态徽章
 * - 行根据 displayPhase 加 class：
 *   - 'completing' → work-order-row--completing（显示 ✓ + 标题划线）
 *   - 'exiting'    → work-order-row--exiting（淡出 + 高度收 0）
 */

import type { WorkOrderRow, WorkOrderDetailViewModel } from '../work-order.types';
import { WorkOrderDetail } from './work-order-detail';

/** WorkOrderBoard 组件属性 */
interface WorkOrderBoardProps {
  /** 订单行列表 */
  rows: WorkOrderRow[];
  /** 当前选中订单 ID（无选中则 null） */
  selectedOrderId: string | null;
  /** 是否展开（标题条始终显示，列表区受此控制） */
  expanded: boolean;
  /** 切换展开/收起 — 标题条点击回调 */
  onToggle: () => void;
  /** 选中订单详情视图模型（无选中则 null） */
  detail: WorkOrderDetailViewModel | null;
  /** 选中行回调 */
  onSelect: (orderId: string) => void;
  /** 暂停订单回调 */
  onPause: (orderId: string) => void;
  /** 继续订单回调 */
  onResume: (orderId: string) => void;
  /** 取消订单回调 */
  onCancel: (orderId: string) => void;
}

/** 订单整体状态对应的中文短名 — 用于状态徽章文案 */
const ORDER_STATUS_LABEL: Record<WorkOrderRow['status'], string> = {
  pending: '待开始',
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
  cancelled: '已取消',
};

/** 来源对应的中文短名 — 用于来源徽章文案 */
const SOURCE_LABEL: Record<WorkOrderRow['sourceKind'], string> = {
  map: '地图',
  result: '工作台',
};

/**
 * 单行订单 — 命中点击区为整个 button，操作按钮通过 stopPropagation 防止冒泡
 */
function WorkOrderRowItem({
  row,
  isSelected,
  onSelect,
  onPause,
  onResume,
  onCancel,
}: {
  row: WorkOrderRow;
  isSelected: boolean;
  onSelect: (orderId: string) => void;
  onPause: (orderId: string) => void;
  onResume: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}) {
  // 暂停按钮：当订单为 paused 状态时切换为继续按钮
  const isPaused = row.status === 'paused';
  // 终态订单（done/cancelled）禁用所有操作
  const isTerminal = row.status === 'done' || row.status === 'cancelled';

  // 状态徽章颜色：blocked > status 派生
  const statusToken = row.blocked && !isTerminal ? 'blocked' : row.status;

  // displayPhase 派生 class — completing 显示 ✓ + 划线；exiting 淡出 + 收高
  const phaseClass = row.displayPhase === 'completing'
    ? 'work-order-row--completing'
    : row.displayPhase === 'exiting'
      ? 'work-order-row--exiting'
      : '';

  return (
    <li
      class={`work-order-row ${isSelected ? 'is-selected' : ''} ${phaseClass}`}
      data-status={row.status}
    >
      <button
        type="button"
        class="work-order-row__main"
        onClick={() => onSelect(row.id)}
      >
        <span class="work-order-row__handle" aria-hidden="true">⋮⋮</span>
        <span class="work-order-row__priority">
          {row.displayPhase === 'completing' ? '✓' : row.priorityIndex + 1}
        </span>
        <div class="work-order-row__body">
          <div class="work-order-row__title">{row.title}</div>
          <div class="work-order-row__meta">
            <span class={`work-order-pill work-order-pill--source-${row.sourceKind}`}>
              {SOURCE_LABEL[row.sourceKind]}
            </span>
            <span class={`work-order-pill work-order-pill--status-${statusToken}`}>
              {row.blocked && !isTerminal ? '阻塞' : ORDER_STATUS_LABEL[row.status]}
            </span>
            <span class="work-order-row__progress">{row.progressLabel}</span>
            <span class="work-order-row__workers">{row.activeWorkerLabel}</span>
          </div>
        </div>
      </button>
      <div class="work-order-row__actions">
        {isPaused ? (
          <button
            type="button"
            class="work-order-row__btn"
            disabled={isTerminal}
            onClick={(e) => { e.stopPropagation(); onResume(row.id); }}
          >
            继续
          </button>
        ) : (
          <button
            type="button"
            class="work-order-row__btn"
            disabled={isTerminal}
            onClick={(e) => { e.stopPropagation(); onPause(row.id); }}
          >
            暂停
          </button>
        )}
        <button
          type="button"
          class="work-order-row__btn work-order-row__btn--danger"
          disabled={isTerminal}
          onClick={(e) => { e.stopPropagation(); onCancel(row.id); }}
        >
          取消
        </button>
      </div>
    </li>
  );
}

/**
 * 工作订单看板 — 左侧 ui-panel
 *
 * 行列表渲染顺序由 selector 给出（按 priorityIndex 升序）。
 * 标题条始终可见，列表区根据 expanded 决定渲染。
 * 选中订单后在底部嵌入 WorkOrderDetail 子面板（仅 expanded 时）。
 */
export function WorkOrderBoard({
  rows,
  selectedOrderId,
  expanded,
  onToggle,
  detail,
  onSelect,
  onPause,
  onResume,
  onCancel,
}: WorkOrderBoardProps) {
  return (
    <div class="work-order-board ui-panel" data-testid="work-order-board">
      <button
        type="button"
        class={`work-order-board__header ${expanded ? 'is-expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span class="work-order-board__chevron" aria-hidden="true">▾</span>
        <span>工作订单</span>
        {rows.length > 0 && (
          <span class="work-order-board__count">{rows.length}</span>
        )}
      </button>
      <div class={`work-order-board__body ${expanded ? 'is-expanded' : ''}`} aria-hidden={!expanded}>
        {rows.length === 0 ? (
          <div class="work-order-board__empty">当前没有订单</div>
        ) : (
          <ul class="work-order-board__list">
            {rows.map(row => (
              <WorkOrderRowItem
                key={row.id}
                row={row}
                isSelected={row.id === selectedOrderId}
                onSelect={onSelect}
                onPause={onPause}
                onResume={onResume}
                onCancel={onCancel}
              />
            ))}
          </ul>
        )}
        <WorkOrderDetail detail={detail} />
      </div>
    </div>
  );
}
