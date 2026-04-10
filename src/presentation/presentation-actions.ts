/**
 * @file presentation-actions.ts
 * @description 展示层操作函数 — 封装对 PresentationState 的常用修改操作
 * @dependencies core/types — ObjectId, DesignationType；
 *               presentation-state — PresentationState, switchTool, ToolType
 * @part-of presentation — 展示层
 */

import type { ObjectId, DesignationType } from '../core/types';
import { type PresentationState, switchTool, ToolType } from './presentation-state';

/**
 * 设置选中对象列表 — 清除旧选择并填入新 ID
 *
 * @param presentation - 展示层状态
 * @param ids - 要选中的对象 ID 列表
 */
export function setSelectedObjects(presentation: PresentationState, ids: Iterable<ObjectId>): void {
  presentation.selectedObjectIds.clear();
  for (const id of ids) presentation.selectedObjectIds.add(id);
}

/**
 * 设置当前工具
 *
 * @param presentation - 展示层状态
 * @param tool - 目标工具类型
 */
export function setActiveTool(presentation: PresentationState, tool: ToolType): void {
  switchTool(presentation, tool);
}

/**
 * 设置指派类型 — 自动切换到 Designate 工具
 *
 * @param presentation - 展示层状态
 * @param desType - 指派类型（mine/harvest/cut）
 */
export function setDesignationType(presentation: PresentationState, desType: DesignationType): void {
  switchTool(presentation, ToolType.Designate);
  presentation.activeDesignationType = desType;
}

/**
 * 设置建筑定义 — 自动切换到 Build 工具
 *
 * @param presentation - 展示层状态
 * @param defId - 建筑定义 ID
 */
export function setBuildDef(presentation: PresentationState, defId: string): void {
  switchTool(presentation, ToolType.Build);
  presentation.activeBuildDefId = defId;
}
