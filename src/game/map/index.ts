/**
 * 地图格子几何、占用语义与障碍种子（与 Phaser 无关）。
 *
 * 占用拆分：`occupancy-manager` 只索引实体脚印；地形/配置阻挡在 `WorldGridConfig`；交互点临时预约在
 * `ReservationSnapshot` / `reserveInteractionPoint` 等。World 组合层负责按需一并查询。
 *
 * Barrel 子模块：`world-grid`（格坐标/可通行/交互点）；`occupancy-manager`（实体占用）；`zone-manager`、
 * `storage-zones`（区域与仓储）；`world-seed-entities`（初始资源与树木；障碍实体播种见 `../world-seed-obstacles`）。通常从本文件统一
 * re-export 导入，减少 `../map/xxx` 深路径分叉。
 *
 * 选区不在本目录：`game/interaction/floor-selection`（矩形格键与修饰键合并）；`player/commit-player-intent`
 *（意图→领域命令）；`scenes/renderers/selection-renderer`（框选/笔刷高亮）。更完整的「选区解析」过滤在提交
 * 命令前的交互层完成，见 `floor-selection.ts` 模块注释。
 */

export type {
  GridCoord,
  InteractionNeedDelta,
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

export {
  DEFAULT_INTERACTION_TEMPLATE_GRID,
  DEFAULT_SCENARIO_INTERACTION_POINTS
} from "./default-scenario-interaction-points";

export { seedInitialTreesAndResources } from "./world-seed-entities";

export { findPathAStar } from "./a-star-pathfinding";

export type {
  CellPlacementBlocked,
  CellPlacementEntry,
  CellPlacementOk,
  OccupyConflict,
  OccupyOk,
  OccupyResult,
  OccupancyMap,
  PlacementCheck,
  WriteEntityOccupancyBlocked,
  WriteEntityOccupancyOk,
  WriteEntityOccupancyResult
} from "./occupancy-manager";

export {
  checkPlacement,
  createOccupancyMap,
  deleteEntityOccupancy,
  findBlockingOccupant,
  getOccupant,
  getOccupants,
  isCellOccupiedByOthers,
  isOccupied,
  occupy,
  release,
  writeEntityOccupancy
} from "./occupancy-manager";

export type {
  ValidationResult,
  ZoneCellsValidationFailureReason,
  ZoneCoveredCellsAxisBounds
} from "./zone-manager";

export {
  axisAlignedBoundsFromCoveredCells,
  connectedComponentCountFromCoveredCells,
  createZone,
  getZoneAtCell,
  getZonesByType,
  removeZone,
  validateZoneCells
} from "./zone-manager";

export type {
  AvailableStorageCell,
  StorageFilterMode,
  StorageGroupLabel,
  StorageGroupSnapshot
} from "./storage-zones";

export {
  findAvailableStorageCell,
  listStorageGroupLabels,
  listStorageGroups,
  resolveStorageGroupAtCell,
  storageCellLockedMaterial
} from "./storage-zones";
