/**
 * 扁平菜单读模型：与工具栏 / 交互模式动作对齐，无 DOM。
 */

/** 与小人工具栏 id（如 villager-tools）或交互模式键对齐的语义化动作。 */
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
