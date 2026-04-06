/**
 * 地图格子几何、占用语义与障碍种子（与 Phaser 无关）。
 */

export type {
  GridCoord,
  InteractionPoint,
  InteractionPointKind,
  ReservationSnapshot,
  WorldGridConfig,
  GridRand
} from "./world-grid";

export {
  DEFAULT_WORLD_GRID,
  blockedKeysFromCells,
  cellAtWorldPixel,
  cellCenterWorld,
  coordKey,
  createReservationSnapshot,
  findInteractionPointById,
  gridLineCells,
  interactionPointsByKind,
  isCellOccupiedByOthers,
  isInsideGrid,
  isInteractionPointReservedByOther,
  isWalkableCell,
  orthogonalNeighbors,
  parseCoordKey,
  pickRandomBlockedCells,
  pruneReservationSnapshot,
  rectCellKeysInclusive,
  rectCellsInclusive,
  releaseInteractionPoint,
  reserveInteractionPoint,
  worldPointToCell
} from "./world-grid";

export { seedBlockedCellsAsObstacles } from "./world-seed";
export { seedInitialTreesAndResources } from "./world-seed-entities";

export type {
  CellPlacementBlocked,
  CellPlacementEntry,
  CellPlacementOk,
  OccupyConflict,
  OccupyOk,
  OccupyResult,
  OccupancyMap,
  PlacementCheck
} from "./occupancy-manager";

export {
  checkPlacement,
  createOccupancyMap,
  deleteEntityOccupancy,
  findBlockingOccupant,
  getOccupant,
  isOccupied,
  occupy,
  release,
  writeEntityOccupancy
} from "./occupancy-manager";

export type {
  ValidationResult,
  ZoneCellsValidationFailureReason
} from "./zone-manager";

export {
  createZone,
  getZoneAtCell,
  getZonesByType,
  removeZone,
  validateZoneCells
} from "./zone-manager";
