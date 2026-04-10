/**
 * @file ui-ports.ts
 * @description UI 端口接口与工厂 — 定义 Preact UI 向游戏引擎发出副作用的边界
 * @dependencies core/command-bus — Command 类型；presentation — 展示层状态与工具切换；
 *               core/types — ObjectId, DesignationType
 * @part-of ui/kernel — UI 内核层
 *
 * 设计要点：
 * - UI 组件只通过 UiPorts 发出副作用（发命令、切工具、跳摄像机等）
 * - 组件不直接接触 World、GameMap 或 PresentationState
 * - 具体实现由 main.ts 中的 createLazyPorts/createUiPorts 提供
 */

import type { Command } from '../../core/command-bus';
import type { PresentationState } from '../../presentation/presentation-state';
import { switchTool, ToolType } from '../../presentation/presentation-state';
import type { DesignationType, ObjectId } from '../../core/types';

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
  /** 切换工具，可选附带指派类型和建筑定义 ID */
  setTool(tool: string, designationType?: string | null, buildDefId?: string | null): void;
  /** 跳转摄像机到指定格子（待接入 Phaser 摄像机） */
  jumpCameraTo(cell: { x: number; y: number }): void;
}

/**
 * 创建 UI 端口实例 — 将抽象端口绑定到具体的游戏对象
 *
 * @param commandQueue - 世界命令队列（world.commandQueue）
 * @param presentation - 展示层状态对象
 * @returns 绑定后的 UiPorts 实例
 */
export function createUiPorts(
  commandQueue: Command[],
  presentation: PresentationState,
): UiPorts {
  return {
    dispatchCommand(command: Command): void {
      commandQueue.push(command);
    },

    setSpeed(speed: number): void {
      commandQueue.push({ type: 'set_speed', payload: { speed } });
    },

    selectObjects(ids: ObjectId[]): void {
      presentation.selectedObjectIds.clear();
      for (const id of ids) presentation.selectedObjectIds.add(id);
      // 选中对象后自动切换到 Select 工具
      if (ids.length > 0 && presentation.activeTool !== ToolType.Select) {
        switchTool(presentation, ToolType.Select);
      }
    },

    selectColonist(id: string): void {
      presentation.selectedObjectIds.clear();
      presentation.selectedObjectIds.add(id);
      if (presentation.activeTool !== ToolType.Select) {
        switchTool(presentation, ToolType.Select);
      }
    },

    setTool(tool: string, designationType?: string | null, buildDefId?: string | null): void {
      switchTool(presentation, tool as ToolType);
      if (designationType) {
        presentation.activeDesignationType = designationType as DesignationType;
      }
      if (buildDefId) {
        presentation.activeBuildDefId = buildDefId;
      }
    },

    jumpCameraTo(_cell: { x: number; y: number }): void {
      // 待接入 Phaser 摄像机引用后实现
    },
  };
}
