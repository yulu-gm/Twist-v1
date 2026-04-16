/**
 * @file build.intents.ts
 * @description 建造领域的用户意图 — 封装工具切换和速度设置等交互操作
 * @dependencies ui/kernel/ui-ports — UiPorts；build.types — ToolActionDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { UiPorts } from '../../kernel/ui-ports';
import type { ToolActionDef } from './build.types';

/**
 * 激活工具动作 — 根据工具动作定义切换工具和相关参数
 *
 * @param ports - UI 端口
 * @param action - 要激活的工具动作定义
 */
export function activateToolAction(ports: UiPorts, action: ToolActionDef): void {
  ports.setTool(action.tool, action.designationType ?? null, action.buildDefId ?? null, action.zoneType ?? null);
}
