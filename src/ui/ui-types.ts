/**
 * UI 核心状态与读模型的类型骨架（无 Phaser、无 DOM）。
 * 与 oh-code-design/UI系统 分层概念及 hud-manager / GameScene 的编排范围对齐。
 */

import type { TimeSpeed } from "../game/time";

/** 菜单项绑定的交互模式键（实现层映射到交互/玩家通道）。 */
export type UiInteractionModeKey = string;

/** 扁平菜单项（建造/区域等菜单树的可扩展占位）。 */
export interface UiMenuItemRef {
  readonly id: string;
  readonly label: string;
  readonly modeKey: UiInteractionModeKey;
}

export interface UiMenuGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly UiMenuItemRef[];
}

export interface UiMenuTree {
  readonly groups: readonly UiMenuGroup[];
}

/** 当前展开的菜单焦点（路径式，避免与具体 widget 耦合）。 */
export interface UiMenuFocus {
  readonly expandedGroupId: string | null;
  readonly activeItemId: string | null;
}

/** 工具栏选中态（与 villager 工具槽索引一致）。 */
export interface ToolbarUiState {
  readonly selectedToolIndex: number;
}

/** 格悬停文案（hover HUD）。 */
export interface HoverGridUiState {
  readonly visible: boolean;
  readonly text: string;
}

/** 玩家通道：模式行、契约脚注、最近网关反馈。 */
export interface PlayerChannelUiState {
  readonly modeLine: string;
  readonly contractFootnote: string;
  readonly lastResultLine: string | null;
}

/** 时间控制条读模型（与 TimeControlState 对齐的子集）。 */
export interface TimeHudUiState {
  readonly paused: boolean;
  readonly speed: TimeSpeed;
}

/** Pawn 名册当前选中。 */
export interface PawnRosterUiState {
  readonly selectedPawnId: string | null;
}

/** B 线验收面板可见性与当前场景。 */
export interface BAcceptanceUiState {
  readonly currentScenarioId: string;
  readonly detailVisible: boolean;
}

/** 地图叠加反馈单项（选区、标记、进度等占位）。 */
export type MapFeedbackKind = string;

export interface MapOverlayFeedbackItem {
  readonly kind: MapFeedbackKind;
  /** 逻辑锚点（如格键），由渲染层解释。 */
  readonly anchorKey: string;
  readonly styleKey: string;
  readonly expiresAtTick: number | null;
}

/**
 * 场景 HUD 只读快照骨架：便于未来从领域读模型收敛到单一 view-model，
 * 而非运行时 store。
 */
export interface SceneHudViewModel {
  readonly menu: UiMenuFocus;
  readonly toolbar: ToolbarUiState;
  readonly hover: HoverGridUiState;
  readonly playerChannel: PlayerChannelUiState;
  readonly time: TimeHudUiState;
  readonly roster: PawnRosterUiState;
  readonly bAcceptance: BAcceptanceUiState;
  readonly mapFeedback: readonly MapOverlayFeedbackItem[];
}
