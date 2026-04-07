/**
 * 命令 / 模式 → 输入形态：数据源自 {@link ../data/command-menu}，与交互模式注册表中 `modeId`（= 菜单 `modeKey`）一致。
 * 禁止按粗粒度 `markerToolId`（如多个命令共用的 `"build"`）推断形态。
 */

import type { CommandMenuCommandId, CommandMenuInputShape } from "../data/command-menu";
import { getCommandMenuCommand, getCommandMenuCommandByModeKey } from "../data/command-menu";

export type InteractionInputShape = CommandMenuInputShape;

export function interactionInputShapeForCommandId(
  commandId: CommandMenuCommandId
): CommandMenuInputShape | undefined {
  return getCommandMenuCommand(commandId)?.inputShape;
}

/** `modeId` 与菜单 `modeKey`、模式注册表一致（例如 `build-wall` → 笔刷，`build-bed` → 单格）。 */
export function interactionInputShapeForModeId(modeId: string): CommandMenuInputShape | undefined {
  return getCommandMenuCommandByModeKey(modeId)?.inputShape;
}
