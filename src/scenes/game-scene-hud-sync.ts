import { playerAcceptanceScenarioById } from "../data/player-acceptance-scenarios";
import { VILLAGER_TOOLS } from "../data/villager-tools";
import type { GameOrchestrator } from "../game/game-orchestrator";
import { presentationForVillagerTool } from "../player/interaction-mode-presenter";
import type { HudManager } from "../ui/hud-manager";

export function syncPlayerChannelHintLines(
  hud: HudManager,
  orchestrator: GameOrchestrator,
  selectedToolIndex: number,
  acceptanceScenarioId: string
): void {
  const tool = VILLAGER_TOOLS[selectedToolIndex]!;
  const { modeLine } = presentationForVillagerTool(tool);
  const scen = playerAcceptanceScenarioById(acceptanceScenarioId);
  const tag = scen && scen.id !== "off" ? ` · 验收：${scen.title}` : "";
  const foot = `世界快照：${orchestrator.getPlayerWorldPort().lineA.snapshotLabel}${tag}`;
  hud.syncPlayerChannelHint(modeLine, foot);
}
