/**
 * @file colonist.intents.ts
 * @description 殖民者领域的用户意图 — 封装选中和跳转等交互操作
 * @dependencies ui/kernel/ui-ports — UiPorts
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import type { UiPorts } from '../../kernel/ui-ports';

/**
 * 聚焦殖民者 — 选中指定殖民者
 *
 * @param ports - UI 端口
 * @param id - 殖民者 ID
 */
export function focusColonist(ports: UiPorts, id: string): void {
  ports.selectColonist(id);
}

/**
 * 跳转到殖民者 — 选中并将摄像机移动到其位置
 *
 * @param ports - UI 端口
 * @param id - 殖民者 ID
 * @param cell - 殖民者当前格子坐标
 */
export function jumpToColonist(ports: UiPorts, id: string, cell: { x: number; y: number }): void {
  ports.selectColonist(id);
  ports.jumpCameraTo(cell);
}
