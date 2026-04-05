import { type SelectionModifier } from "../game/floor-selection";
import { mockIssuedTaskLabelForVillagerToolId } from "./mock-task-marker-commands";

export type MockTaskMarkerSelectionInput = Readonly<{
  toolId: string;
  modifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
}>;

export function applyMockTaskMarkersForSelection(
  currentMarkers: ReadonlyMap<string, string>,
  input: MockTaskMarkerSelectionInput
): Map<string, string> {
  const next = new Map(currentMarkers);
  if (input.toolId === "idle") {
    for (const key of input.cellKeys) {
      next.delete(key);
    }
    return next;
  }

  const issuedLabel = mockIssuedTaskLabelForVillagerToolId(input.toolId);

  if (issuedLabel === null || input.cellKeys.size === 0) {
    return next;
  }

  if (input.modifier === "toggle") {
    for (const key of input.cellKeys) {
      if (next.get(key) === issuedLabel) {
        next.delete(key);
        continue;
      }

      next.set(key, issuedLabel);
    }
    return next;
  }

  for (const key of input.cellKeys) {
    next.set(key, issuedLabel);
  }
  return next;
}
