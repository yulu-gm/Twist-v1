import type { GameOrchestrator } from "../game/game-orchestrator";
import { type CommandMenuCommandId } from "../data/command-menu";
import { presentationForCommandMenuCommand } from "../player/interaction-mode-presenter";
import type { HudManager } from "../ui/hud-manager";

export function syncPlayerChannelHintLines(
  hud: HudManager,
  orchestrator: GameOrchestrator,
  activeCommandId: CommandMenuCommandId
): void {
  const { modeLine } = presentationForCommandMenuCommand(activeCommandId);
  const foot = `世界快照：${orchestrator.getPlayerWorldPort().lineA.snapshotLabel}`;
  hud.syncPlayerChannelHint(modeLine, foot);
}
