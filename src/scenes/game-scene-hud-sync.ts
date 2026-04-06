import { VILLAGER_TOOLS, type VillagerBuildSubId } from "../data/villager-tools";
import type { GameOrchestrator } from "../game/game-orchestrator";
import { presentationForVillagerTool } from "../player/interaction-mode-presenter";
import type { HudManager } from "../ui/hud-manager";

export function syncPlayerChannelHintLines(
  hud: HudManager,
  orchestrator: GameOrchestrator,
  selectedToolIndex: number,
  buildSubTool: VillagerBuildSubId | null
): void {
  const tool = VILLAGER_TOOLS[selectedToolIndex]!;
  const { modeLine } = presentationForVillagerTool(tool, buildSubTool);
  const foot = `世界快照：${orchestrator.getPlayerWorldPort().lineA.snapshotLabel}`;
  hud.syncPlayerChannelHint(modeLine, foot);
}
