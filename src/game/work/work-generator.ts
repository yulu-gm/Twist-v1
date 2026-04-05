import { coordKey, type GridCoord } from "../map/world-grid";
import type { WorkOrder, WorkStep } from "./work-types";

const DEFAULT_OPEN_STATUS = "open" as const;

function navigateThen(stepType: string, precondition: string, successResult: string, failureResult: string): readonly WorkStep[] {
  return [
    {
      stepType: "navigate-to-target",
      precondition: "path-exists",
      successResult: "adjacent",
      failureResult: "unreachable"
    },
    {
      stepType,
      precondition,
      successResult,
      failureResult
    }
  ];
}

export function generateChopWork(treeEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:chop:${treeEntityId}:${coordKey(cell)}`,
    kind: "chop",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: treeEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 10,
    sourceReason: "logging-marked",
    steps: navigateThen("chop-tree", "tree-marked-for-logging", "tree-felled", "chop-aborted")
  };
}

export function generatePickUpWork(resourceEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:pick-up:${resourceEntityId}:${coordKey(cell)}`,
    kind: "pick-up",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: resourceEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 8,
    sourceReason: "resource-pickupable",
    steps: navigateThen("pick-up-resource", "pickup-allowed-and-on-ground", "carried", "pickup-failed")
  };
}

export function generateHaulWork(
  resourceEntityId: string,
  fromCell: GridCoord,
  toZoneId: string,
  dropCell: GridCoord
): WorkOrder {
  return {
    workId: `work:haul:${resourceEntityId}:${coordKey(fromCell)}:${toZoneId}`,
    kind: "haul",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: resourceEntityId,
    targetCell: { col: fromCell.col, row: fromCell.row },
    haulDropCell: { col: dropCell.col, row: dropCell.row },
    priority: 6,
    sourceReason: "storage-routing",
    steps: [
      {
        stepType: "navigate-to-resource",
        precondition: `at-cell-${coordKey(fromCell)}`,
        successResult: "adjacent",
        failureResult: "unreachable"
      },
      {
        stepType: "pick-up-resource",
        precondition: "resource-on-ground",
        successResult: "carrying",
        failureResult: "cannot-carry"
      },
      {
        stepType: "navigate-to-zone",
        precondition: `zone-${toZoneId}`,
        successResult: "at-drop-cell",
        failureResult: "unreachable"
      },
      {
        stepType: "deposit-in-zone",
        precondition: `zone-${toZoneId}-accepts-material`,
        successResult: "deposited",
        failureResult: "zone-rejected"
      }
    ]
  };
}

export function generateConstructWork(blueprintEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:construct:${blueprintEntityId}:${coordKey(cell)}`,
    kind: "construct",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: blueprintEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 9,
    sourceReason: "blueprint-placed",
    steps: navigateThen(
      "construct-blueprint",
      "blueprint-buildable",
      "construction-complete",
      "construction-aborted"
    )
  };
}
