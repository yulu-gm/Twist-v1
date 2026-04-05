/**
 * 交互模式呈现：与 oh-code-design「交互模式层 / 反馈协调」对应的薄文案（不含领域裁决）。
 */

import type { VillagerTool } from "../data/villager-tools";
import { interactionInputShapeForToolId } from "./tool-input-policy";

export type ToolInteractionPresentation = Readonly<{
  /** 供 HUD 主模式行展示 */
  modeLine: string;
  /** 是否与笔刷会话一致（建造路径等） */
  usesBrushStroke: boolean;
}>;

export function presentationForVillagerTool(tool: VillagerTool): ToolInteractionPresentation {
  const usesBrushStroke = interactionInputShapeForToolId(tool.id) === "brush-stroke";
  const modeLine = usesBrushStroke
    ? `${tool.label}：拖拽绘制路径（笔刷），Esc 取消当前手势`
    : `${tool.label}：拖拽框选；Shift 并集 / Ctrl 切换；Esc 取消`;
  return { modeLine, usesBrushStroke };
}
