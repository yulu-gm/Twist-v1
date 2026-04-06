import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES } from "./villager-tools";

export type CommandMenuCategoryId = "orders" | "structures" | "furniture";

export type CommandMenuCommandId =
  | "mine"
  | "demolish"
  | "mow"
  | "lumber"
  | "farm"
  | "haul"
  | "patrol"
  | "idle"
  | "build-wall"
  | "storage-zone"
  | "place-bed";

export type CommandMenuInputShape = "rect-selection" | "brush-stroke" | "single-cell";

export interface CommandMenuCommandDefinition {
  readonly id: CommandMenuCommandId;
  readonly categoryId: CommandMenuCategoryId;
  readonly label: string;
  readonly inputShape: CommandMenuInputShape;
  readonly modeKey: string;
  /** 领域命令 `verb` 字段的完整字符串。 */
  readonly domainVerb: string;
  /** 任务标记叠加层用 id（与 {@link task-markers} / 可接单格过滤一致）。 */
  readonly markerToolId: string;
}

export interface CommandMenuCategoryDefinition {
  readonly id: CommandMenuCategoryId;
  readonly label: string;
  readonly commands: readonly CommandMenuCommandDefinition[];
}

const ORDER_COMMANDS = [
  {
    id: "mine",
    categoryId: "orders",
    label: "开采",
    inputShape: "rect-selection",
    modeKey: "mine",
    domainVerb: "assign_tool_task:mine",
    markerToolId: "mine"
  },
  {
    id: "demolish",
    categoryId: "orders",
    label: "拆除",
    inputShape: "rect-selection",
    modeKey: "demolish",
    domainVerb: "assign_tool_task:demolish",
    markerToolId: "demolish"
  },
  {
    id: "mow",
    categoryId: "orders",
    label: "割草",
    inputShape: "rect-selection",
    modeKey: "mow",
    domainVerb: "assign_tool_task:mow",
    markerToolId: "mow"
  },
  {
    id: "lumber",
    categoryId: "orders",
    label: "伐木",
    inputShape: "rect-selection",
    modeKey: "lumber",
    domainVerb: "assign_tool_task:lumber",
    markerToolId: "lumber"
  },
  {
    id: "farm",
    categoryId: "orders",
    label: "耕种",
    inputShape: "rect-selection",
    modeKey: "farm",
    domainVerb: "assign_tool_task:farm",
    markerToolId: "farm"
  },
  {
    id: "haul",
    categoryId: "orders",
    label: "搬运",
    inputShape: "rect-selection",
    modeKey: "haul",
    domainVerb: "assign_tool_task:haul",
    markerToolId: "haul"
  },
  {
    id: "patrol",
    categoryId: "orders",
    label: "巡逻",
    inputShape: "rect-selection",
    modeKey: "patrol",
    domainVerb: "assign_tool_task:patrol",
    markerToolId: "patrol"
  },
  {
    id: "idle",
    categoryId: "orders",
    label: "待机",
    inputShape: "rect-selection",
    modeKey: "idle",
    domainVerb: "clear_task_markers",
    markerToolId: "idle"
  }
] as const satisfies readonly CommandMenuCommandDefinition[];

const STRUCTURE_COMMANDS = [
  {
    id: "build-wall",
    categoryId: "structures",
    label: "木墙",
    inputShape: "brush-stroke",
    modeKey: "build-wall",
    domainVerb: "build_wall_blueprint",
    markerToolId: "build"
  },
  {
    id: "storage-zone",
    categoryId: "structures",
    label: "储存区",
    inputShape: "rect-selection",
    modeKey: "zone-create",
    domainVerb: "zone_create",
    markerToolId: "zone_create"
  }
] as const satisfies readonly CommandMenuCommandDefinition[];

const FURNITURE_COMMANDS = [
  {
    id: "place-bed",
    categoryId: "furniture",
    label: "木床",
    inputShape: "single-cell",
    modeKey: "build-bed",
    domainVerb: "place_furniture:bed",
    markerToolId: "build"
  }
] as const satisfies readonly CommandMenuCommandDefinition[];

export const COMMAND_MENU_CATEGORIES = [
  {
    id: "orders",
    label: "指令",
    commands: ORDER_COMMANDS
  },
  {
    id: "structures",
    label: "结构",
    commands: STRUCTURE_COMMANDS
  },
  {
    id: "furniture",
    label: "家具",
    commands: FURNITURE_COMMANDS
  }
] as const satisfies readonly CommandMenuCategoryDefinition[];

export type CommandMenuCategory = (typeof COMMAND_MENU_CATEGORIES)[number];
export type CommandMenuCommand = CommandMenuCategory["commands"][number];

const CATEGORY_BY_ID = new Map<CommandMenuCategoryId, CommandMenuCategory>();
const COMMAND_BY_ID = new Map<CommandMenuCommandId, CommandMenuCommand>();

for (const category of COMMAND_MENU_CATEGORIES) {
  CATEGORY_BY_ID.set(category.id, category);
  for (const command of category.commands) {
    COMMAND_BY_ID.set(command.id, command);
  }
}

export function getCommandMenuCategory(categoryId: CommandMenuCategoryId): CommandMenuCategory | undefined {
  return CATEGORY_BY_ID.get(categoryId);
}

export function getCommandMenuCommand(commandId: CommandMenuCommandId): CommandMenuCommand | undefined {
  return COMMAND_BY_ID.get(commandId);
}

export function commandMenuCommandsForCategory(categoryId: CommandMenuCategoryId): readonly CommandMenuCommand[] {
  return CATEGORY_BY_ID.get(categoryId)?.commands ?? [];
}

export function defaultCommandMenuCategoryId(): CommandMenuCategoryId {
  return COMMAND_MENU_CATEGORIES[0]!.id;
}

export function defaultCommandMenuCommandId(): CommandMenuCommandId {
  return COMMAND_MENU_CATEGORIES[0]!.commands[0]!.id;
}

/**
 * 与 {@link VILLAGER_TOOL_KEY_CODES}（Q W E R T Y U I O P）一一对应：第 5 槽为「木墙」笔刷，第 10 槽为储存区。
 */
export const COMMAND_MENU_HOTKEY_COMMAND_IDS: readonly CommandMenuCommandId[] = [
  "mine",
  "demolish",
  "mow",
  "lumber",
  "build-wall",
  "farm",
  "haul",
  "patrol",
  "idle",
  "storage-zone"
];

if (COMMAND_MENU_HOTKEY_COMMAND_IDS.length !== VILLAGER_TOOL_KEY_CODES.length) {
  throw new Error(
    `COMMAND_MENU_HOTKEY_COMMAND_IDS (${COMMAND_MENU_HOTKEY_COMMAND_IDS.length}) must match VILLAGER_TOOL_KEY_CODES (${VILLAGER_TOOL_KEY_CODES.length})`
  );
}

export function commandIdForHotkeyIndex(index: number): CommandMenuCommandId | null {
  const id = COMMAND_MENU_HOTKEY_COMMAND_IDS[index];
  return id ?? null;
}

/** 与 {@link COMMAND_MENU_HOTKEY_COMMAND_IDS} 槽位一致的热键字母；无快捷键的命令返回空串。 */
export function commandMenuHotkeyLabel(commandId: CommandMenuCommandId): string {
  const idx = COMMAND_MENU_HOTKEY_COMMAND_IDS.indexOf(commandId);
  if (idx < 0) return "";
  return VILLAGER_TOOLS[idx]?.hotkey ?? "";
}

export type CommandMenuDomainSemantics = Readonly<{
  commandId: CommandMenuCommandId;
  categoryId: CommandMenuCategoryId;
  domainVerb: string;
  markerToolId: string;
  inputShape: CommandMenuInputShape;
  modeKey: string;
}>;

export function commandMenuDomainSemantics(commandId: CommandMenuCommandId): CommandMenuDomainSemantics {
  const c = getCommandMenuCommand(commandId) ?? getCommandMenuCommand(defaultCommandMenuCommandId())!;
  return {
    commandId: c.id,
    categoryId: c.categoryId,
    domainVerb: c.domainVerb,
    markerToolId: c.markerToolId,
    inputShape: c.inputShape,
    modeKey: c.modeKey
  };
}
