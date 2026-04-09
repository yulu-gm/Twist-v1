/**
 * @file toolbar-panel.ts
 * @description 工具栏 UI 组件 — 工具按钮事件绑定 + 当前工具高亮同步
 * @part-of adapter/ui
 */

import { World } from '../../world/world';
import { DesignationType, ZoneType } from '../../core/types';
import { PresentationState, ToolType, switchTool } from '../../presentation/presentation-state';

/** 工具栏 UI 组件 */
export class ToolbarUI {
  private world: World;
  private presentation: PresentationState;

  private toolBtns: HTMLElement[];
  private prevToolKey = '';

  constructor(world: World, presentation: PresentationState) {
    this.world = world;
    this.presentation = presentation;

    this.toolBtns = Array.from(document.querySelectorAll('.tool-btn')) as HTMLElement[];
    this.setupToolButtons();
  }

  private setupToolButtons(): void {
    for (const btn of this.toolBtns) {
      const dataTool = btn.dataset.tool;
      if (!dataTool) continue;

      btn.addEventListener('click', (e) => {
        switch (dataTool) {
          case 'select':
            switchTool(this.presentation, ToolType.Select);
            break;
          case 'build':
            switchTool(this.presentation, ToolType.Build);
            this.presentation.activeBuildDefId = 'wall_wood';
            break;
          case 'mine':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Mine;
            break;
          case 'harvest':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Harvest;
            break;
          case 'cut':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Cut;
            break;
          case 'zone':
            switchTool(this.presentation, ToolType.Zone);
            this.presentation.activeZoneType = ZoneType.Stockpile;
            break;
          case 'stockpile':
            switchTool(this.presentation, ToolType.Zone);
            this.presentation.activeZoneType = ZoneType.Stockpile;
            break;
          case 'cancel':
            switchTool(this.presentation, ToolType.Cancel);
            break;
        }
        (e.target as HTMLElement).blur();
      });
    }
  }

  update(): void {
    const tool = this.presentation.activeTool;
    const desType = this.presentation.activeDesignationType;
    const zoneType = this.presentation.activeZoneType;
    const toolKey = `${tool}:${desType ?? ''}:${zoneType ?? ''}`;

    if (toolKey === this.prevToolKey) return;
    this.prevToolKey = toolKey;

    for (const btn of this.toolBtns) {
      const dataTool = btn.dataset.tool;
      if (!dataTool) {
        btn.classList.remove('active');
        continue;
      }

      let isActive = false;
      switch (dataTool) {
        case 'select':
          isActive = tool === ToolType.Select;
          break;
        case 'build':
          isActive = tool === ToolType.Build;
          break;
        case 'mine':
          isActive = tool === ToolType.Designate && desType === DesignationType.Mine;
          break;
        case 'harvest':
          isActive = tool === ToolType.Designate && desType === DesignationType.Harvest;
          break;
        case 'cut':
          isActive = tool === ToolType.Designate && desType === DesignationType.Cut;
          break;
        case 'zone':
          isActive = tool === ToolType.Zone;
          break;
        case 'stockpile':
          isActive = tool === ToolType.Zone && zoneType === ZoneType.Stockpile;
          break;
        case 'cancel':
          isActive = tool === ToolType.Cancel;
          break;
      }
      btn.classList.toggle('active', isActive);
    }
  }

  destroy(): void {}
}
