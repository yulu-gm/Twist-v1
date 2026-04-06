/**
 * 扁平菜单读模型：与工具栏 / 交互模式动作对齐，无 DOM。
 */

import type { VillagerBuildSubId } from "../data/villager-tools";

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

// ── Story-1：建造子菜单 → 活跃交互态（供 floor / 测试对齐 inputShape + verb）────────

export type ActiveBuildToolState = Readonly<{
  inputShape: "brush-stroke" | "single-cell";
  verb: "build_wall_blueprint" | "place_furniture:bed";
}>;

/** 未选择子项时不视为已进入具体建造模式。 */
export function activeBuildToolState(
  buildSub: VillagerBuildSubId | null
): ActiveBuildToolState | null {
  if (buildSub === "wall") {
    return { inputShape: "brush-stroke", verb: "build_wall_blueprint" };
  }
  if (buildSub === "bed") {
    return { inputShape: "single-cell", verb: "place_furniture:bed" };
  }
  return null;
}
