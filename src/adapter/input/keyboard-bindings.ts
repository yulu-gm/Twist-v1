/**
 * @file keyboard-bindings.ts
 * @description 键盘快捷键绑定 — 速度控制、工具切换、覆盖层切换、存档/读档、网格线
 * @part-of adapter/input
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import { SimSpeed, DesignationType, ZoneType } from '../../core/types';
import { PresentationState, ToolType, OverlayType, applyToolSelection } from '../../presentation/presentation-state';

/**
 * 注册所有键盘快捷键
 *
 * - 速度控制: SPACE 暂停/恢复, 1/2/3 速度档
 * - 工具切换: ESC/Q 选择, B 建造, M 采矿, H 采集, X 砍伐, Z 区域, C 取消
 * - 覆盖层: F1 调试, F2 区域, F3 房间, F4 温度, F5 寻路
 * - 系统: F6 保存, F7 加载, F8 网格线
 */
export function setupKeyboardBindings(
  scene: Phaser.Scene,
  world: World,
  presentation: PresentationState,
): void {
  const kb = scene.input.keyboard;
  if (!kb) return;

  // ── 速度控制 ──
  kb.on('keydown-SPACE', () => {
    world.commandQueue.push({
      type: 'set_speed',
      payload: { speed: world.speed === SimSpeed.Paused ? SimSpeed.Normal : SimSpeed.Paused },
    });
  });
  kb.on('keydown-ONE', () => {
    world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Normal } });
  });
  kb.on('keydown-TWO', () => {
    world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Fast } });
  });
  kb.on('keydown-THREE', () => {
    world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.UltraFast } });
  });

  // ── 工具快捷键 ──
  // ESC: 回到选择工具并清空选中与预览
  kb.on('keydown-ESC', () => {
    applyToolSelection(presentation, { tool: ToolType.Select });
    presentation.placementPreview = null;
    presentation.selectedObjectIds.clear();
  });
  // Q: 切换到选择工具，记录回退栈
  kb.on('keydown-Q', () => {
    applyToolSelection(presentation, { tool: ToolType.Select });
  });
  // B: 切换到建造工具，默认 wall_wood
  kb.on('keydown-B', () => {
    applyToolSelection(presentation, { tool: ToolType.Build, buildDefId: 'wall_wood' });
  });
  // M: 切换到指定工具（采矿）
  kb.on('keydown-M', () => {
    applyToolSelection(presentation, { tool: ToolType.Designate, designationType: DesignationType.Mine });
  });
  // H: 切换到指定工具（采集）
  kb.on('keydown-H', () => {
    applyToolSelection(presentation, { tool: ToolType.Designate, designationType: DesignationType.Harvest });
  });
  // X: 切换到指定工具（砍伐）
  kb.on('keydown-X', () => {
    applyToolSelection(presentation, { tool: ToolType.Designate, designationType: DesignationType.Cut });
  });
  // Z: 切换到区域工具，使用上次激活的区域类型
  kb.on('keydown-Z', () => {
    applyToolSelection(presentation, { tool: ToolType.Zone, zoneType: presentation.lastZoneType });
  });
  // C: 切换到取消工具
  kb.on('keydown-C', () => {
    applyToolSelection(presentation, { tool: ToolType.Cancel });
  });

  // ── 调试面板切换: F1 ──
  kb.on('keydown-F1', () => {
    presentation.showDebugPanel = !presentation.showDebugPanel;
  });

  // ── 覆盖层切换: F2 区域、F3 房间、F4 温度、F5 寻路 ──
  kb.on('keydown-F2', () => {
    presentation.activeOverlay =
      presentation.activeOverlay === OverlayType.Zones ? OverlayType.None : OverlayType.Zones;
  });
  kb.on('keydown-F3', () => {
    presentation.activeOverlay =
      presentation.activeOverlay === OverlayType.Rooms ? OverlayType.None : OverlayType.Rooms;
  });
  kb.on('keydown-F4', () => {
    presentation.activeOverlay =
      presentation.activeOverlay === OverlayType.Temperature ? OverlayType.None : OverlayType.Temperature;
  });
  kb.on('keydown-F5', (event: KeyboardEvent) => {
    event.preventDefault();
    presentation.activeOverlay =
      presentation.activeOverlay === OverlayType.Pathfinding ? OverlayType.None : OverlayType.Pathfinding;
  });

  // ── 存档/读档: F6 保存、F7 加载 ──
  kb.on('keydown-F6', () => {
    world.commandQueue.push({ type: 'save_game', payload: {} });
  });
  kb.on('keydown-F7', () => {
    world.commandQueue.push({ type: 'load_game', payload: {} });
  });

  // ── 网格线切换: F8 ──
  kb.on('keydown-F8', (event: KeyboardEvent) => {
    event.preventDefault();
    presentation.showGrid = !presentation.showGrid;
  });
}
