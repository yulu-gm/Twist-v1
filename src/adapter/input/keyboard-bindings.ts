/**
 * @file keyboard-bindings.ts
 * @description 键盘快捷键绑定 — 速度控制、工具切换、覆盖层切换、存档/读档、网格线
 * @part-of adapter/input
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import { SimSpeed, DesignationType, ZoneType } from '../../core/types';
import { PresentationState, ToolType, OverlayType, switchTool } from '../../presentation/presentation-state';

function activateZoneTool(presentation: PresentationState, zoneType: ZoneType): void {
  presentation.lastZoneType = zoneType;
  switchTool(presentation, ToolType.Zone);
  presentation.activeZoneType = zoneType;
}

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
  kb.on('keydown-ESC', () => {
    switchTool(presentation, ToolType.Select);
    presentation.placementPreview = null;
    presentation.selectedObjectIds.clear();
  });
  kb.on('keydown-Q', () => {
    switchTool(presentation, ToolType.Select);
  });
  kb.on('keydown-B', () => {
    switchTool(presentation, ToolType.Build);
    presentation.activeBuildDefId = 'wall_wood';
  });
  kb.on('keydown-M', () => {
    switchTool(presentation, ToolType.Designate);
    presentation.activeDesignationType = DesignationType.Mine;
  });
  kb.on('keydown-H', () => {
    switchTool(presentation, ToolType.Designate);
    presentation.activeDesignationType = DesignationType.Harvest;
  });
  kb.on('keydown-X', () => {
    switchTool(presentation, ToolType.Designate);
    presentation.activeDesignationType = DesignationType.Cut;
  });
  kb.on('keydown-Z', () => {
    activateZoneTool(presentation, presentation.lastZoneType);
  });
  kb.on('keydown-C', () => {
    switchTool(presentation, ToolType.Cancel);
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
