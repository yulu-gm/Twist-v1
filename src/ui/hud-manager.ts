/**
 * hud-manager：封装所有对 DOM 的直接操作。
 * GameScene 通过此类的语义化方法更新 HUD，不再持有 DOM 引用。
 */

import type { PawnState } from "../game/pawn-state";
import type { TimeControlState, TimeOfDayPalette, TimeSpeed } from "../game/time-of-day";
import { formatTimeOfDayLabel, type TimeOfDayState } from "../game/time-of-day";
import { pawnProfileForId } from "../data/pawn-profiles";
import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES, type VillagerTool } from "../data/villager-tools";
import { needSignalsFromNeeds } from "../player/need-signals";
import type { PlayerAcceptanceScenario } from "../data/player-acceptance-scenarios";

export type { VillagerTool };
export { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES };

/** 时间控制回调，由 GameScene 提供。 */
export type TimeControlCallbacks = Readonly<{
  onTogglePause: () => void;
  onSetSpeed: (speed: TimeSpeed) => void;
}>;

/** 工具选中回调。 */
export type ToolSelectCallback = (index: number) => void;

/** Pawn 选中回调。 */
export type PawnSelectCallback = (pawnId: string | null) => void;

/** 右下角 B 线验收切换与回放（切换时应重启场景）。 */
export type BAcceptanceCallbacks = Readonly<{
  onScenarioChange: (scenarioId: string) => void;
  onReplay: () => void;
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

  // B 线：交互模式提示 + mock 契约脚注
  private playerChannelModeEl: HTMLElement | null;
  private playerChannelResultEl: HTMLElement | null;
  private playerChannelContractEl: HTMLElement | null;

  // 工具栏
  private toolBarRoot: HTMLElement | null;
  private toolSlotEls: HTMLElement[] = [];
  private toolUiAbort: AbortController | null = null;

  // Pawn 名册 + 详情
  private rosterRoot: HTMLElement | null;
  private pawnDetailEl: HTMLElement | null;
  private pawnRosterSlotEls: HTMLElement[] = [];
  private pawnRosterAbort: AbortController | null = null;

  private variantSelectAbort: AbortController | null = null;
  private bAcceptanceAbort: AbortController | null = null;

  private bAcceptanceDetailEl: HTMLElement | null;
  private bAcceptanceSelectEl: HTMLSelectElement | null;
  private bAcceptanceGoalEl: HTMLElement | null;
  private bAcceptanceStepsEl: HTMLOListElement | null;
  private bAcceptanceReplayBtn: HTMLButtonElement | null;

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
    this.bAcceptanceDetailEl = document.getElementById("b-acceptance-detail");
    this.bAcceptanceSelectEl = document.getElementById(
      "b-acceptance-scenario-select"
    ) as HTMLSelectElement | null;
    this.bAcceptanceGoalEl = document.getElementById("b-acceptance-scenario-goal");
    this.bAcceptanceStepsEl = document.getElementById("b-acceptance-scenario-steps") as HTMLOListElement | null;
    this.bAcceptanceReplayBtn = document.getElementById(
      "b-acceptance-replay-commands"
    ) as HTMLButtonElement | null;
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

  // ── B 线：玩家通道提示（模式文案 + mock 网关反馈）────────────────

  public syncPlayerChannelHint(modeLine: string, contractFootnote: string): void {
    if (this.playerChannelModeEl && this.playerChannelModeEl.textContent !== modeLine) {
      this.playerChannelModeEl.textContent = modeLine;
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

  // ── 右下角：B 线验收（与测试场景独立）──────────────────────

  public setupBAcceptancePanel(
    scenarios: readonly PlayerAcceptanceScenario[],
    currentScenarioId: string,
    callbacks: BAcceptanceCallbacks
  ): AbortController {
    this.teardownBAcceptancePanel();
    const abort = new AbortController();
    this.bAcceptanceAbort = abort;
    const { signal } = abort;

    const sel = this.bAcceptanceSelectEl;
    if (sel) {
      sel.replaceChildren();
      for (const s of scenarios) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.title;
        sel.appendChild(opt);
      }
      sel.value = scenarios.some((s) => s.id === currentScenarioId)
        ? currentScenarioId
        : scenarios[0]!.id;
      sel.addEventListener("change", () => callbacks.onScenarioChange(sel.value), { signal });
    }

    this.bAcceptanceReplayBtn?.addEventListener("click", () => callbacks.onReplay(), { signal });
    return abort;
  }

  public syncBAcceptancePanel(scenario: PlayerAcceptanceScenario): void {
    const detail = this.bAcceptanceDetailEl;
    if (detail) {
      detail.hidden = scenario.id === "off";
    }
    if (this.bAcceptanceGoalEl) {
      this.bAcceptanceGoalEl.textContent = scenario.goal;
    }
    const list = this.bAcceptanceStepsEl;
    if (list) {
      list.replaceChildren();
      for (const step of scenario.steps) {
        const li = document.createElement("li");
        li.textContent = step;
        list.appendChild(li);
      }
    }
    const replay = this.bAcceptanceReplayBtn;
    if (replay) {
      replay.style.display = scenario.showReplayButton ? "block" : "none";
    }
  }

  public teardownBAcceptancePanel(): void {
    this.bAcceptanceAbort?.abort();
    this.bAcceptanceAbort = null;
  }

  // ── 工具栏 ────────────────────────────────────────────────

  public setupToolBar(
    onSelect: ToolSelectCallback,
    initialIndex: number
  ): AbortController {
    this.teardownToolBar();
    const abort = new AbortController();
    const { signal } = abort;
    this.toolUiAbort = abort;

    if (this.toolBarRoot) {
      for (let i = 0; i < VILLAGER_TOOLS.length; i++) {
        const tool = VILLAGER_TOOLS[i]!;
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "tool-slot";
        slot.dataset.toolId = tool.id;
        slot.title = `${tool.hint}（${tool.hotkey}）`;
        slot.setAttribute("aria-label", `${tool.label}，快捷键 ${tool.hotkey}`);
        slot.innerHTML = `<span class="tool-key">${tool.hotkey}</span><div class="tool-label">${tool.label}</div>`;
        slot.addEventListener("click", () => onSelect(i), { signal });
        this.toolBarRoot.appendChild(slot);
        this.toolSlotEls.push(slot);
      }
    }

    this.syncToolBarSelection(initialIndex);
    return abort;
  }

  public syncToolBarSelection(index: number): void {
    for (let i = 0; i < this.toolSlotEls.length; i++) {
      const el = this.toolSlotEls[i]!;
      const on = i === index;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  public teardownToolBar(): void {
    this.toolUiAbort?.abort();
    this.toolUiAbort = null;
    this.toolSlotEls = [];
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
    const needSig = needSignalsFromNeeds(n);

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
        <div style="font-size:11px;color:#c4b8a4;margin-top:4px">需求信号（B-M2 桩）${escapeHtml(needSig.summaryLine)}</div>
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
    this.teardownToolBar();
    this.teardownPawnRoster();
    this.teardownPawnDetail();
    this.teardownBAcceptancePanel();
    this.variantSelectAbort?.abort();
    this.variantSelectAbort = null;
  }
}
