/**
 * @file toolbar-panel.ts
 * @description 工具栏 UI 组件 — 工具按钮事件绑定 + 当前工具高亮同步
 * @part-of adapter/ui
 */

import { World } from '../../world/world';
import { DesignationType } from '../../core/types';
import { PresentationState, ToolType } from '../../presentation/presentation-state';

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
            this.presentation.activeTool = ToolType.Select;
            this.presentation.activeDesignationType = null;
            this.presentation.activeBuildDefId = null;
            break;
          case 'build':
            this.presentation.activeTool = ToolType.Build;
            this.presentation.activeBuildDefId = 'wall_wood';
            this.presentation.activeDesignationType = null;
            this.presentation.selectedObjectIds.clear();
            break;
          case 'mine':
            this.presentation.activeTool = ToolType.Designate;
            this.presentation.activeDesignationType = DesignationType.Mine;
            this.presentation.activeBuildDefId = null;
            this.presentation.selectedObjectIds.clear();
            break;
          case 'harvest':
            this.presentation.activeTool = ToolType.Designate;
            this.presentation.activeDesignationType = DesignationType.Harvest;
            this.presentation.activeBuildDefId = null;
            this.presentation.selectedObjectIds.clear();
            break;
          case 'cut':
            this.presentation.activeTool = ToolType.Designate;
            this.presentation.activeDesignationType = DesignationType.Cut;
            this.presentation.activeBuildDefId = null;
            this.presentation.selectedObjectIds.clear();
            break;
          case 'cancel':
            this.presentation.activeTool = ToolType.Cancel;
            this.presentation.activeDesignationType = null;
            this.presentation.activeBuildDefId = null;
            this.presentation.selectedObjectIds.clear();
            break;
        }
        (e.target as HTMLElement).blur();
      });
    }
  }

  update(): void {
    const tool = this.presentation.activeTool;
    const desType = this.presentation.activeDesignationType;
    const toolKey = `${tool}:${desType ?? ''}`;

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
        case 'cancel':
          isActive = tool === ToolType.Cancel;
          break;
      }
      btn.classList.toggle('active', isActive);
    }
  }

  destroy(): void {}
}
