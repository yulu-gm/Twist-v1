/**
 * @file keyboard-bindings.ts
 * @description 键盘快捷键绑定 — 速度控制、命令栏分层导航与动态字母快捷键、覆盖层切换、存档/读档、网格线
 * @part-of adapter/input
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import { SimSpeed, DesignationType, ZoneType, DefId } from '../../core/types';
import {
  PresentationState,
  ToolType,
  OverlayType,
  applyToolSelection,
  popCommandMenuLevel,
  resetCommandMenuPath,
} from '../../presentation/presentation-state';
import {
  COMMAND_SHORTCUT_KEYS,
  getVisibleCommandMenuEntries,
  resolveActiveCommandLeafId,
} from '../../ui/domains/build/command-menu';

/**
 * 在当前可见菜单层级中按快捷键触发对应条目
 *
 * - 分支条目：把 branchId 压入 commandMenuPath，进入下一层；
 * - 叶子条目：通过 applyToolSelection 切换工具与子模式，菜单路径保持不变；
 * - 返回条目（仅 Esc）：在 ESC 处理路径中已单独处理，这里跳过。
 */
function triggerVisibleEntryShortcut(
  presentation: PresentationState,
  shortcut: string,
): void {
  const activeLeafId = resolveActiveCommandLeafId({
    activeTool: presentation.activeTool,
    activeDesignationType: presentation.activeDesignationType,
    activeBuildDefId: presentation.activeBuildDefId,
    activeZoneType: presentation.activeZoneType,
  });

  const entries = getVisibleCommandMenuEntries(presentation.commandMenuPath, activeLeafId);
  const entry = entries.find((candidate) => candidate.shortcut === shortcut);
  if (!entry) return;

  if (entry.kind === 'branch' && entry.branchId) {
    presentation.commandMenuPath = [...presentation.commandMenuPath, entry.branchId];
    return;
  }

  if (entry.kind === 'leaf' && entry.action) {
    const action = entry.action;
    applyToolSelection(presentation, {
      tool: action.tool as ToolType,
      designationType: (action.designationType ?? null) as DesignationType | null,
      buildDefId: (action.buildDefId ?? null) as DefId | null,
      zoneType: (action.zoneType ?? null) as ZoneType | null,
    });
  }
}

/**
 * 注册所有键盘快捷键
 *
 * - 速度控制: SPACE 暂停/恢复, 1/2/3 速度档
 * - 命令栏: ESC 优先退一级菜单（根层时切回选择工具），Z/X/C/V/B/N/M 按当前可见层级动态分配
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

  // ── 命令栏导航 ──
  // ESC: 优先退一级菜单；如果已经在根层，则切回选择工具并清空选中与预览
  kb.on('keydown-ESC', () => {
    if (popCommandMenuLevel(presentation)) {
      return;
    }
    applyToolSelection(presentation, { tool: ToolType.Select });
    resetCommandMenuPath(presentation);
    presentation.placementPreview = null;
    presentation.selectedObjectIds.clear();
  });

  // Z/X/C/V/B/N/M: 按当前可见菜单层级动态触发条目
  for (const key of COMMAND_SHORTCUT_KEYS) {
    kb.on(`keydown-${key}`, () => {
      triggerVisibleEntryShortcut(presentation, key);
    });
  }

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
