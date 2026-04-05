/**
 * 任务标记视图用的 mock：根据当前小人工具判断是否视为「对该格下达了任务指令」。
 * 真实玩法接入后可替换为领域层结果。
 */

import { MOCK_VILLAGER_TOOLS } from "./villager-tool-bar-config";

/** 「待机」不视为下达可标记的任务；未知 id 同空。 */
export function mockIssuedTaskLabelForVillagerToolId(toolId: string): string | null {
  const tool = MOCK_VILLAGER_TOOLS.find((t) => t.id === toolId);
  if (!tool || tool.id === "idle") return null;
  return tool.label;
}
