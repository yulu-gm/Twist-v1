export type CommandMenuLeafId =
  | "zone.storage.create"
  | "order.mine"
  | "order.lumber"
  | "order.haul"
  | "build.wall.wood"
  | "build.furniture.bed"
  | "idle";

export type MainMenuState = Readonly<{
  expandedRootId: string | null;
  expandedSecondId: string | null;
}>;

export type ToolbarState = Readonly<{
  toolGroupId: string | null;
  selectedToolId: CommandMenuLeafId | null;
}>;

export type ToolItem = Readonly<{
  id: CommandMenuLeafId;
  label: string;
  modeHint: string;
  hotkey?: string;
}>;

export type ToolGroup = Readonly<{
  id: string;
  tools: readonly ToolItem[];
}>;

export type CommandMenuSecond = Readonly<{
  id: string;
  label: string;
  toolGroupId: string;
}>;

export type CommandMenuRoot = Readonly<{
  id: string;
  label: string;
  seconds: readonly CommandMenuSecond[];
}>;

export const TOOL_GROUPS: readonly ToolGroup[] = [
  {
    id: "group.order",
    tools: [
      { id: "order.mine", label: "开采", modeHint: "正在标记开采目标，请框选地图", hotkey: "Q" },
      { id: "order.lumber", label: "伐木", modeHint: "正在标记伐木目标，请框选地图", hotkey: "W" },
      { id: "order.haul", label: "拾取", modeHint: "正在标记可拾取物资，请框选地图", hotkey: "E" },
      { id: "idle", label: "待机", modeHint: "", hotkey: "O" }
    ]
  },
  {
    id: "group.build",
    tools: [
      { id: "build.wall.wood", label: "木墙", modeHint: "木墙蓝图：悬停选择可建造格子", hotkey: "Q" },
      { id: "build.furniture.bed", label: "木床", modeHint: "木床放置：悬停选择放置格", hotkey: "W" },
      { id: "idle", label: "待机", modeHint: "", hotkey: "O" }
    ]
  },
  {
    id: "group.zone",
    tools: [
      { id: "zone.storage.create", label: "新建", modeHint: "正在创建存储区，请框选地图", hotkey: "Q" },
      { id: "idle", label: "待机", modeHint: "", hotkey: "O" }
    ]
  },
  {
    id: "group.default",
    tools: [
      { id: "idle", label: "待机", modeHint: "", hotkey: "O" }
    ]
  }
] as const;

export const DEFAULT_COMMAND_MENU: readonly CommandMenuRoot[] = [
  {
    id: "root.commands",
    label: "指令",
    seconds: [
      {
        id: "commands.order",
        label: "命令",
        toolGroupId: "group.order"
      },
      {
        id: "commands.build",
        label: "建造",
        toolGroupId: "group.build"
      },
      {
        id: "commands.zone",
        label: "区域",
        toolGroupId: "group.zone"
      }
    ]
  }
] as const;

export function modeHintForCommandLeaf(id: CommandMenuLeafId): string {
  for (const group of TOOL_GROUPS) {
    const hit = group.tools.find((t) => t.id === id);
    if (hit) return hit.modeHint;
  }
  return "";
}

export function createDefaultMainMenuState(): MainMenuState {
  return {
    expandedRootId: null,
    expandedSecondId: null
  };
}

export function createDefaultToolbarState(): ToolbarState {
  return {
    toolGroupId: "group.default",
    selectedToolId: "idle"
  };
}

