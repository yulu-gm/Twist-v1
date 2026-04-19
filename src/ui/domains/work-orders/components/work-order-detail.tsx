/**
 * @file work-order-detail.tsx
 * @description 工作订单详情面板 — 展示选中订单的 item 列表（状态/阶段/认领）
 * @dependencies work-order.types — WorkOrderDetailViewModel
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import type { WorkOrderDetailViewModel, WorkOrderDetailItem } from '../work-order.types';

/** WorkOrderDetail 组件属性 */
interface WorkOrderDetailProps {
  /** 详情视图模型；为 null 时不渲染 */
  detail: WorkOrderDetailViewModel | null;
}

/** Item 状态对应的中文短名 — 用于状态徽章文案 */
const ITEM_STATUS_LABEL: Record<WorkOrderDetailItem['status'], string> = {
  open: '待领',
  claimed: '已领',
  working: '执行中',
  blocked: '阻塞',
  done: '完成',
  invalid: '失效',
};

/**
 * 单个 item 行 — 状态徽章 + 阶段/原因 + 认领 pawn
 */
function DetailItemRow({ item }: { item: WorkOrderDetailItem }) {
  // 副信息：blocked/invalid 优先显示原因，否则显示当前阶段
  const secondary = (item.status === 'blocked' || item.status === 'invalid')
    ? item.blockedReason
    : item.currentStage;

  return (
    <li class="work-order-detail__item" data-status={item.status}>
      <div class="work-order-detail__item-row">
        <span class={`work-order-pill work-order-pill--item-${item.status}`}>
          {ITEM_STATUS_LABEL[item.status]}
        </span>
        {secondary && <span class="work-order-detail__stage">{secondary}</span>}
      </div>
      {item.claimedByPawnId && (
        <div class="work-order-detail__claim">认领: {item.claimedByPawnId}</div>
      )}
    </li>
  );
}

/**
 * 工作订单详情面板 — 在看板下方展示当前选中订单的 item 明细
 *
 * detail 为 null 时整个面板不渲染（外壳负责条件挂载）。
 * 空 items 列表会渲染 "无 item" 占位提示。
 */
export function WorkOrderDetail({ detail }: WorkOrderDetailProps) {
  if (!detail) return null;

  return (
    <div class="work-order-detail" data-testid="work-order-detail">
      <div class="work-order-detail__title">订单详情 · {detail.title}</div>
      {detail.items.length === 0 ? (
        <div class="work-order-detail__empty">无 item</div>
      ) : (
        <ul class="work-order-detail__list">
          {detail.items.map(item => (
            <DetailItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
