/**
 * @file debug-panel.ts
 * @description 调试面板 UI 组件 — 显示悬停格子信息、对象统计、预约数等
 * @part-of adapter/ui
 */

import type { GameMap } from '../../world/game-map';
import { PresentationState } from '../../presentation/presentation-state';

/** 调试面板 UI 组件 */
export class DebugPanelUI {
  private map: GameMap;
  private presentation: PresentationState;

  private debugPanel: HTMLElement;
  private debugText: HTMLElement;

  private prevShowDebug = false;
  private prevDebugInfo = '';

  constructor(map: GameMap, presentation: PresentationState) {
    this.map = map;
    this.presentation = presentation;

    this.debugPanel = document.getElementById('ui-debug-panel')!;
    this.debugText = document.getElementById('ui-debug-text')!;
  }

  update(): void {
    const show = this.presentation.showDebugPanel;

    if (!show) {
      if (this.prevShowDebug) {
        this.debugPanel.classList.remove('visible');
        this.prevShowDebug = false;
        this.prevDebugInfo = '';
      }
      return;
    }

    if (!this.prevShowDebug) {
      this.debugPanel.classList.add('visible');
      this.prevShowDebug = true;
    }

    const hovered = this.presentation.hoveredCell;
    let dbg = `--- Debug ---\n`;
    dbg += `Tool: ${this.presentation.activeTool}\n`;
    if (hovered) {
      dbg += `Hover: (${hovered.x}, ${hovered.y})\n`;
      const terrain = this.map.terrain.get(hovered.x, hovered.y);
      dbg += `Terrain: ${terrain}\n`;
      const objs = this.map.spatial.getAt(hovered);
      dbg += `Objects: ${objs.length}\n`;
      for (const id of objs) {
        const o = this.map.objects.get(id);
        if (o) dbg += `  ${o.kind}: ${o.id}\n`;
      }
      dbg += `Passable: ${this.map.spatial.isPassable(hovered)}\n`;
    }
    dbg += `Total objects: ${this.map.objects.size}\n`;
    const reservations = this.map.reservations.getAll();
    dbg += `Reservations: ${reservations.length}\n`;

    if (dbg !== this.prevDebugInfo) {
      this.debugText.textContent = dbg;
      this.prevDebugInfo = dbg;
    }
  }

  destroy(): void {
    this.debugPanel.classList.remove('visible');
  }
}
