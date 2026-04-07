/**
 * hud-manager：封装所有对 DOM 的直接操作。
 * GameScene 通过此类的语义化方法更新 HUD，不再持有 DOM 引用。
 */

import type { PawnState } from "../game/pawn-state";
import type { WorkItemSnapshot } from "../game/work/work-types";
import type { TimeControlState, TimeSpeed } from "../game/time";
import type { TimeOfDayPalette } from "./time-of-day-palette";
import { formatTimeOfDayLabel, type TimeOfDayState } from "../game/time";
import { pawnProfileForId } from "../data/pawn-profiles";
import { pawnDetailBehaviorLabelZh } from "./status-display-model";
import type { RuntimeLogPanelEntry } from "../runtime-log/runtime-log";
import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES, type VillagerTool } from "../data/villager-tools";
import {
  COMMAND_MENU_CATEGORIES,
  commandMenuHotkeyLabel,
  commandMenuListRowsForCategory,
  defaultCommandMenuCommandId,
  getCommandMenuCategory,
  getCommandMenuCommand,
  type CommandMenuCategoryId,
  type CommandMenuCommandId
} from "../data/command-menu";
import { needSignalsFromNeeds } from "../game/need";
import type { ScenarioDefinition } from "../headless/scenario-types";

export type { VillagerTool };
export { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES };

/** 时间控制回调，由 GameScene 提供。 */
export type TimeControlCallbacks = Readonly<{
  onTogglePause: () => void;
  onSetSpeed: (speed: TimeSpeed) => void;
}>;

/** Pawn 选中回调。 */
export type PawnSelectCallback = (pawnId: string | null) => void;

/** 运行时调试面板回调。 */
export type DebugPanelCallbacks = Readonly<{
  onToggleOpen: () => void;
  onTogglePause: () => void;
  onClear: () => void;
  onFilterChange: (value: string) => void;
  onFilterFocusChange?: (focused: boolean) => void;
  onSelectEntry: (entryId: string) => void;
}>;

/** 调试面板渲染状态。 */
export type DebugPanelState = Readonly<{
  open: boolean;
  paused: boolean;
  filter: string;
  selectedEntryId: string | null;
  entries: readonly RuntimeLogPanelEntry[];
  /** 开发服 NDJSON 落盘路径（无则空串不展示）。 */
  devNdjsonFilePath?: string;
}>;

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

  // 玩家通道：交互模式提示 + 世界快照脚注
  private playerChannelModeEl: HTMLElement | null;
  private playerChannelResultEl: HTMLElement | null;
  private playerChannelContractEl: HTMLElement | null;

  // 工具栏
  private toolBarRoot: HTMLElement | null;
  private toolSlotEls: HTMLElement[] = [];
  private toolUiAbort: AbortController | null = null;
  /** 建造槽位的子菜单容器（仅 `build` 槽存在此项）。 */
  private buildSubmenuContainer: HTMLElement | null = null;
  private buildToolIndex: number | null = null;
  private commandCategoryEls: HTMLButtonElement[] = [];
  private commandMenuAbort: AbortController | null = null;
  private commandMenuSelectedId: string | null = null;
  private commandMenuActiveCategoryId: string | null = null;
  private commandMenuOpen = true;
  private commandMenuOnSelect: ((commandId: string) => void) | null = null;

  // Pawn 名册 + 详情
  private rosterRoot: HTMLElement | null;
  private pawnDetailEl: HTMLElement | null;
  private pawnRosterSlotEls: HTMLElement[] = [];
  private pawnRosterAbort: AbortController | null = null;

  private variantSelectAbort: AbortController | null = null;
  private yamlScenarioAbort: AbortController | null = null;

  private yamlScenarioSelectEl: HTMLSelectElement | null;
  private yamlScenarioDescEl: HTMLElement | null;
  private yamlScenarioManualEl: HTMLElement | null;
  private yamlScenarioManualStepsEl: HTMLOListElement | null;
  private yamlScenarioManualOutcomesEl: HTMLOListElement | null;

  // 运行时调试面板
  private debugToggleEl: HTMLButtonElement | null;
  private debugPanelEl: HTMLElement | null;
  private debugClearEl: HTMLButtonElement | null;
  private debugPauseEl: HTMLButtonElement | null;
  private debugFilterEl: HTMLInputElement | null;
  private debugCountEl: HTMLElement | null;
  private debugNdjsonPathEl: HTMLElement | null;
  private debugLogListEl: HTMLElement | null;
  private debugDetailEl: HTMLElement | null;
  private debugUiAbort: AbortController | null = null;
  private debugCallbacks: DebugPanelCallbacks | null = null;

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
    this.playerChannelModeEl = document.getElementById("player-channel-mode");
    this.playerChannelResultEl = document.getElementById("player-channel-result");
    this.playerChannelContractEl = document.getElementById("player-channel-contract");
    this.toolBarRoot = document.getElementById("villager-tool-bar");
    this.rosterRoot = document.getElementById("pawn-roster");
    this.pawnDetailEl = document.getElementById("pawn-detail-panel");
    this.yamlScenarioSelectEl = document.getElementById(
      "yaml-scenario-select"
    ) as HTMLSelectElement | null;
    this.yamlScenarioDescEl = document.getElementById("yaml-scenario-desc");
    this.yamlScenarioManualEl = document.getElementById("yaml-scenario-manual");
    this.yamlScenarioManualStepsEl = document.getElementById(
      "yaml-scenario-manual-steps"
    ) as HTMLOListElement | null;
    this.yamlScenarioManualOutcomesEl = document.getElementById(
      "yaml-scenario-manual-outcomes"
    ) as HTMLOListElement | null;
    this.debugToggleEl = document.getElementById("scene-debug-toggle") as HTMLButtonElement | null;
    this.debugPanelEl = document.getElementById("scene-debug-panel");
    this.debugClearEl = document.getElementById("scene-debug-clear") as HTMLButtonElement | null;
    this.debugPauseEl = document.getElementById("scene-debug-pause") as HTMLButtonElement | null;
    this.debugFilterEl = document.getElementById("scene-debug-filter") as HTMLInputElement | null;
    this.debugCountEl = document.getElementById("scene-debug-count");
    this.debugNdjsonPathEl = document.getElementById("scene-debug-ndjson-path");
    this.debugLogListEl = document.getElementById("scene-debug-log-list");
    this.debugDetailEl = document.getElementById("scene-debug-detail");
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
      this.sceneTimeToggleEl.classList.toggle("time-paused", controls.paused);
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

  // ── B 线：玩家通道提示（模式文案 + mock 网关反馈）────────────────

  public syncPlayerChannelHint(
    modeLine: string,
    contractFootnote: string,
    usesBrushStroke = false
  ): void {
    if (this.playerChannelModeEl) {
      if (this.playerChannelModeEl.textContent !== modeLine) {
        this.playerChannelModeEl.textContent = modeLine;
      }
      const hintRoot = this.playerChannelModeEl.parentElement;
      if (hintRoot) {
        const next = usesBrushStroke ? "true" : "false";
        if (hintRoot.dataset.usesBrushStroke !== next) {
          hintRoot.dataset.usesBrushStroke = next;
        }
      }
    }
    if (this.playerChannelContractEl) {
      this.playerChannelContractEl.textContent = contractFootnote;
    }
  }

  public syncPlayerChannelLastResult(line: string | null): void {
    const el = this.playerChannelResultEl;
    if (!el) return;
    if (line === null || line === "") {
      el.textContent = "";
      return;
    }
    el.textContent = line;
  }

  // ── 左上角：仅测试场景显示名 ─────────────────────────────

  public bindSceneVariantSelect(
    currentVariant: string,
    onChange: (variant: string) => void
  ): AbortController {
    this.variantSelectAbort?.abort();
    const abort = new AbortController();
    this.variantSelectAbort = abort;

    const sel = document.getElementById("scene-variant") as HTMLSelectElement | null;
    if (sel) {
      sel.value = currentVariant === "alt-en" ? "alt-en" : "default";
      sel.addEventListener(
        "change",
        () => onChange(sel.value),
        { signal: abort.signal }
      );
    }

    return abort;
  }

  // ── 右下角：`scenarios/*.scenario.ts` 热切换 ───────────────

  public setupYamlScenarioPanel(
    scenarios: readonly ScenarioDefinition[],
    onApply: (def: ScenarioDefinition) => void
  ): AbortController {
    this.teardownYamlScenarioPanel();
    const abort = new AbortController();
    this.yamlScenarioAbort = abort;
    const { signal } = abort;
    const sel = this.yamlScenarioSelectEl;
    if (sel) {
      sel.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "— 选择要载入的测试场景 —";
      sel.appendChild(placeholder);
      for (let i = 0; i < scenarios.length; i++) {
        const def = scenarios[i]!;
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = def.name;
        sel.appendChild(opt);
      }
      sel.value = "";
      sel.addEventListener(
        "change",
        () => {
          const v = sel.value;
          if (v === "") {
            this.syncYamlScenarioManualHints(null);
            return;
          }
          const idx = Number(v);
          const def = scenarios[idx];
          if (!def) return;
          this.syncYamlScenarioManualHints(def);
          onApply(def);
        },
        { signal }
      );
    }
    return abort;
  }

  /** 根据 {@link ScenarioDefinition.manualAcceptance} 更新右下角人工验收文案；`def === null` 时隐藏。 */
  public syncYamlScenarioManualHints(def: ScenarioDefinition | null): void {
    const desc = this.yamlScenarioDescEl;
    const wrap = this.yamlScenarioManualEl;
    const stepsOl = this.yamlScenarioManualStepsEl;
    const outOl = this.yamlScenarioManualOutcomesEl;
    if (!desc || !wrap || !stepsOl || !outOl) return;

    if (!def) {
      desc.hidden = true;
      desc.textContent = "";
      wrap.hidden = true;
      stepsOl.replaceChildren();
      outOl.replaceChildren();
      return;
    }

    desc.hidden = false;
    desc.textContent = def.description;

    const ma = def.manualAcceptance;
    const defaultSteps = [
      "从下拉框选择本场景以载入数据。",
      "用左上时间控制运行模拟，观察地图、名册与小人详情。"
    ];
    const steps = ma?.steps ?? defaultSteps;
    const outcomes =
      ma?.outcomes ?? (def.expectations?.map((e) => `${e.label}（${e.type}）`) ?? ["（本场景未声明期望，请自行对照玩法）"]);

    stepsOl.replaceChildren();
    for (const line of steps) {
      const li = document.createElement("li");
      li.textContent = line;
      stepsOl.appendChild(li);
    }
    outOl.replaceChildren();
    for (const line of outcomes) {
      const li = document.createElement("li");
      li.textContent = line;
      outOl.appendChild(li);
    }
    wrap.hidden = false;
  }

  public teardownYamlScenarioPanel(): void {
    this.yamlScenarioAbort?.abort();
    this.yamlScenarioAbort = null;
    this.syncYamlScenarioManualHints(null);
  }

  // ── 运行时调试面板 ───────────────────────────────────────

  public setupDebugPanel(callbacks: DebugPanelCallbacks): AbortController {
    this.teardownDebugPanel();
    const abort = new AbortController();
    const { signal } = abort;
    this.debugUiAbort = abort;
    this.debugCallbacks = callbacks;

    this.debugToggleEl?.addEventListener(
      "click",
      () => callbacks.onToggleOpen(),
      { signal }
    );
    this.debugPauseEl?.addEventListener(
      "click",
      () => callbacks.onTogglePause(),
      { signal }
    );
    this.debugClearEl?.addEventListener(
      "click",
      () => callbacks.onClear(),
      { signal }
    );
    this.debugFilterEl?.addEventListener(
      "input",
      () => callbacks.onFilterChange(this.debugFilterEl?.value ?? ""),
      { signal }
    );
    this.debugFilterEl?.addEventListener(
      "focus",
      () => callbacks.onFilterFocusChange?.(true),
      { signal }
    );
    this.debugFilterEl?.addEventListener(
      "blur",
      () => callbacks.onFilterFocusChange?.(false),
      { signal }
    );
    return abort;
  }

  public syncDebugPanel(state: DebugPanelState): void {
    if (this.debugPanelEl) {
      this.debugPanelEl.hidden = !state.open;
    }
    if (this.debugToggleEl) {
      this.debugToggleEl.setAttribute("aria-pressed", state.open ? "true" : "false");
    }
    if (!state.open) {
      return;
    }
    if (this.debugPauseEl) {
      this.debugPauseEl.classList.toggle("selected", state.paused);
      this.debugPauseEl.setAttribute("aria-pressed", state.paused ? "true" : "false");
    }
    if (this.debugFilterEl && this.debugFilterEl.value !== state.filter) {
      this.debugFilterEl.value = state.filter;
    }
    if (this.debugCountEl) {
      this.debugCountEl.textContent = `${state.entries.length}`;
    }
    if (this.debugNdjsonPathEl) {
      const path = state.devNdjsonFilePath?.trim() ?? "";
      this.debugNdjsonPathEl.textContent =
        path.length > 0 ? `NDJSON 落盘：${path}` : "";
      this.debugNdjsonPathEl.hidden = path.length === 0;
    }
    if (this.debugLogListEl) {
      this.debugLogListEl.replaceChildren();
      for (const entry of state.entries) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "scene-debug-log-entry";
        row.dataset.entryId = entry.id;
        row.textContent = entry.text;
        const selected = entry.id === state.selectedEntryId;
        row.classList.toggle("selected", selected);
        row.setAttribute("aria-pressed", selected ? "true" : "false");
        row.addEventListener("click", () => this.debugCallbacks?.onSelectEntry(entry.id));
        row.addEventListener("pointerdown", () => this.debugCallbacks?.onSelectEntry(entry.id));
        this.debugLogListEl.appendChild(row);
      }
    }
    if (this.debugDetailEl) {
      const selectedEntry = state.entries.find((entry) => entry.id === state.selectedEntryId) ?? null;
      this.debugDetailEl.textContent = selectedEntry?.detailText ?? "";
    }
  }

  public teardownDebugPanel(): void {
    this.debugUiAbort?.abort();
    this.debugUiAbort = null;
    this.debugCallbacks = null;
  }

  private commandMenuCategoryForId(categoryId: string | null) {
    if (!categoryId) return null;
    return getCommandMenuCategory(categoryId as CommandMenuCategoryId) ?? null;
  }

  private renderCommandMenu(): void {
    const root = this.toolBarRoot;
    if (!root) return;

    root.replaceChildren();
    this.toolSlotEls = [];
    this.commandCategoryEls = [];

    const fromSelectedId = this.commandMenuSelectedId
      ? getCommandMenuCommand(this.commandMenuSelectedId as CommandMenuCommandId)
      : undefined;
    const selectedEntry = fromSelectedId ?? getCommandMenuCommand(defaultCommandMenuCommandId())!;
    const activeCategoryId =
      this.commandMenuCategoryForId(this.commandMenuActiveCategoryId)?.id ?? selectedEntry.categoryId;
    this.commandMenuActiveCategoryId = activeCategoryId;

    const primary = document.createElement("button");
    primary.type = "button";
    primary.id = "villager-command-primary";
    primary.className = "villager-command-primary";
    primary.dataset.commandId = selectedEntry.id;
    primary.dataset.categoryId = selectedEntry.categoryId;
    primary.setAttribute("aria-label", `当前命令 ${selectedEntry.label}`);
    primary.setAttribute("aria-pressed", "true");
    const activeCategoryLabel = getCommandMenuCategory(selectedEntry.categoryId)?.label ?? selectedEntry.categoryId;
    primary.innerHTML = `
      <span class="command-primary-prefix">当前命令</span>
      <span class="command-primary-label">${escapeHtml(selectedEntry.label)}</span>
      <span class="command-primary-meta">${escapeHtml(activeCategoryLabel)}</span>
    `;
    primary.addEventListener(
      "click",
      () => {
        this.commandMenuOpen = !this.commandMenuOpen;
        this.renderCommandMenu();
      },
      { signal: this.commandMenuAbort?.signal }
    );

    const categories = document.createElement("div");
    categories.id = "villager-command-categories";
    categories.className = "villager-command-categories";
    categories.setAttribute("role", "tablist");
    categories.setAttribute("aria-label", "命令分类");
    categories.hidden = !this.commandMenuOpen;

    for (const category of COMMAND_MENU_CATEGORIES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-category-button";
      button.dataset.categoryId = category.id;
      button.textContent = category.label;
      const selected = category.id === activeCategoryId;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.setAttribute("aria-controls", "villager-command-list");
      button.addEventListener(
        "click",
        () => {
          this.commandMenuActiveCategoryId = category.id;
          this.renderCommandMenu();
        },
        { signal: this.commandMenuAbort?.signal }
      );
      categories.appendChild(button);
      this.commandCategoryEls.push(button);
    }

    const list = document.createElement("div");
    list.id = "villager-command-list";
    list.className = "villager-command-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "命令列表");
    list.hidden = !this.commandMenuOpen;

    const rows = commandMenuListRowsForCategory(activeCategoryId as CommandMenuCategoryId);
    for (const row of rows) {
      if (row.kind === "subgroup-heading") {
        const heading = document.createElement("div");
        heading.className = "command-subgroup-heading";
        heading.setAttribute("role", "presentation");
        heading.textContent = row.label;
        list.appendChild(heading);
        continue;
      }
      const entry = row.command;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-item-button";
      button.dataset.commandId = entry.id;
      button.dataset.categoryId = entry.categoryId;
      const selected = entry.id === selectedEntry.id;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      const hotkey = commandMenuHotkeyLabel(entry.id);
      button.setAttribute("aria-label", `${entry.label}，快捷键 ${hotkey}`);
      button.innerHTML = `
        <span class="command-item-hotkey">${escapeHtml(hotkey)}</span>
        <span class="command-item-label">${escapeHtml(entry.label)}</span>
      `;
      button.addEventListener(
        "click",
        () => {
          this.commandMenuSelectedId = entry.id;
          this.commandMenuActiveCategoryId = entry.categoryId;
          this.renderCommandMenu();
          this.commandMenuOnSelect?.(entry.id);
        },
        { signal: this.commandMenuAbort?.signal }
      );
      list.appendChild(button);
      this.toolSlotEls.push(button);
    }

    root.append(primary, categories, list);
  }

  public setupCommandMenu(
    onSelect: (commandId: string) => void,
    initialCommandId: string,
    initialCategoryId?: string
  ): AbortController {
    this.teardownCommandMenu();
    const abort = new AbortController();
    this.commandMenuAbort = abort;
    this.commandMenuOnSelect = onSelect;
    const initialEntry =
      getCommandMenuCommand(initialCommandId as CommandMenuCommandId) ??
      getCommandMenuCommand(defaultCommandMenuCommandId())!;
    this.commandMenuSelectedId = initialEntry.id;
    this.commandMenuActiveCategoryId =
      initialCategoryId && COMMAND_MENU_CATEGORIES.some((category) => category.id === initialCategoryId)
        ? initialCategoryId
        : initialEntry.categoryId;
    this.commandMenuOpen = true;
    this.renderCommandMenu();
    return abort;
  }

  public syncCommandMenuSelection(commandId: string): void {
    const entry = getCommandMenuCommand(commandId as CommandMenuCommandId);
    if (!entry) return;
    this.commandMenuSelectedId = entry.id;
    this.commandMenuActiveCategoryId = entry.categoryId;
    this.renderCommandMenu();
  }

  public teardownCommandMenu(): void {
    this.commandMenuAbort?.abort();
    this.commandMenuAbort = null;
    this.commandMenuOnSelect = null;
    this.commandMenuSelectedId = null;
    this.commandMenuActiveCategoryId = null;
    this.toolSlotEls = [];
    this.commandCategoryEls = [];
    if (this.toolBarRoot) this.toolBarRoot.replaceChildren();
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
    workItems?: ReadonlyMap<string, WorkItemSnapshot>
  ): void {
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

    const behaviorZh = pawnDetailBehaviorLabelZh(pawn, workItems);
    const goal = pawn.currentGoal?.kind ?? "—";
    const action = pawn.currentAction?.kind ?? "—";
    const n = pawn.needs;
    const needSig = needSignalsFromNeeds({
      ...n,
      satiety: pawn.satiety,
      energy: pawn.energy
    });

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
        <div class="pawn-detail-label">当前行为</div>
        <div class="pawn-detail-behavior">${escapeHtml(behaviorZh)}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">当前状态</div>
        <div>饥饿 ${n.hunger.toFixed(1)}　休息 ${n.rest.toFixed(1)}　娱乐 ${n.recreation.toFixed(1)}</div>
        <div style="font-size:11px;color:#c4b8a4;margin-top:4px">需求信号 ${escapeHtml(needSig.summaryLine)}</div>
        <div style="font-size:11px;color:#a89878;margin-top:2px">饥饿 ${escapeHtml(
      needSig.hungerUrgency
    )} · 疲劳 ${escapeHtml(needSig.restUrgency)} · 打断许可 饥${needSig.allowInterruptWorkForHunger ? "是" : "否"}
        / 休${needSig.allowInterruptWorkForRest ? "是" : "否"}</div>
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
    this.teardownPawnRoster();
    this.teardownPawnDetail();
    this.teardownYamlScenarioPanel();
    this.teardownDebugPanel();
    this.variantSelectAbort?.abort();
    this.variantSelectAbort = null;
  }
}
