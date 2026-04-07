/**
 * 交互模式呈现：与 oh-code-design「交互模式层 / 反馈协调」对应的薄文案（不含领域裁决）。
 */

import { getCommandMenuCategory, getCommandMenuCommand, type CommandMenuCommandId } from "../data/command-menu";

export type ToolInteractionPresentation = Readonly<{
  /** 供 HUD 主模式行展示 */
  modeLine: string;
  /** 是否与笔刷会话一致（建造路径等） */
  usesBrushStroke: boolean;
}>;

export function presentationForCommandMenuCommand(
  commandId: CommandMenuCommandId
): ToolInteractionPresentation {
  const command = getCommandMenuCommand(commandId);
  if (!command) {
    return { modeLine: "未选择指令", usesBrushStroke: false };
  }
  const categoryLabel = getCommandMenuCategory(command.categoryId)?.label ?? command.categoryId;
  switch (command.id) {
    case "storage-zone":
      return {
        modeLine: `${categoryLabel}·${command.label}：拖拽框选区域；Shift 并集 / Ctrl 切换；Esc 取消`,
        usesBrushStroke: false
      };
    case "place-bed":
      return {
        modeLine: `${categoryLabel}·${command.label}：单击地格；放置位置以游戏规则为准；Shift 并集 / Ctrl 切换，Esc 取消`,
        usesBrushStroke: false
      };
    default: {
      const modeLine =
        command.inputShape === "brush-stroke"
          ? `${categoryLabel}·${command.label}：拖拽绘制路径（笔刷），Esc 取消当前手势`
          : `${categoryLabel}·${command.label}：拖拽框选；Shift 并集 / Ctrl 切换；Esc 取消`;
      return {
        modeLine,
        usesBrushStroke: command.inputShape === "brush-stroke"
      };
    }
  }
}
