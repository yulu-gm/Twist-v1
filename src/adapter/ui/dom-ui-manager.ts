/**
 * @file dom-ui-manager.ts
 * @description DOM UI 管理器 — 组合所有 UI 子组件（顶栏、工具栏、选择面板、调试面板）
 * @part-of adapter/ui
 */

import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { PresentationState } from '../../presentation/presentation-state';
import { TopBarUI } from './top-bar';
import { ToolbarUI } from './toolbar-panel';
import { SelectionPanelUI } from './selection-panel';
import { DebugPanelUI } from './debug-panel';

interface UIComponent {
  update(): void;
  destroy(): void;
}

/**
 * DOM UI 管理器 — 创建并协调所有固定位置 HUD 子组件
 */
export class DomUIManager {
  private components: UIComponent[];

  constructor(world: World, map: GameMap, presentation: PresentationState) {
    this.components = [
      new TopBarUI(world, map),
      new ToolbarUI(world, presentation),
      new SelectionPanelUI(map, presentation),
      new DebugPanelUI(map, presentation),
    ];
  }

  update(): void {
    for (const c of this.components) c.update();
  }

  destroy(): void {
    for (const c of this.components) c.destroy();
  }
}
