export type {
  AssignmentReason,
  BlueprintEntity,
  BuildState,
  BuildingEntity,
  BuildingKind,
  EntityId,
  EntityKind,
  EntityOwnership,
  GameEntity,
  InteractionCapability,
  PawnEntity,
  ReadonlyEntitySnapshot,
  ResourceContainerKind,
  ResourceEntity,
  ResourceMaterialKind,
  RestSpotSnapshot,
  TreeEntity,
  WorldEntityKind,
  WorldEntitySnapshot,
  ZoneEntity,
  ZoneKind
} from "./entity-types";
export { createGameplayGroundFoodDraft } from "./gameplay-ground-food-spawn";
export { createGameplayTreeDraft } from "./gameplay-tree-spawn";
export { toReadonlySnapshot } from "./entity-projection";
export { createEntityRegistry, EntityRegistry, type GameEntityDraft } from "./entity-registry";
export {
  dropResource,
  pickUpResource,
  transformBlueprintToBuilding,
  transformTreeToResource,
  type DropResourceOutcome,
  type PickUpResourceOutcome,
  type TransformBlueprintToBuildingOutcome,
  type TransformTreeToResourceOutcome
} from "./lifecycle-rules";
export {
  assignBedToPawn,
  isBedLikeBuilding,
  unassignBed,
  validateBedOwnership,
  validateCarrying,
  validateResourceLocation,
  type AssignBedOutcome,
  type BedOwnershipValidationResult,
  type BedOwnershipViolation,
  type CarryingValidationResult,
  type CarryingViolation,
  type ResourceLocationValidationResult,
  type ResourceLocationViolation,
  type UnassignBedOutcome
} from "./relationship-rules";
