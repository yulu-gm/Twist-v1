import {
  DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID,
  playerAcceptanceScenarioById,
  type PlayerAcceptanceScenario
} from "../data/player-acceptance-scenarios";
import type { GameOrchestrator } from "../game/game-orchestrator";
import type { HudManager } from "../ui/hud-manager";
import { redrawTaskMarkers, type TaskMarkerViewDeps } from "./game-scene-presentation";
import type { GameSceneFloorInteraction } from "./game-scene-floor-interaction";

export function applyAcceptanceScenarioPresentation(opts: Readonly<{
  scenarioId: string;
  orchestrator: GameOrchestrator;
  hud: HudManager;
  taskMarkersByCell: Map<string, string>;
  getTaskMarkerView: () => TaskMarkerViewDeps;
  floorInteraction: GameSceneFloorInteraction;
  onScenarioIdCommitted: (id: string) => void;
  syncPlayerChannelUi: () => void;
}>): PlayerAcceptanceScenario {
  const scenario =
    playerAcceptanceScenarioById(opts.scenarioId) ??
    playerAcceptanceScenarioById(DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID)!;
  opts.onScenarioIdCommitted(scenario.id);
  opts.orchestrator.applyAcceptanceScenarioGateway(scenario);

  if (scenario.resetMarkersOnEnter) {
    opts.taskMarkersByCell.clear();
    redrawTaskMarkers(opts.taskMarkersByCell, opts.getTaskMarkerView());
    opts.floorInteraction.resetForScenarioMarkers();
    opts.hud.syncPlayerChannelLastResult(null);
  }

  opts.hud.syncBAcceptancePanel(scenario);
  opts.syncPlayerChannelUi();
  return scenario;
}

export function runAcceptanceReplayPresentation(opts: Readonly<{
  orchestrator: GameOrchestrator;
  hud: HudManager;
  taskMarkersByCell: Map<string, string>;
  getTaskMarkerView: () => TaskMarkerViewDeps;
}>): void {
  const replay = opts.orchestrator.runAcceptanceReplay(performance.now());
  if (replay.summaryLine === null) {
    opts.hud.syncPlayerChannelLastResult("回放：暂无已记录的命令");
    return;
  }
  opts.taskMarkersByCell.clear();
  for (const [k, v] of replay.nextMarkers) opts.taskMarkersByCell.set(k, v);
  redrawTaskMarkers(opts.taskMarkersByCell, opts.getTaskMarkerView());
  opts.hud.syncPlayerChannelLastResult(replay.summaryLine);
}
