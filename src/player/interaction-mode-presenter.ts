/**
 * 交互模式呈现：与 oh-code-design「交互模式层 / 反馈协调」对应的薄文案（不含领域裁决）。
 */

import type { VillagerBuildSubId, VillagerTool } from "../data/villager-tools";
import { interactionInputShapeForToolId } from "./tool-input-policy";

export type ToolInteractionPresentation = Readonly<{
  /** 供 HUD 主模式行展示 */
  modeLine: string;
  /** 是否与笔刷会话一致（建造路径等） */
  usesBrushStroke: boolean;
}>;

export function presentationForVillagerTool(
  tool: VillagerTool,
  buildSub: VillagerBuildSubId | null = null
): ToolInteractionPresentation {
  if (tool.id === "build") {
    if (buildSub === null) {
      return {
        modeLine: `${tool.label}：请选子项 — 木墙（笔刷路径）或木床（单格放置）`,
        usesBrushStroke: false
      };
    }
    if (buildSub === "wall") {
      return {
        modeLine: `${tool.label}·木墙：拖拽绘制路径（笔刷），Esc 取消当前手势`,
        usesBrushStroke: true
      };
    }
    return {
      modeLine: `${tool.label}·木床：点选或拖拽框选（单格为床）；Shift 并集 / Ctrl 切换；Esc 取消`,
      usesBrushStroke: false
    };
  }
  const usesBrushStroke = interactionInputShapeForToolId(tool.id) === "brush-stroke";
  const modeLine = usesBrushStroke
    ? `${tool.label}：拖拽绘制路径（笔刷），Esc 取消当前手势`
    : `${tool.label}：拖拽框选；Shift 并集 / Ctrl 切换；Esc 取消`;
  return { modeLine, usesBrushStroke };
}
