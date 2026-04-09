/**
 * @file dom-ui-manager.ts
 * @description DOM UI 管理器，使用原生 DOM 元素渲染所有 HUD（顶栏、工具栏、选择面板、调试面板）
 * @dependencies world/world — 读取世界状态；world/game-map — 地图数据；
 *               core/types — ObjectKind、SimSpeed、DesignationType；core/clock — 时钟格式化；
 *               presentation — 工具类型、展示状态
 * @part-of adapter/ui — UI 组件模块
 */

import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, SimSpeed, DesignationType } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import { PresentationState, ToolType } from '../../presentation/presentation-state';

/**
 * DOM UI 管理器 — 通过原生 DOM 元素渲染所有固定位置 HUD
 *
 * 职责：
 * 1. 管理顶栏（时钟 | 速度按钮组 | 殖民者数/tick）
 * 2. 管理底部工具栏（分组 + 当前工具高亮）
 * 3. 管理选择面板（卡片式 inspector，含需求条）
 * 4. 管理调试面板（悬停格子信息/对象统计）
 */
export class DomUIManager {
  private world: World;
  private map: GameMap;
  private presentation: PresentationState;

  // ── DOM 元素引用 ──
  private clockEl: HTMLElement;
  private pawnCountEl: HTMLElement;
  private tickEl: HTMLElement;
  private speedBtns: HTMLElement[];
  private selectionPanel: HTMLElement;
  private selHeaderEl: HTMLElement;
  private selPropsEl: HTMLElement;
  private selBarsEl: HTMLElement;
  private debugPanel: HTMLElement;
  private debugText: HTMLElement;
  private toolBtns: HTMLElement[];

  // ── 脏检查缓存 ──
  private prevClock = '';
  private prevSpeed = -1;
  private prevTick = -1;
  private prevPawnCount = -1;
  private prevSelectionKey = '';
  private prevDebugInfo = '';
  private prevShowDebug = false;
  private prevToolKey = '';

  constructor(world: World, map: GameMap, presentation: PresentationState) {
    this.world = world;
    this.map = map;
    this.presentation = presentation;

    // 获取 DOM 元素引用
    this.clockEl = document.getElementById('ui-clock')!;
    this.pawnCountEl = document.getElementById('ui-pawn-count')!;
    this.tickEl = document.getElementById('ui-tick')!;
    this.speedBtns = Array.from(document.querySelectorAll('.speed-btn')) as HTMLElement[];
    this.selectionPanel = document.getElementById('ui-selection-panel')!;
    this.selHeaderEl = document.getElementById('ui-sel-header')!;
    this.selPropsEl = document.getElementById('ui-sel-props')!;
    this.selBarsEl = document.getElementById('ui-sel-bars')!;
    this.debugPanel = document.getElementById('ui-debug-panel')!;
    this.debugText = document.getElementById('ui-debug-text')!;
    this.toolBtns = Array.from(document.querySelectorAll('.tool-btn')) as HTMLElement[];

    this.setupSpeedButtons();
    this.setupToolButtons();
  }

  /** 注册速度按钮点击事件 */
  private setupSpeedButtons(): void {
    for (const btn of this.speedBtns) {
      btn.addEventListener('click', (e) => {
        const speed = parseInt(btn.dataset.speed ?? '0', 10);
        this.world.commandQueue.push({
          type: 'set_speed',
          payload: { speed },
        });
        (e.target as HTMLElement).blur();
      });
    }
  }

  /** 注册工具栏按钮点击事件 */
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

  /**
   * 每帧更新 — 读取世界/展示状态，按需刷新 DOM
   */
  update(): void {
    this.updateTopBar();
    this.updateToolbar();
    this.updateSelectionPanel();
    this.updateDebugPanel();
  }

  // ── 顶栏 ──

  /** 更新顶栏内容（时钟、速度高亮、tick、殖民者数） */
  private updateTopBar(): void {
    const clockStr = getClockDisplay(this.world.clock);
    if (clockStr !== this.prevClock) {
      this.clockEl.textContent = clockStr;
      this.prevClock = clockStr;
    }

    if (this.world.speed !== this.prevSpeed) {
      for (const btn of this.speedBtns) {
        const btnSpeed = parseInt(btn.dataset.speed ?? '-1', 10);
        btn.classList.toggle('active', btnSpeed === this.world.speed);
      }
      this.prevSpeed = this.world.speed;
    }

    if (this.world.tick !== this.prevTick) {
      this.tickEl.textContent = `T:${this.world.tick}`;
      this.prevTick = this.world.tick;
    }

    const pawnCount = this.map.objects.allOfKind(ObjectKind.Pawn).length;
    if (pawnCount !== this.prevPawnCount) {
      this.pawnCountEl.textContent = `${pawnCount} colonists`;
      this.prevPawnCount = pawnCount;
    }
  }

  // ── 工具栏高亮 ──

  /** 更新工具栏当前工具高亮 */
  private updateToolbar(): void {
    const tool = this.presentation.activeTool;
    const desType = this.presentation.activeDesignationType;
    // 构建当前工具的唯一 key
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

  // ── 选择面板 ──

  /** 更新选择面板 — 卡片式 inspector */
  private updateSelectionPanel(): void {
    const ids = this.presentation.selectedObjectIds;

    if (ids.size === 0) {
      if (this.prevSelectionKey !== '') {
        this.selectionPanel.classList.remove('visible');
        this.prevSelectionKey = '';
      }
      return;
    }

    // 构建选择内容的脏检查 key
    const selKey = this.buildSelectionKey(ids);
    if (selKey === this.prevSelectionKey) return;
    this.prevSelectionKey = selKey;

    this.selectionPanel.classList.add('visible');

    if (ids.size === 1) {
      const objId = ids.values().next().value!;
      const obj = this.map.objects.get(objId);
      if (obj) {
        this.renderSingleSelection(obj);
      }
    } else {
      this.renderMultiSelection(ids);
    }
  }

  /** 构建选择内容的脏检查 key（含动态数据摘要） */
  private buildSelectionKey(ids: Set<string>): string {
    let key = `s:${ids.size}`;
    for (const id of ids) {
      const obj = this.map.objects.get(id);
      if (!obj) continue;
      key += `:${id}`;
      if (obj.kind === ObjectKind.Pawn) {
        const p = obj as any;
        const jobDef = p.ai?.currentJob?.defId ?? 'idle';
        key += `,${jobDef},${Math.floor(p.needs?.food ?? 0)},${Math.floor(p.needs?.rest ?? 0)},${Math.floor(p.needs?.joy ?? 0)}`;
      }
    }
    return key;
  }

  /** 渲染单个选中对象的卡片 */
  private renderSingleSelection(obj: any): void {
    // Header
    const kindLabel = this.getKindLabel(obj.kind);
    if (obj.kind === ObjectKind.Pawn) {
      this.selHeaderEl.textContent = `${obj.name}`;
    } else {
      this.selHeaderEl.textContent = `${kindLabel}: ${obj.defId}`;
    }

    // Props
    let propsHtml = '';
    propsHtml += this.propRow('Position', `(${obj.cell.x}, ${obj.cell.y})`);
    propsHtml += this.propRow('Type', kindLabel);

    if (obj.kind === ObjectKind.Pawn) {
      const jobDef = obj.ai?.currentJob?.defId ?? 'idle';
      propsHtml += this.propRow('Job', jobDef);
      propsHtml += this.propRow('Faction', obj.factionId ?? '-');

      const hp = obj.health;
      if (hp) {
        propsHtml += this.propRow('HP', `${hp.hp}/${hp.maxHp}`);
      }
    } else if (obj.kind === ObjectKind.Item) {
      const stack = obj.stackCount ?? 1;
      if (stack > 1) {
        propsHtml += this.propRow('Stack', `${stack}`);
      }
    } else if (obj.kind === ObjectKind.ConstructionSite) {
      const progress = Math.floor((obj.buildProgress ?? 0) * 100);
      propsHtml += this.propRow('Progress', `${progress}%`);
    }
    this.selPropsEl.innerHTML = propsHtml;

    // Bars (Pawn needs)
    if (obj.kind === ObjectKind.Pawn && obj.needs) {
      const n = obj.needs;
      this.selBarsEl.innerHTML =
        this.needBar('Food', 'food', n.food) +
        this.needBar('Rest', 'rest', n.rest) +
        this.needBar('Joy', 'joy', n.joy) +
        this.needBar('Mood', 'mood', n.mood);
      this.selBarsEl.style.display = '';
    } else {
      this.selBarsEl.innerHTML = '';
      this.selBarsEl.style.display = 'none';
    }
  }

  /** 渲染多选统计 */
  private renderMultiSelection(ids: Set<string>): void {
    this.selHeaderEl.textContent = `${ids.size} objects selected`;

    // 按 kind 分组统计
    const counts = new Map<string, number>();
    for (const id of ids) {
      const obj = this.map.objects.get(id);
      if (!obj) continue;
      const label = this.getKindLabel(obj.kind);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    let propsHtml = '';
    for (const [label, count] of counts) {
      propsHtml += this.propRow(label, `${count}`);
    }
    this.selPropsEl.innerHTML = propsHtml;

    this.selBarsEl.innerHTML = '';
    this.selBarsEl.style.display = 'none';
  }

  /** 生成属性行 HTML */
  private propRow(label: string, value: string): string {
    return `<div class="sel-prop-row"><span class="sel-prop-label">${label}</span><span>${value}</span></div>`;
  }

  /** 生成需求条 HTML */
  private needBar(label: string, cssClass: string, value: number): string {
    const v = Math.max(0, Math.min(100, value));
    return `<div class="need-row">` +
      `<span class="need-label">${label}</span>` +
      `<div class="need-bar"><div class="need-bar-fill ${cssClass}" style="width:${v}%"></div></div>` +
      `<span class="need-value">${Math.floor(v)}</span>` +
      `</div>`;
  }

  /** ObjectKind → 显示标签 */
  private getKindLabel(kind: ObjectKind): string {
    switch (kind) {
      case ObjectKind.Pawn: return 'Pawn';
      case ObjectKind.Building: return 'Building';
      case ObjectKind.Item: return 'Item';
      case ObjectKind.Plant: return 'Plant';
      case ObjectKind.Blueprint: return 'Blueprint';
      case ObjectKind.ConstructionSite: return 'Construction';
      case ObjectKind.Designation: return 'Designation';
      case ObjectKind.Fire: return 'Fire';
      case ObjectKind.Corpse: return 'Corpse';
      default: return 'Object';
    }
  }

  // ── 调试面板 ──

  /** 更新调试面板 — F1 切换显示 */
  private updateDebugPanel(): void {
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

  /** 清理 */
  destroy(): void {
    this.selectionPanel.classList.remove('visible');
    this.debugPanel.classList.remove('visible');
  }
}
