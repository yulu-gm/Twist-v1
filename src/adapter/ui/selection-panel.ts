/**
 * @file selection-panel.ts
 * @description 选择面板 UI 组件 — 卡片式 inspector，显示选中对象的属性和需求条
 * @part-of adapter/ui
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import { PresentationState } from '../../presentation/presentation-state';
import type { Pawn } from '../../features/pawn/pawn.types';

/** 选择面板 UI 组件 */
export class SelectionPanelUI {
  private map: GameMap;
  private presentation: PresentationState;

  private selectionPanel: HTMLElement;
  private selHeaderEl: HTMLElement;
  private selPropsEl: HTMLElement;
  private selBarsEl: HTMLElement;

  private prevSelectionKey = '';

  constructor(map: GameMap, presentation: PresentationState) {
    this.map = map;
    this.presentation = presentation;

    this.selectionPanel = document.getElementById('ui-selection-panel')!;
    this.selHeaderEl = document.getElementById('ui-sel-header')!;
    this.selPropsEl = document.getElementById('ui-sel-props')!;
    this.selBarsEl = document.getElementById('ui-sel-bars')!;
  }

  update(): void {
    const ids = this.presentation.selectedObjectIds;

    if (ids.size === 0) {
      if (this.prevSelectionKey !== '') {
        this.selectionPanel.classList.remove('visible');
        this.prevSelectionKey = '';
      }
      return;
    }

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

  destroy(): void {
    this.selectionPanel.classList.remove('visible');
  }

  // ── 内部方法 ──

  private buildSelectionKey(ids: Set<string>): string {
    let key = `s:${ids.size}`;
    for (const id of ids) {
      const obj = this.map.objects.get(id);
      if (!obj) continue;
      key += `:${id}`;
      if (obj.kind === ObjectKind.Pawn) {
        const p = obj as Pawn;
        const jobDef = p.ai?.currentJob?.defId ?? 'idle';
        key += `,${jobDef},${Math.floor(p.needs?.food ?? 0)},${Math.floor(p.needs?.rest ?? 0)},${Math.floor(p.needs?.joy ?? 0)}`;
      }
    }
    return key;
  }

  private renderSingleSelection(obj: any): void {
    const kindLabel = this.getKindLabel(obj.kind);
    if (obj.kind === ObjectKind.Pawn) {
      this.selHeaderEl.textContent = `${obj.name}`;
    } else {
      this.selHeaderEl.textContent = `${kindLabel}: ${obj.defId}`;
    }

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

  private renderMultiSelection(ids: Set<string>): void {
    this.selHeaderEl.textContent = `${ids.size} objects selected`;

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

  private propRow(label: string, value: string): string {
    return `<div class="sel-prop-row"><span class="sel-prop-label">${label}</span><span>${value}</span></div>`;
  }

  private needBar(label: string, cssClass: string, value: number): string {
    const v = Math.max(0, Math.min(100, value));
    return `<div class="need-row">` +
      `<span class="need-label">${label}</span>` +
      `<div class="need-bar"><div class="need-bar-fill ${cssClass}" style="width:${v}%"></div></div>` +
      `<span class="need-value">${Math.floor(v)}</span>` +
      `</div>`;
  }

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
}
