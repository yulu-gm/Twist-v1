/**
 * @file ui-ports.ts
 * @description UI 端口接口 — 定义 Preact UI 向游戏引擎发出副作用的边界
 * @dependencies core/command-bus — Command 类型
 * @part-of ui/kernel — UI 内核层
 *
 * 设计要点：
 * - UI 组件只通过 UiPorts 发出副作用（发命令、切工具、跳摄像机等）
 * - 组件不直接接触 World、GameMap 或 PresentationState
 * - 具体实现由 main.ts 中的 createLazyPorts 提供
 */

import type { Command } from '../../core/command-bus';
import type { ObjectId } from '../../core/types';

/**
 * UI 端口接口 — Preact UI 层的副作用出口
 *
 * 所有从 UI 到游戏引擎的交互都经过此接口，
 * 确保 UI 组件与游戏逻辑之间的解耦
 */
export interface UiPorts {
  /** 向命令队列推送一条命令 */
  dispatchCommand(command: Command): void;
  /** 设置游戏速度（0=暂停, 1=正常, 2=快速, 3=极速） */
  setSpeed(speed: number): void;
  /** 设置选中对象列表（清除旧选择），自动切换到 Select 工具 */
  selectObjects(ids: ObjectId[]): void;
  /** 选中单个殖民者，自动切换到 Select 工具 */
  selectColonist(id: string): void;
  /** 切换工具，可选附带指派类型、建筑定义 ID 和区域类型 */
  setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null): void;
  /**
   * 进入指定分支节点的下一层菜单
   *
   * 仅追加 commandMenuPath，不会激活工具；UI 层与键盘输入层共享。
   */
  enterCommandMenu(branchId: string): void;
  /**
   * 弹出命令菜单的最后一层
   *
   * @returns true 表示成功退一级；false 表示已经在根层
   */
  backCommandMenu(): boolean;
  /**
   * 重置命令菜单路径到根层
   *
   * 不影响当前激活工具及其子模式。
   */
  resetCommandMenu(): void;
  /** 跳转摄像机到指定格子（待接入 Phaser 摄像机） */
  jumpCameraTo(cell: { x: number; y: number }): void;
  /** 指派床位所有者 */
  assignBedOwner(bedId: string, pawnId: string): void;
  /** 清除床位所有者 */
  clearBedOwner(bedId: string): void;
  /** 暂停指定工作订单 */
  pauseWorkOrder(orderId: string): void;
  /** 恢复指定工作订单 */
  resumeWorkOrder(orderId: string): void;
  /** 取消指定工作订单 */
  cancelWorkOrder(orderId: string): void;
  /** 重排订单优先级 — orderIds 顺序即新的 priorityIndex 顺序 */
  reorderWorkOrders(orderIds: string[]): void;
  /** 创建结果来源订单（工作台/原型 UI 触发） */
  createResultWorkOrder(payload: { orderKind: string; title: string; items: Array<Record<string, unknown>> }): void;
}
