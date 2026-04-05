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
  updateBlueprintProgress,
  type BlueprintPlacementCells
} from "./blueprint-manager";