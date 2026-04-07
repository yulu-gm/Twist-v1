export { placeBlueprint, safePlaceBlueprint } from "./blueprint-placement";
export {
  BUILDING_SPECS,
  getBuildingSpec,
  type BuildingSpec,
  type OnCompleteRuleId
} from "./building-spec-catalog";
export {
  cancelBlueprint,
  createBlueprint,
  isBlueprintComplete,
  resolveBlueprintCoveredCells,
  updateBlueprintProgress,
  type BlueprintPlacementCells
} from "./blueprint-manager";
export {
  validateBuildPlacementForBlueprint,
  type BuildPlacementRejectReason,
  type BuildPlacementValidationResult
} from "./build-placement-validator";
export {
  assignBedAfterConstruction,
  type AssignBedOutcome
} from "./bed-ownership-facade";