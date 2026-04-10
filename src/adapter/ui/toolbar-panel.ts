/**
 * @file toolbar-panel.ts
 * @description 工具栏 UI 组件 — 工具按钮事件绑定 + 当前工具高亮同步
 * @part-of adapter/ui
 */

import { World } from '../../world/world';
import { DesignationType, ZoneType } from '../../core/types';
import { PresentationState, ToolType, switchTool } from '../../presentation/presentation-state';

function readZoneType(btn: HTMLElement): ZoneType {
  const zoneType = btn.dataset.zoneType;
  switch (zoneType) {
    case ZoneType.Growing:
      return ZoneType.Growing;
    case ZoneType.Animal:
      return ZoneType.Animal;
    case ZoneType.Stockpile:
    default:
      return ZoneType.Stockpile;
  }
}

function activateZoneTool(presentation: PresentationState, zoneType: ZoneType): void {
  presentation.lastZoneType = zoneType;
  switchTool(presentation, ToolType.Zone);
  presentation.activeZoneType = zoneType;
}

/** 工具栏 UI 组件 */
export class ToolbarUI {
  private world: World;
  private presentation: PresentationState;

  private toolBtns: HTMLElement[];
  private zoneMainBtn: HTMLElement | null;
  private zoneMenu: HTMLElement | null;
  private zoneOptionBtns: HTMLElement[];
  private zoneMenuOpen = false;
  private prevStateKey = '';
  private prevTool: ToolType;
  private readonly onDocumentPointerDown: (event: PointerEvent) => void;

  constructor(world: World, presentation: PresentationState) {
    this.world = world;
    this.presentation = presentation;

    this.toolBtns = Array.from(document.querySelectorAll('.tool-btn[data-tool]')) as HTMLElement[];
    this.zoneMainBtn = document.querySelector('[data-zone-menu-toggle]');
    this.zoneMenu = document.querySelector('[data-zone-menu]');
    this.zoneOptionBtns = Array.from(document.querySelectorAll('[data-zone-type]')) as HTMLElement[];
    this.prevTool = presentation.activeTool;
    this.onDocumentPointerDown = (event: PointerEvent) => {
      if (!this.zoneMenuOpen) return;
      const target = event.target;
      if (!(target instanceof Element)) {
        this.closeZoneMenu();
        return;
      }
      if (target.closest('#ui-toolbar')) return;
      this.closeZoneMenu();
    };

    this.setupToolButtons();
    this.setupZoneMenu();
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.syncToolbarState();
  }

  private setupToolButtons(): void {
    for (const btn of this.toolBtns) {
      const dataTool = btn.dataset.tool;
      if (!dataTool) continue;

      btn.addEventListener('click', (e) => {
        switch (dataTool) {
          case 'select':
            switchTool(this.presentation, ToolType.Select);
            this.closeZoneMenu();
            break;
          case 'build':
            switchTool(this.presentation, ToolType.Build);
            this.presentation.activeBuildDefId = 'wall_wood';
            this.closeZoneMenu();
            break;
          case 'mine':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Mine;
            this.closeZoneMenu();
            break;
          case 'harvest':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Harvest;
            this.closeZoneMenu();
            break;
          case 'cut':
            switchTool(this.presentation, ToolType.Designate);
            this.presentation.activeDesignationType = DesignationType.Cut;
            this.closeZoneMenu();
            break;
          case 'cancel':
            switchTool(this.presentation, ToolType.Cancel);
            this.closeZoneMenu();
            break;
        }
        (e.currentTarget as HTMLElement).blur();
      });
    }
  }

  private setupZoneMenu(): void {
    if (this.zoneMainBtn) {
      this.zoneMainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleZoneMenu();
        (e.currentTarget as HTMLElement).blur();
      });
    }

    for (const btn of this.zoneOptionBtns) {
      btn.addEventListener('click', (e) => {
        const zoneType = readZoneType(btn);
        activateZoneTool(this.presentation, zoneType);
        this.closeZoneMenu();
        (e.currentTarget as HTMLElement).blur();
      });
    }
  }

  private toggleZoneMenu(): void {
    this.zoneMenuOpen ? this.closeZoneMenu() : this.openZoneMenu();
  }

  private openZoneMenu(): void {
    if (this.zoneMenuOpen) return;
    this.zoneMenuOpen = true;
    this.syncToolbarState();
  }

  private closeZoneMenu(): void {
    if (!this.zoneMenuOpen) return;
    this.zoneMenuOpen = false;
    this.syncToolbarState();
  }

  private syncToolbarState(): void {
    const tool = this.presentation.activeTool;
    const desType = this.presentation.activeDesignationType;
    const zoneType = this.presentation.activeZoneType;
    const stateKey = `${tool}:${desType ?? ''}:${zoneType ?? ''}:${this.zoneMenuOpen ? 'open' : 'closed'}`;
    if (stateKey === this.prevStateKey) return;
    this.prevStateKey = stateKey;

    if (this.zoneMainBtn) {
      this.zoneMainBtn.classList.toggle('active', tool === ToolType.Zone);
      this.zoneMainBtn.classList.toggle('open', this.zoneMenuOpen);
      this.zoneMainBtn.setAttribute('aria-expanded', this.zoneMenuOpen ? 'true' : 'false');
    }
    if (this.zoneMenu) {
      this.zoneMenu.classList.toggle('open', this.zoneMenuOpen);
    }

    for (const btn of this.toolBtns) {
      const dataTool = btn.dataset.tool;
      if (!dataTool) continue;

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

    for (const btn of this.zoneOptionBtns) {
      const isActive = tool === ToolType.Zone && zoneType === readZoneType(btn);
      btn.classList.toggle('active', isActive);
    }
  }

  update(): void {
    const currentTool = this.presentation.activeTool;

    if (this.zoneMenuOpen && this.prevTool === ToolType.Zone && currentTool !== ToolType.Zone) {
      this.closeZoneMenu();
      this.prevTool = currentTool;
      return;
    }

    this.prevTool = currentTool;
    this.syncToolbarState();
  }

  destroy(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
  }
}
