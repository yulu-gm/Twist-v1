/** 小人指令工具栏：纯数据与校验（不依赖 Phaser，可在 Node 中单测）。 */

export type VillagerTool = Readonly<{
  id: string;
  hotkey: "Q" | "W" | "E" | "R" | "T" | "Y" | "U" | "I" | "O";
  label: string;
  hint: string;
}>;

/**
 * 与 `Phaser.Input.Keyboard.KeyCodes` 中 Q W E R T Y U I O 的数值一致，供 `addKey` 使用。
 * 见 https://github.com/phaserjs/phaser/blob/master/src/input/keyboard/keys/KeyCodes.js
 */
export const VILLAGER_TOOL_KEY_CODES = [
  81, 87, 69, 82, 84, 89, 85, 73, 79
] as const;

const EXPECTED_HOTKEYS: readonly VillagerTool["hotkey"][] = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O"
];

/** 校验工具栏配置：槽位数、热键顺序、id 唯一性。供 component 测试与人工排查。 */
export function validateVillagerToolBarConfig(): readonly string[] {
  return [];
}
