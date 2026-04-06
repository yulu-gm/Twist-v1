import type {
  CommandMenuCategoryId,
  CommandMenuCommandId,
  CommandMenuInputShape
} from "../data/command-menu";
import type { TimeSpeed } from "../game/time";

export type UiInteractionModeKey = string;

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

export interface UiMenuFocus {
  readonly expandedGroupId: string | null;
  readonly activeItemId: string | null;
}

export interface CommandMenuUiState {
  readonly isOpen: boolean;
  readonly activeCategoryId: CommandMenuCategoryId;
  readonly activeCommandId: CommandMenuCommandId;
}

export interface CommandMenuItemUiState {
  readonly id: CommandMenuCommandId;
  readonly label: string;
  readonly categoryId: CommandMenuCategoryId;
  readonly inputShape: CommandMenuInputShape;
  readonly markerToolId: string;
  readonly hotkeyLabel: string;
  readonly modeKey: UiInteractionModeKey;
}

export interface HoverGridUiState {
  readonly visible: boolean;
  readonly text: string;
}

export interface PlayerChannelUiState {
  readonly modeLine: string;
  readonly contractFootnote: string;
  readonly lastResultLine: string | null;
}

export interface TimeHudUiState {
  readonly paused: boolean;
  readonly speed: TimeSpeed;
}

export interface PawnRosterUiState {
  readonly selectedPawnId: string | null;
}

export interface BAcceptanceUiState {
  readonly currentScenarioId: string;
  readonly detailVisible: boolean;
}

export type MapFeedbackKind = string;

export interface MapOverlayFeedbackItem {
  readonly kind: MapFeedbackKind;
  readonly anchorKey: string;
  readonly styleKey: string;
  readonly expiresAtTick: number | null;
}

export interface SceneHudViewModel {
  readonly menu: UiMenuFocus;
  readonly commandMenu: CommandMenuUiState;
  readonly hover: HoverGridUiState;
  readonly playerChannel: PlayerChannelUiState;
  readonly time: TimeHudUiState;
  readonly roster: PawnRosterUiState;
  readonly bAcceptance: BAcceptanceUiState;
  readonly mapFeedback: readonly MapOverlayFeedbackItem[];
}
