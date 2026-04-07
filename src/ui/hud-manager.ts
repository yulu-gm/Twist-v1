/**
 * hud-manager：封装所有对 DOM 的直接操作。
 * GameScene 通过此类的语义化方法更新 HUD，不再持有 DOM 引用。
 */

import type { PawnState } from "../game/pawn-state";
import type { TimeControlState, TimeOfDayPalette, TimeSpeed } from "../game/time-of-day";
import { formatTimeOfDayLabel, type TimeOfDayState } from "../game/time-of-day";
import { pawnProfileForId } from "../data/pawn-profiles";
import { VILLAGER_TOOL_KEY_CODES, type VillagerTool } from "../data/villager-tools";
import {
  DEFAULT_COMMAND_MENU,
  TOOL_GROUPS,
  createDefaultMainMenuState,
  createDefaultToolbarState,
  type CommandMenuLeafId,
  type CommandMenuRoot,
  type MainMenuState,
  type ToolbarState,
  type ToolItem
} from "./command-menu";

export type { VillagerTool };
export { VILLAGER_TOOL_KEY_CODES };

/** 时间控制回调，由 GameScene 提供。 */
export type TimeControlCallbacks = Readonly<{
  onTogglePause: () => void;
  onSetSpeed: (speed: TimeSpeed) => void;
}>;

/** 工具选中回调。 */
export type ToolSelectCallback = (index: number) => void;

/** Pawn 选中回调。 */
export type PawnSelectCallback = (pawnId: string | null) => void;

export type CommandMenuSelectCallback = (toolGroupId: string) => void;

function colorToCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class HudManager {
  // 时间 HUD
  private sceneHudEl: HTMLElement | null;
  private sceneTimeValueEl: HTMLElement | null;
  private sceneTimeToggleEl: HTMLButtonElement | null;
  private sceneSpeedEls: Map<TimeSpeed, HTMLButtonElement>;

  // Hover 信息
  private hoverHudEl: HTMLElement | null;

  // 指令菜单 + 模式提示
  private commandMenuRoot: HTMLElement | null;
  private mainMenuState: MainMenuState = createDefaultMainMenuState();
  private toolbarState: ToolbarState = createDefaultToolbarState();
  private commandMenuAbort: AbortController | null = null;
  private modeHintEl: HTMLElement | null;

  // 工具栏
  private toolBarRoot: HTMLElement | null;
  private toolSlotEls: HTMLElement[] = [];
  private toolUiAbort: AbortController | null = null;

  // Pawn 名册 + 详情
  private rosterRoot: HTMLElement | null;
  private pawnDetailEl: HTMLElement | null;
  private pawnRosterSlotEls: HTMLElement[] = [];
  private pawnRosterAbort: AbortController | null = null;

  // 场景变体
  private variantSelectAbort: AbortController | null = null;

  public constructor() {
    this.sceneHudEl = document.getElementById("scene-hud");
    this.sceneTimeValueEl = document.getElementById("scene-time-value");
    this.sceneTimeToggleEl = document.getElementById("scene-time-toggle") as HTMLButtonElement | null;
    this.sceneSpeedEls = new Map<TimeSpeed, HTMLButtonElement>(
      ([1, 2, 3] as TimeSpeed[]).map((s) => [
        s,
        document.getElementById(`scene-speed-${s}`) as HTMLButtonElement
      ]).filter((e): e is [TimeSpeed, HTMLButtonElement] => e[1] !== null)
    );
    this.hoverHudEl = document.getElementById("grid-hover-info");
    this.modeHintEl = document.getElementById("mode-hint");
    this.commandMenuRoot = document.getElementById("command-menu");
    this.toolBarRoot = document.getElementById("villager-tool-bar");
    this.rosterRoot = document.getElementById("pawn-roster");
    this.pawnDetailEl = document.getElementById("pawn-detail-panel");
  }

  // ── 时间 HUD ──────────────────────────────────────────────

  public setupTimeControls(callbacks: TimeControlCallbacks): AbortController {
    const abort = new AbortController();
    const { signal } = abort;

    this.sceneTimeToggleEl?.addEventListener(
      "click",
      () => callbacks.onTogglePause(),
      { signal }
    );

    for (const [speed, button] of this.sceneSpeedEls) {
      button.addEventListener(
        "click",
        () => callbacks.onSetSpeed(speed),
        { signal }
      );
    }

    return abort;
  }

  public syncTimeOfDayHud(
    state: TimeOfDayState,
    controls: TimeControlState,
    palette: TimeOfDayPalette
  ): void {
    const primaryColor = colorToCss(palette.primaryTextColor);

    if (this.sceneHudEl) {
      this.sceneHudEl.style.color = primaryColor;
    }

    if (this.sceneTimeValueEl) {
      const label = formatTimeOfDayLabel(state);
      if (this.sceneTimeValueEl.textContent !== label) {
        this.sceneTimeValueEl.textContent = label;
      }
      this.sceneTimeValueEl.style.color = primaryColor;
    }

    if (this.sceneTimeToggleEl) {
      this.sceneTimeToggleEl.textContent = controls.paused ? "开启" : "暂停";
      this.sceneTimeToggleEl.classList.toggle("selected", controls.paused);
      this.sceneTimeToggleEl.setAttribute(
        "aria-pressed",
        controls.paused ? "true" : "false"
      );
      this.sceneTimeToggleEl.style.color = primaryColor;
    }

    for (const [speed, button] of this.sceneSpeedEls) {
      const selected = controls.speed === speed;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.style.color = primaryColor;
    }
  }

  public setHoverInfoColor(palette: TimeOfDayPalette): void {
    if (this.hoverHudEl) {
      this.hoverHudEl.style.color = colorToCss(palette.primaryTextColor);
    }
  }

  // ── Hover 格信息 ──────────────────────────────────────────

  public showHoverInfo(text: string): void {
    if (this.hoverHudEl) {
      this.hoverHudEl.hidden = false;
      this.hoverHudEl.textContent = text;
    }
  }

  public hideHoverInfo(): void {
    if (this.hoverHudEl) {
      this.hoverHudEl.hidden = true;
    }
  }

  // ── 模式提示 ────────────────────────────────────────────────

  public showModeHint(text: string): void {
    const el = this.modeHintEl;
    if (!el) return;
    el.hidden = false;
    if (el.textContent !== text) el.textContent = text;
  }

  public hideModeHint(): void {
    const el = this.modeHintEl;
    if (!el) return;
    el.hidden = true;
  }

  public setModeHintColor(palette: TimeOfDayPalette): void {
    if (this.modeHintEl) {
      this.modeHintEl.style.color = colorToCss(palette.primaryTextColor);
    }
  }

  // ── 指令菜单 ────────────────────────────────────────────────

  public setupCommandMenu(
    onSelect: CommandMenuSelectCallback,
    menu: readonly CommandMenuRoot[] = DEFAULT_COMMAND_MENU
  ): AbortController {
    this.teardownCommandMenu();
    const abort = new AbortController();
    this.commandMenuAbort = abort;
    if (!this.commandMenuRoot) return abort;

    this.mainMenuState = createDefaultMainMenuState();
    this.commandMenuRoot.replaceChildren();
    this.renderCommandMenu(menu, onSelect, abort.signal);
    return abort;
  }

  public teardownCommandMenu(): void {
    this.commandMenuAbort?.abort();
    this.commandMenuAbort = null;
    if (this.commandMenuRoot) this.commandMenuRoot.replaceChildren();
    this.mainMenuState = createDefaultMainMenuState();
  }

  private renderCommandMenu(
    menu: readonly CommandMenuRoot[],
    onSelect: CommandMenuSelectCallback,
    signal: AbortSignal
  ): void {
    const rootEl = this.commandMenuRoot;
    if (!rootEl) return;

    const wrapper = document.createElement("div");
    wrapper.className = "command-menu-level";

    const title = document.createElement("div");
    title.className = "command-menu-title";
    title.textContent = "菜单";
    wrapper.appendChild(title);

    for (const root of menu) {
      const rootBtn = document.createElement("button");
      rootBtn.type = "button";
      rootBtn.className = "command-menu-item";
      rootBtn.textContent = root.label;
      rootBtn.setAttribute("aria-expanded", "false");
      rootBtn.addEventListener(
        "click",
        () => {
          const nextExpanded = this.mainMenuState.expandedRootId === root.id ? null : root.id;
          this.mainMenuState = {
            expandedRootId: nextExpanded,
            expandedSecondId: null
          };
          this.commandMenuRoot?.replaceChildren();
          this.renderCommandMenu(menu, onSelect, signal);
        },
        { signal }
      );
      wrapper.appendChild(rootBtn);

      const expanded = this.mainMenuState.expandedRootId === root.id;
      rootBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (!expanded) continue;

      const secondsEl = document.createElement("div");
      secondsEl.className = "command-menu-children";

      for (const second of root.seconds) {
        const secondBtn = document.createElement("button");
        secondBtn.type = "button";
        secondBtn.className = "command-menu-item";
        secondBtn.textContent = second.label;
        secondBtn.setAttribute("aria-expanded", "false");
        secondBtn.addEventListener(
          "click",
          () => {
            const nextExpanded = this.mainMenuState.expandedSecondId === second.id ? null : second.id;
            this.mainMenuState = {
              ...this.mainMenuState,
              expandedSecondId: nextExpanded
            };
            this.commandMenuRoot?.replaceChildren();
            this.renderCommandMenu(menu, onSelect, signal);
            
            // Notify that a second level menu was clicked, which should update the toolbar
            if (nextExpanded) {
              onSelect(second.toolGroupId);
            }
          },
          { signal }
        );
        secondsEl.appendChild(secondBtn);

        const secondExpanded = this.mainMenuState.expandedSecondId === second.id;
        secondBtn.setAttribute("aria-expanded", secondExpanded ? "true" : "false");
      }

      wrapper.appendChild(secondsEl);
    }

    rootEl.appendChild(wrapper);
  }

  // ── 工具栏 ────────────────────────────────────────────────

  public setupToolBar(
    onSelect: ToolSelectCallback,
    toolGroupId: string
  ): AbortController {
    this.teardownToolBar();
    const abort = new AbortController();
    const { signal } = abort;
    this.toolUiAbort = abort;
    
    this.toolbarState = { ...this.toolbarState, toolGroupId };

    if (this.toolBarRoot) {
      const group = TOOL_GROUPS.find((g) => g.id === toolGroupId);
      if (group) {
        for (let i = 0; i < group.tools.length; i++) {
          const tool = group.tools[i]!;
          const slot = document.createElement("button");
          slot.type = "button";
          slot.className = "tool-slot";
          slot.dataset.toolId = tool.id;
          if (tool.hotkey) {
            slot.title = `${tool.modeHint || tool.label}（${tool.hotkey}）`;
            slot.setAttribute("aria-label", `${tool.label}，快捷键 ${tool.hotkey}`);
            slot.innerHTML = `<span class="tool-key">${tool.hotkey}</span><div class="tool-label">${tool.label}</div>`;
          } else {
            slot.title = tool.modeHint || tool.label;
            slot.setAttribute("aria-label", tool.label);
            slot.innerHTML = `<div class="tool-label">${tool.label}</div>`;
          }
          slot.addEventListener("click", () => onSelect(i), { signal });
          this.toolBarRoot.appendChild(slot);
          this.toolSlotEls.push(slot);
        }
      }
    }

    return abort;
  }

  public syncToolBarSelection(index: number): void {
    for (let i = 0; i < this.toolSlotEls.length; i++) {
      const el = this.toolSlotEls[i]!;
      const on = i === index;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
    
    const group = TOOL_GROUPS.find((g) => g.id === this.toolbarState.toolGroupId);
    if (group && group.tools[index]) {
      this.toolbarState = { ...this.toolbarState, selectedToolId: group.tools[index]!.id };
    }
  }

  public teardownToolBar(): void {
    this.toolUiAbort?.abort();
    this.toolUiAbort = null;
    this.toolSlotEls = [];
    if (this.toolBarRoot) this.toolBarRoot.replaceChildren();
  }

  // ── 场景变体选择器 ────────────────────────────────────────

  public bindSceneVariantSelect(
    currentVariant: string,
    onChange: (variant: string) => void
  ): AbortController {
    this.variantSelectAbort?.abort();
    const abort = new AbortController();
    this.variantSelectAbort = abort;

    const sel = document.getElementById("scene-variant") as HTMLSelectElement | null;
    if (sel) {
      sel.value = currentVariant;
      sel.addEventListener(
        "change",
        () => onChange(sel.value),
        { signal: abort.signal }
      );
    }

    return abort;
  }

  // ── Pawn 名册 ─────────────────────────────────────────────

  public setupPawnRoster(
    pawns: readonly PawnState[],
    onSelect: PawnSelectCallback
  ): AbortController {
    this.teardownPawnRoster();
    const abort = new AbortController();
    const { signal } = abort;
    this.pawnRosterAbort = abort;

    if (this.rosterRoot) {
      for (const pawn of pawns) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "pawn-roster-item";
        slot.dataset.pawnId = pawn.id;
        slot.setAttribute("role", "tab");
        slot.title = `查看 ${pawn.name}`;
        slot.setAttribute("aria-label", `${pawn.name}，打开人物信息`);

        const thumb = document.createElement("span");
        thumb.className = "pawn-roster-thumb";
        thumb.style.backgroundColor = colorToCss(pawn.fillColor);
        thumb.setAttribute("aria-hidden", "true");

        const nameEl = document.createElement("span");
        nameEl.className = "pawn-roster-name";
        nameEl.textContent = pawn.name;

        slot.append(thumb, nameEl);
        slot.addEventListener("click", () => onSelect(pawn.id), { signal });
        this.rosterRoot.appendChild(slot);
        this.pawnRosterSlotEls.push(slot);
      }
    }

    return abort;
  }

  public syncRosterSelection(selectedPawnId: string | null): void {
    for (const el of this.pawnRosterSlotEls) {
      const on = el.dataset.pawnId === selectedPawnId;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  public teardownPawnRoster(): void {
    this.pawnRosterAbort?.abort();
    this.pawnRosterAbort = null;
    this.pawnRosterSlotEls = [];
    if (this.rosterRoot) this.rosterRoot.replaceChildren();
  }

  // ── Pawn 详情面板 ─────────────────────────────────────────

  public syncPawnDetail(pawn: PawnState | undefined): void {
    const panel = this.pawnDetailEl;
    if (!panel) return;

    if (!pawn) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    panel.hidden = false;
    const profile = pawnProfileForId(pawn.id);
    const tags = profile
      ? profile.mockTags
          .map((t) => `<span class="pawn-detail-tag">${escapeHtml(t)}</span>`)
          .join("")
      : "";

    const goal = pawn.currentGoal?.kind ?? "—";
    const action = pawn.currentAction?.kind ?? "—";
    const n = pawn.needs;

    panel.innerHTML = `
      <h2>${escapeHtml(pawn.name)}</h2>
      <p class="pawn-detail-epithet">${escapeHtml(profile?.epithet ?? "（无档案）")}</p>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">简介（mock）</div>
        <div>${escapeHtml(profile?.bio ?? "暂无。")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">备注（mock）</div>
        <div>${escapeHtml(profile?.notes ?? "—")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">当前状态</div>
        <div>饥饿 ${n.hunger.toFixed(1)}　休息 ${n.rest.toFixed(1)}　娱乐 ${n.recreation.toFixed(1)}</div>
        <div>目标 <code style="font-size:12px;color:#d4c4a8">${escapeHtml(String(goal))}</code>
        　行动 <code style="font-size:12px;color:#d4c4a8">${escapeHtml(String(action))}</code></div>
        <div style="font-size:12px;color:#a89878;margin-top:4px">${escapeHtml(pawn.debugLabel)}</div>
      </div>
      ${
        tags
          ? `<div class="pawn-detail-section"><div class="pawn-detail-label">标签（mock）</div><div class="pawn-detail-tags">${tags}</div></div>`
          : ""
      }
    `;
  }

  public teardownPawnDetail(): void {
    if (this.pawnDetailEl) {
      this.pawnDetailEl.hidden = true;
      this.pawnDetailEl.replaceChildren();
    }
  }

  // ── 全部清理 ──────────────────────────────────────────────

  public teardownAll(): void {
    this.teardownCommandMenu();
    this.teardownToolBar();
    this.teardownPawnRoster();
    this.teardownPawnDetail();
    this.variantSelectAbort?.abort();
    this.variantSelectAbort = null;
  }
}
