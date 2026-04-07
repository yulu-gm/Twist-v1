/** 与命令菜单热键槽位对应的展示用条目（Q–O）；`id` 与任务标记用 toolId 对齐处仍含 `build`。 */

export type VillagerTool = Readonly<{
  id: string;
  hotkey: "Q" | "W" | "E" | "R" | "T" | "Y" | "U" | "I" | "O" | "P";
  label: string;
  hint: string;
}>;

export const VILLAGER_TOOLS: readonly VillagerTool[] = [
  { id: "mine", hotkey: "Q", label: "开采", hint: "指派开采矿物" },
  { id: "demolish", hotkey: "W", label: "拆除", hint: "拆除建筑或障碍" },
  { id: "mow", hotkey: "E", label: "割草", hint: "清理植被" },
  { id: "lumber", hotkey: "R", label: "伐木", hint: "砍伐树木" },
  { id: "build", hotkey: "T", label: "建造", hint: "木墙笔刷 / 木床放置（见命令菜单）" },
  { id: "farm", hotkey: "Y", label: "耕种", hint: "翻土与播种" },
  {
    id: "haul",
    hotkey: "U",
    label: "物资拾取标记",
    hint: "框选散落物资，标记为可拾取"
  },
  { id: "patrol", hotkey: "I", label: "巡逻", hint: "沿路线警戒" },
  { id: "idle", hotkey: "O", label: "待机", hint: "停止主动指令" },
  { id: "zone_create", hotkey: "P", label: "区域", hint: "划定储存区" }
] as const;

/**
 * 与 `Phaser.Input.Keyboard.KeyCodes` 中 Q W E R T Y U I O P 的数值一致，供 `addKey` 使用。
 * 见 https://github.com/phaserjs/phaser/blob/master/src/input/keyboard/keys/KeyCodes.js
 */
export const VILLAGER_TOOL_KEY_CODES = [
  81, 87, 69, 82, 84, 89, 85, 73, 79, 80
] as const;

const EXPECTED_HOTKEYS: readonly VillagerTool["hotkey"][] = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"
];

/** 校验工具栏配置：槽位数、热键顺序、id 唯一性。供 component 测试与人工排查。 */
export function validateVillagerToolBarConfig(): readonly string[] {
  const errors: string[] = [];
  if (VILLAGER_TOOLS.length !== VILLAGER_TOOL_KEY_CODES.length) {
    errors.push(
      `VILLAGER_TOOLS 与 VILLAGER_TOOL_KEY_CODES 数量不一致：${VILLAGER_TOOLS.length} vs ${VILLAGER_TOOL_KEY_CODES.length}`
    );
  }
  const n = Math.min(VILLAGER_TOOLS.length, EXPECTED_HOTKEYS.length);
  for (let i = 0; i < n; i++) {
    const want = EXPECTED_HOTKEYS[i];
    const got = VILLAGER_TOOLS[i]!.hotkey;
    if (got !== want) {
      errors.push(`槽位 ${i} 热键期望为 ${want}，实际为 ${got}`);
    }
  }
  const ids = new Set<string>();
  for (const t of VILLAGER_TOOLS) {
    if (ids.has(t.id)) errors.push(`重复的 tool id：${t.id}`);
    ids.add(t.id);
  }
  return errors;
}
