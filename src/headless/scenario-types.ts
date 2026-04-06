import type { BuildingKind } from "../game/entity/entity-types";
import type { SelectionModifier } from "../game/interaction/floor-selection";
import type { GridCoord, WorldGridConfig } from "../game/map";
import type { PawnState } from "../game/pawn-state";
import type { TimeSpeed } from "../game/time";
import type { CommandMenuCommandId } from "../data/command-menu";
import type { DomainCommand } from "../player/s0-contract";

export type ScenarioTreeSpawn = Readonly<{ cell: GridCoord }>;

export type ScenarioResourceSpawn = Readonly<{
  cell: GridCoord;
  materialKind: string;
  pickupAllowed?: boolean;
}>;

export type ScenarioZoneSpawn = Readonly<{
  cells: readonly GridCoord[];
  zoneKind?: string;
}>;

export type ScenarioPlayerInputShape =
  | "rect-selection"
  | "brush-stroke"
  | "single-cell";

export type ScenarioPlayerInputSemantic = ScenarioPlayerInputShape | "no-tool";

export type ScenarioWorldPortConfig = Readonly<{
  alwaysAccept?: boolean;
  rejectIfTouchesCellKeys?: readonly string[];
}>;

export type ScenarioUiObservation = Readonly<{
  layers: readonly string[];
}>;

export type ScenarioPlayerSelectionAfterHydrate = Readonly<{
  /** 与实机 `commitPlayerSelection` 一致。 */
  commandId: CommandMenuCommandId;
  selectionModifier: SelectionModifier;
  cellKeys: readonly string[];
  inputShape: ScenarioPlayerInputShape;
  semantics?: ScenarioPlayerInputSemantic;
  label?: string;
}>;

export type ScenarioExpectation = Readonly<{
  label: string;
  type:
    | "pawn-reaches-goal"
    | "event-occurred"
    | "no-pawn-starved"
    | "work-item-exists"
    | "building-present"
    | "entity-kind-exists"
    | "entity-kind-absent"
    | "resource-in-container"
    | "work-item-completed-kind"
    | "custom";
  params: Record<string, unknown>;
  maxTicks?: number;
}>;

export type ScenarioDefinition = Readonly<{
  name: string;
  description: string;
  seed: number;
  gridConfig?: WorldGridConfig;
  pawns: Array<{
    name: string;
    cell: GridCoord;
    overrides?: Partial<Pick<PawnState, "satiety" | "energy" | "needs">>;
  }>;
  blueprints?: Array<{ kind: BuildingKind; cell: GridCoord }>;
  obstacles?: Array<{ cell: GridCoord; label?: string }>;
  trees?: readonly ScenarioTreeSpawn[];
  resources?: readonly ScenarioResourceSpawn[];
  zones?: readonly ScenarioZoneSpawn[];
  timeConfig?: {
    startMinuteOfDay?: number;
    paused?: boolean;
    speed?: TimeSpeed;
  };
  worldPortConfig?: ScenarioWorldPortConfig;
  tickScheduleAfterHydrate?: readonly number[];
  uiObservation?: ScenarioUiObservation;
  claimConstructBlueprintAsPawnName?: string;
  domainCommandsAfterHydrate?: readonly DomainCommand[];
  playerSelectionAfterHydrate?: readonly ScenarioPlayerSelectionAfterHydrate[];
  expectations?: ScenarioExpectation[];
  manualAcceptance?: Readonly<{
    steps: readonly string[];
    outcomes: readonly string[];
  }>;
}>;
