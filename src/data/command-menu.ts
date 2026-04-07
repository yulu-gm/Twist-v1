import type { DomainVerb } from "../game/contracts/domain-command-types";
import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES } from "./villager-tools";

/**
 * 命令菜单分组与 `oh-gen-doc/UI系统.yaml`「主菜单结构」、`oh-gen-doc/交互系统.yaml`「菜单选择 → 菜单层级」对齐：
 * - `zones`（区域）：策划「区域 → 存储区 → 新建」——本条命令为进入存储区创建模式。
 * - `building`（建造）：策划「建造 → 墙 → 木墙」——`layout: "grouped"`，中间「墙」为 {@link CommandMenuSubgroupDefinition}，下挂 `build-wall`（木墙）。
 * - `furniture`（家具）：与策划「家具 → 木床」一致。
 * - `tools`（工具）：对应策划「工具栏/交互组件」中的选区类工具（伐木、物资拾取标记等），非主菜单三本柱，但与热键栏一致。
 */
export type CommandMenuCategoryId = "zones" | "building" | "furniture" | "tools";

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
  readonly domainVerb: DomainVerb;
  /** 任务标记叠加层用 id（与 {@link task-markers} / 可接单格过滤一致）。 */
  readonly markerToolId: string;
}

/** 中间分组（如「墙」），与策划三级菜单「建造 → 墙 → 木墙」一致。 */
export interface CommandMenuSubgroupDefinition {
  readonly id: string;
  readonly label: string;
  readonly commands: readonly CommandMenuCommandDefinition[];
}

/** 扁平分类：一级分类下直接挂命令。 */
export type CommandMenuCategoryDefinitionFlat = Readonly<{
  readonly id: CommandMenuCategoryId;
  readonly label: string;
  readonly layout: "flat";
  readonly commands: readonly CommandMenuCommandDefinition[];
}>;

/** 分组分类：一级分类下含若干中间组，每组下挂命令。 */
export type CommandMenuCategoryDefinitionGrouped = Readonly<{
  readonly id: CommandMenuCategoryId;
  readonly label: string;
  readonly layout: "grouped";
  readonly subgroups: readonly CommandMenuSubgroupDefinition[];
}>;

export type CommandMenuCategoryDefinition = CommandMenuCategoryDefinitionFlat | CommandMenuCategoryDefinitionGrouped;

const TOOL_COMMANDS = [
  {
    id: "mine",
    categoryId: "tools",
    label: "开采",
    inputShape: "rect-selection",
    modeKey: "mine",
    domainVerb: "assign_tool_task:mine",
    markerToolId: "mine"
  },
  {
    id: "demolish",
    categoryId: "tools",
    label: "拆除",
    inputShape: "rect-selection",
    modeKey: "demolish",
    domainVerb: "assign_tool_task:demolish",
    markerToolId: "demolish"
  },
  {
    id: "mow",
    categoryId: "tools",
    label: "割草",
    inputShape: "rect-selection",
    modeKey: "mow",
    domainVerb: "assign_tool_task:mow",
    markerToolId: "mow"
  },
  {
    id: "lumber",
    categoryId: "tools",
    label: "伐木",
    inputShape: "rect-selection",
    modeKey: "lumber",
    domainVerb: "assign_tool_task:lumber",
    markerToolId: "lumber"
  },
  {
    id: "farm",
    categoryId: "tools",
    label: "耕种",
    inputShape: "rect-selection",
    modeKey: "farm",
    domainVerb: "assign_tool_task:farm",
    markerToolId: "farm"
  },
  {
    id: "haul",
    categoryId: "tools",
    label: "物资拾取标记",
    inputShape: "rect-selection",
    modeKey: "haul",
    domainVerb: "assign_tool_task:haul",
    markerToolId: "haul"
  },
  {
    id: "patrol",
    categoryId: "tools",
    label: "巡逻",
    inputShape: "rect-selection",
    modeKey: "patrol",
    domainVerb: "assign_tool_task:patrol",
    markerToolId: "patrol"
  },
  {
    id: "idle",
    categoryId: "tools",
    label: "待机",
    inputShape: "rect-selection",
    modeKey: "idle",
    domainVerb: "clear_task_markers",
    markerToolId: "idle"
  }
] as const satisfies readonly CommandMenuCommandDefinition[];

const BUILDING_COMMANDS = [
  {
    id: "build-wall",
    categoryId: "building",
    label: "木墙",
    inputShape: "brush-stroke",
    modeKey: "build-wall",
    domainVerb: "build_wall_blueprint",
    markerToolId: "build"
  }
] as const satisfies readonly CommandMenuCommandDefinition[];

const ZONE_COMMANDS = [
  {
    id: "storage-zone",
    categoryId: "zones",
    label: "存储区",
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

const BUILDING_SUBGROUPS = [
  {
    id: "walls",
    label: "墙",
    commands: BUILDING_COMMANDS
  }
] as const satisfies readonly CommandMenuSubgroupDefinition[];

export const COMMAND_MENU_CATEGORIES = [
  {
    id: "zones",
    label: "区域",
    layout: "flat",
    commands: ZONE_COMMANDS
  },
  {
    id: "building",
    label: "建造",
    layout: "grouped",
    subgroups: BUILDING_SUBGROUPS
  },
  {
    id: "furniture",
    label: "家具",
    layout: "flat",
    commands: FURNITURE_COMMANDS
  },
  {
    id: "tools",
    label: "工具",
    layout: "flat",
    commands: TOOL_COMMANDS
  }
] as const satisfies readonly CommandMenuCategoryDefinition[];

export type CommandMenuCategory = (typeof COMMAND_MENU_CATEGORIES)[number];
export type CommandMenuCommand =
  | (typeof TOOL_COMMANDS)[number]
  | (typeof BUILDING_COMMANDS)[number]
  | (typeof ZONE_COMMANDS)[number]
  | (typeof FURNITURE_COMMANDS)[number];

function flatCommandsInCategory(category: CommandMenuCategory): readonly CommandMenuCommand[] {
  if (category.layout === "flat") return category.commands;
  return category.subgroups.flatMap((sub) => [...sub.commands]);
}

const CATEGORY_BY_ID = new Map<CommandMenuCategoryId, CommandMenuCategory>();
const COMMAND_BY_ID = new Map<CommandMenuCommandId, CommandMenuCommand>();
/** `modeKey` 与交互模式注册表中的 `modeId` 对齐，一对一。 */
const COMMAND_BY_MODE_KEY = new Map<string, CommandMenuCommand>();

for (const category of COMMAND_MENU_CATEGORIES) {
  CATEGORY_BY_ID.set(category.id, category);
  for (const command of flatCommandsInCategory(category)) {
    COMMAND_BY_ID.set(command.id, command);
    COMMAND_BY_MODE_KEY.set(command.modeKey, command);
  }
}

export function getCommandMenuCategory(categoryId: CommandMenuCategoryId): CommandMenuCategory | undefined {
  return CATEGORY_BY_ID.get(categoryId);
}

export function getCommandMenuCommand(commandId: CommandMenuCommandId): CommandMenuCommand | undefined {
  return COMMAND_BY_ID.get(commandId);
}

export function getCommandMenuCommandByModeKey(modeKey: string): CommandMenuCommand | undefined {
  return COMMAND_BY_MODE_KEY.get(modeKey);
}

export function commandMenuCommandsForCategory(categoryId: CommandMenuCategoryId): readonly CommandMenuCommand[] {
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) return [];
  return [...flatCommandsInCategory(category)];
}

/** 供 HUD 渲染：含中间组标题行（如「墙」）与命令行，顺序一致。 */
export type CommandMenuListRow =
  | Readonly<{ kind: "subgroup-heading"; label: string }>
  | Readonly<{ kind: "command"; command: CommandMenuCommand }>;

export function commandMenuListRowsForCategory(categoryId: CommandMenuCategoryId): readonly CommandMenuListRow[] {
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) return [];
  if (category.layout === "flat") {
    return category.commands.map((command) => ({ kind: "command" as const, command }));
  }
  const rows: CommandMenuListRow[] = [];
  for (const sub of category.subgroups) {
    rows.push({ kind: "subgroup-heading", label: sub.label });
    for (const command of sub.commands) {
      rows.push({ kind: "command", command });
    }
  }
  return rows;
}

export function defaultCommandMenuCategoryId(): CommandMenuCategoryId {
  return COMMAND_MENU_CATEGORIES[0]!.id;
}

export function defaultCommandMenuCommandId(): CommandMenuCommandId {
  const first = COMMAND_MENU_CATEGORIES[0]!;
  return flatCommandsInCategory(first)[0]!.id;
}

/**
 * 与 {@link VILLAGER_TOOL_KEY_CODES}（Q W E R T Y U I O P）一一对应：第 5 槽为「木墙」笔刷，第 10 槽为存储区。
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
  domainVerb: DomainVerb;
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
