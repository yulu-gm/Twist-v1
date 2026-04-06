/**
 * Pure menu-state model：三层命令菜单状态与读模型辅助函数。
 */

import {
  commandMenuCommandsForCategory,
  commandMenuDomainSemantics,
  commandMenuHotkeyLabel,
  defaultCommandMenuCategoryId,
  defaultCommandMenuCommandId,
  getCommandMenuCommand,
  type CommandMenuCategoryId,
  type CommandMenuCommandId,
  type CommandMenuDomainSemantics,
  type CommandMenuInputShape
} from "../data/command-menu";

/** 旧版扁平菜单动作（少量组件测试仍引用）。 */
export type MenuItemAction =
  | string
  | Readonly<{ kind: "villager-tool"; toolId: string }>
  | Readonly<{ kind: "interaction-mode"; modeKey: string }>;

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly enabled: boolean;
  readonly action: MenuItemAction;
}

export interface MenuState {
  readonly items: readonly MenuItem[];
  readonly selectedId: string | null;
  readonly visible: boolean;
}

export function createMenuState(items: readonly MenuItem[]): MenuState {
  return {
    items,
    selectedId: items.length > 0 ? items[0]!.id : null,
    visible: false
  };
}

export function selectMenuItem(state: MenuState, itemId: string): MenuState {
  if (!state.items.some((i) => i.id === itemId)) {
    return { ...state };
  }
  return { ...state, selectedId: itemId };
}

export function toggleMenuVisibility(state: MenuState): MenuState {
  return { ...state, visible: !state.visible };
}

export interface CommandMenuState {
  readonly isOpen: boolean;
  readonly activeCategoryId: CommandMenuCategoryId;
  readonly activeCommandId: CommandMenuCommandId;
}

export type CommandMenuInteractionSemantics = Readonly<{
  readonly inputShape: CommandMenuInputShape;
  readonly modeKey: string;
  readonly markerToolId: string;
  readonly hotkeyLabel: string;
}>;

function resolveCategoryForCommand(commandId: CommandMenuCommandId): CommandMenuCategoryId {
  const command = getCommandMenuCommand(commandId);
  if (command) return command.categoryId;
  return defaultCommandMenuCategoryId();
}

function resolveCommandInCategory(categoryId: CommandMenuCategoryId): CommandMenuCommandId {
  return commandMenuCommandsForCategory(categoryId)[0]?.id ?? defaultCommandMenuCommandId();
}

export function createCommandMenuState(overrides: Partial<CommandMenuState> = {}): CommandMenuState {
  const activeCommandId =
    overrides.activeCommandId ??
    resolveCommandInCategory(overrides.activeCategoryId ?? defaultCommandMenuCategoryId());
  const activeCategoryId = overrides.activeCategoryId ?? resolveCategoryForCommand(activeCommandId);

  return {
    isOpen: overrides.isOpen ?? false,
    activeCategoryId,
    activeCommandId
  };
}

export function setCommandMenuOpen(state: CommandMenuState, isOpen: boolean): CommandMenuState {
  return { ...state, isOpen };
}

export function toggleCommandMenuOpen(state: CommandMenuState): CommandMenuState {
  return { ...state, isOpen: !state.isOpen };
}

export function setCommandMenuCategory(
  state: CommandMenuState,
  activeCategoryId: CommandMenuCategoryId
): CommandMenuState {
  return { ...state, activeCategoryId };
}

export function selectCommandMenuCommand(
  state: CommandMenuState,
  activeCommandId: CommandMenuCommandId
): CommandMenuState {
  return {
    ...state,
    activeCommandId,
    activeCategoryId: resolveCategoryForCommand(activeCommandId)
  };
}

export function visibleCommandsForCommandMenuState(state: CommandMenuState) {
  return commandMenuCommandsForCategory(state.activeCategoryId);
}

export function activeCommandForCommandMenuState(state: CommandMenuState) {
  return getCommandMenuCommand(state.activeCommandId) ?? getCommandMenuCommand(defaultCommandMenuCommandId())!;
}

export function commandInteractionSemantics(commandId: CommandMenuCommandId): CommandMenuInteractionSemantics {
  const command = getCommandMenuCommand(commandId) ?? getCommandMenuCommand(defaultCommandMenuCommandId())!;
  return {
    inputShape: command.inputShape,
    modeKey: command.modeKey,
    markerToolId: command.markerToolId,
    hotkeyLabel: commandMenuHotkeyLabel(command.id)
  };
}

export function activeCommandInteractionSemantics(state: CommandMenuState): CommandMenuInteractionSemantics {
  return commandInteractionSemantics(state.activeCommandId);
}

export function activeCommandDomainSemantics(state: CommandMenuState): CommandMenuDomainSemantics {
  return commandMenuDomainSemantics(state.activeCommandId);
}
