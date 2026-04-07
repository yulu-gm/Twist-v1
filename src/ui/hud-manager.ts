/**
 * hud-manager：封装所有对 DOM 的直接操作。
 * GameScene 通过此类的语义化方法更新 HUD，不再持有 DOM 引用。
 */

import type { EntityRegistry } from "../game/entity-system";
import type { PawnState } from "../game/pawn-state";
import {
  WORK_TYPE_FELLING,
  WORK_TYPE_MINING,
  WORK_TYPE_PICKUP
} from "../game/work-generation";
import type { WorkRegistry } from "../game/work-system";
import type { TimeControlState, TimeOfDayPalette, TimeSpeed } from "../game/time-of-day";
import { formatTimeOfDayLabel, type TimeOfDayState } from "../game/time-of-day";
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

function workTypeLabelZh(workType: string): string {
  switch (workType) {
    case WORK_TYPE_FELLING:
      return "伐木";
    case WORK_TYPE_MINING:
      return "开采";
    case WORK_TYPE_PICKUP:
      return "拾取";
    default:
      return workType;
  }
}

function shortWorkId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-5)}`;
}

function workStatusLabelZh(
  status: string,
  inRegistry: boolean
): string {
  if (!inRegistry) return "已结束";
  switch (status) {
    case "pending":
      return "待分配";
    case "in_progress":
      return "进行中";
    default:
      return status;
  }
}

function pawnNameById(pawns: readonly PawnState[], pawnId: string): string {
  return pawns.find((p) => p.id === pawnId)?.name ?? pawnId.slice(0, 8);
}

export type WorkHudSyncInput = Readonly<{
  workRegistry: WorkRegistry;
  pawns: readonly PawnState[];
  treeCellCount: number;
  rockCellCount: number;
  resourceWarning: string | null;
  debugWorkHud: boolean;
  workAiEvents: readonly string[];
}>;

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

  // 工单摘要（PT008 人工验收）
  private workHudRoot: HTMLElement | null;
  private workHudSummaryEl: HTMLElement | null;
  private workHudListEl: HTMLElement | null;
  private workHudEventsEl: HTMLElement | null;
  private workHudHintEl: HTMLElement | null;

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
    this.workHudRoot = document.getElementById("work-hud-panel");
    this.workHudSummaryEl = document.getElementById("work-hud-summary");
    this.workHudListEl = document.getElementById("work-hud-list");
    this.workHudEventsEl = document.getElementById("work-hud-events");
    this.workHudHintEl = document.getElementById("work-hud-hint");
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

  public syncPawnDetail(
    pawn: PawnState | undefined,
    registry: EntityRegistry,
    workRegistry: WorkRegistry,
    workPerformDurationSec: number
  ): void {
    const panel = this.pawnDetailEl;
    if (!panel) return;

    if (!pawn) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    panel.hidden = false;
    const profile = registry.getPawn(pawn.id)?.displayProfile;
    const tags = profile
      ? profile.mockTags
          .map((t) => `<span class="pawn-detail-tag">${escapeHtml(t)}</span>`)
          .join("")
      : "";

    const goal = pawn.currentGoal?.kind ?? "—";
    const action = pawn.currentAction?.kind ?? "—";
    const n = pawn.needs;

    const workId = pawn.currentGoal?.workId;
    const workOrder = workId ? workRegistry.getWork(workId) : undefined;
    const workSection =
      workId !== undefined
        ? (() => {
            const row = workOrder?.targetCell;
            const cellTxt =
              row !== undefined ? `(${row.col},${row.row})` : "—";
            const typeZh = workOrder
              ? workTypeLabelZh(workOrder.workType)
              : "（未知类型）";
            const st = workOrder
              ? workStatusLabelZh(workOrder.status, true)
              : workStatusLabelZh("", false);
            const progressLine =
              pawn.currentAction?.kind === "perform-work" && workPerformDurationSec > 0
                ? `<div style="font-size:12px;color:#a89878;margin-top:4px">工单进度 ${(
                    (100 * Math.min(1, pawn.actionTimerSec / workPerformDurationSec))
                  ).toFixed(0)}%</div>`
                : "";
            return `
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">当前工单</div>
        <div style="font-size:12px">编号 <code style="color:#d4c4a8">${escapeHtml(shortWorkId(workId))}</code></div>
        <div style="font-size:12px">类型 ${escapeHtml(typeZh)}　目标格 ${escapeHtml(cellTxt)}</div>
        <div style="font-size:12px">登记 ${escapeHtml(st)}</div>
        ${progressLine}
      </div>`;
          })()
        : "";

    panel.innerHTML = `
      <h2>${escapeHtml(pawn.name)}</h2>
      <p class="pawn-detail-epithet">${escapeHtml(profile?.epithet ?? "（无档案）")}</p>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">简介</div>
        <div>${escapeHtml(profile?.bio ?? "暂无。")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">备注</div>
        <div>${escapeHtml(profile?.notes ?? "—")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">当前状态</div>
        <div>饥饿 ${n.hunger.toFixed(1)}　休息 ${n.rest.toFixed(1)}　娱乐 ${n.recreation.toFixed(1)}</div>
        <div>目标 <code style="font-size:12px;color:#d4c4a8">${escapeHtml(String(goal))}</code>
        　行动 <code style="font-size:12px;color:#d4c4a8">${escapeHtml(String(action))}</code></div>
        <div style="font-size:12px;color:#a89878;margin-top:4px">${escapeHtml(pawn.debugLabel)}</div>
      </div>
      ${workSection}
      ${
        tags
          ? `<div class="pawn-detail-section"><div class="pawn-detail-label">标签</div><div class="pawn-detail-tags">${tags}</div></div>`
          : ""
      }
    `;
  }

  public syncWorkHud(input: WorkHudSyncInput, palette: TimeOfDayPalette): void {
    const root = this.workHudRoot;
    const sumEl = this.workHudSummaryEl;
    const listEl = this.workHudListEl;
    const eventsEl = this.workHudEventsEl;
    const hintEl = this.workHudHintEl;
    if (!root || !sumEl || !listEl) return;

    root.hidden = false;
    const primaryColor = colorToCss(palette.primaryTextColor);
    root.style.color = primaryColor;

    const pending = input.workRegistry.listPending();
    const prog = input.workRegistry.listInProgress();
    const pendingN = pending.length;
    const progN = prog.length;

    sumEl.textContent = `工单 · 待分配 ${pendingN} · 进行中 ${progN}　登记资源 · 树 ${input.treeCellCount} · 岩 ${input.rockCellCount}`;
    if (input.resourceWarning) {
      sumEl.textContent += `　${input.resourceWarning}`;
    }

    const rows: string[] = [];
    const sorted = [...pending, ...prog].sort((a, b) => {
      const oa = a.status === "in_progress" ? 0 : 1;
      const ob = b.status === "in_progress" ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return b.priority - a.priority;
    });
    const maxRows = 5;
    for (let i = 0; i < Math.min(maxRows, sorted.length); i++) {
      const w = sorted[i]!;
      const typeZh = workTypeLabelZh(w.workType);
      const st = workStatusLabelZh(w.status, true);
      const cell = w.targetCell;
      const res = input.workRegistry.getReservation(w.id);
      const assignee = res ? pawnNameById(input.pawns, res.pawnId) : "—";
      const tid = w.targetEntityId ? shortWorkId(w.targetEntityId) : "—";
      rows.push(
        `${typeZh} ${st} · (${cell.col},${cell.row}) · 目标 ${tid} · ${assignee}`
      );
    }
    listEl.textContent = rows.length ? rows.join("\n") : "（尚无工单）";

    if (eventsEl) {
      const showEvents = input.debugWorkHud && input.workAiEvents.length > 0;
      eventsEl.hidden = !showEvents;
      if (showEvents) {
        eventsEl.textContent = input.workAiEvents.slice(-20).join("\n");
      }
    }

    if (hintEl) {
      hintEl.style.color = colorToCss(palette.secondaryTextColor);
      hintEl.textContent = input.debugWorkHud
        ? "调试工单 HUD 已开启（URL ?debugWorkHud=1 或 ?qaLayout=1）。"
        : "领取失败、无路可达等说明：请使用 ?debugWorkHud=1 或 ?qaLayout=1 查看工单事件流。";
    }
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
