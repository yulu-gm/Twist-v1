/** 小人指令工具栏：纯数据与校验（不依赖 Phaser，可在 Node 中单测）。 */

export type MockVillagerTool = Readonly<{
  id: string;
  hotkey: "Q" | "W" | "E" | "R" | "T" | "Y" | "U" | "I" | "O";
  label: string;
  hint: string;
}>;

export const MOCK_VILLAGER_TOOLS: readonly MockVillagerTool[] = [
  { id: "mine", hotkey: "Q", label: "开采", hint: "指派开采矿物" },
  { id: "demolish", hotkey: "W", label: "拆除", hint: "拆除建筑或障碍" },
  { id: "mow", hotkey: "E", label: "割草", hint: "清理植被" },
  { id: "lumber", hotkey: "R", label: "伐木", hint: "砍伐树木" },
  { id: "build", hotkey: "T", label: "建造", hint: "放置建筑" },
  { id: "farm", hotkey: "Y", label: "耕种", hint: "翻土与播种" },
  { id: "haul", hotkey: "U", label: "搬运", hint: "运输物资" },
  { id: "patrol", hotkey: "I", label: "巡逻", hint: "沿路线警戒" },
  { id: "idle", hotkey: "O", label: "待机", hint: "停止主动指令" }
] as const;

/**
 * 与 `Phaser.Input.Keyboard.KeyCodes` 中 Q W E R T Y U I O 的数值一致，供 `addKey` 使用。
 * 见 https://github.com/phaserjs/phaser/blob/master/src/input/keyboard/keys/KeyCodes.js
 */
export const MOCK_VILLAGER_TOOL_KEY_CODES = [
  81, 87, 69, 82, 84, 89, 85, 73, 79
] as const;

const EXPECTED_VILLAGER_TOOL_HOTKEYS: readonly MockVillagerTool["hotkey"][] = [
  "Q",
  "W",
  "E",
  "R",
  "T",
  "Y",
  "U",
  "I",
  "O"
];

/** 校验 mock 工具栏配置：槽位数、热键顺序、id 唯一性。供 component 测试与人工排查。 */
export function validateMockVillagerToolBarConfig(): readonly string[] {
  const errors: string[] = [];
  if (MOCK_VILLAGER_TOOLS.length !== MOCK_VILLAGER_TOOL_KEY_CODES.length) {
    errors.push(
      `MOCK_VILLAGER_TOOLS 与 MOCK_VILLAGER_TOOL_KEY_CODES 数量不一致：${MOCK_VILLAGER_TOOLS.length} vs ${MOCK_VILLAGER_TOOL_KEY_CODES.length}`
    );
  }
  const n = Math.min(MOCK_VILLAGER_TOOLS.length, EXPECTED_VILLAGER_TOOL_HOTKEYS.length);
  for (let i = 0; i < n; i++) {
    const want = EXPECTED_VILLAGER_TOOL_HOTKEYS[i];
    const got = MOCK_VILLAGER_TOOLS[i]!.hotkey;
    if (got !== want) {
      errors.push(`槽位 ${i} 热键期望为 ${want}，实际为 ${got}`);
    }
  }
  const ids = new Set<string>();
  for (const t of MOCK_VILLAGER_TOOLS) {
    if (ids.has(t.id)) errors.push(`重复的 tool id：${t.id}`);
    ids.add(t.id);
  }
  return errors;
}
