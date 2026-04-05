/**
 * 任务标记逻辑：根据工具 id 和框选结果生成/更新格上任务文案。
 * 与 {@link mergeTaskMarkerOverlayWithWorldSnapshot} 配合：领域层标记（拆除工单格、蓝图占用）以 WorldCore 快照为准。
 */

import { type SelectionModifier } from "../game/interaction/floor-selection";
import type { WorldSnapshot } from "../game/world-core";
import { coordKey } from "../game/map/world-grid";
import { VILLAGER_TOOLS } from "./villager-tools";

export type TaskMarkerSelectionInput = Readonly<{
  toolId: string;
  modifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
}>;

/** 「待机」不视为下达可标记的任务；未知 id 同空。 */
export function issuedTaskLabelForToolId(toolId: string): string | null {
  const tool = VILLAGER_TOOLS.find((t) => t.id === toolId);
  if (!tool || tool.id === "idle") return null;
  return tool.label;
}

export function applyTaskMarkersForSelection(
  currentMarkers: ReadonlyMap<string, string>,
  input: TaskMarkerSelectionInput
): Map<string, string> {
  const next = new Map(currentMarkers);
  if (input.toolId === "idle") {
    for (const key of input.cellKeys) {
      next.delete(key);
    }
    return next;
  }

  const issuedLabel = issuedTaskLabelForToolId(input.toolId);

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

/** 比较格键 → 文案图是否一致（用于避免每帧重复刷任务标记层）。 */
export function taskMarkerMapsEqual(
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function worldDerivedTaskLabelForCell(cellKey: string, snap: WorldSnapshot): string | undefined {
  for (const marker of snap.markers) {
    if (marker.kind === "deconstruct-obstacle" && coordKey(marker.cell) === cellKey) {
      return issuedTaskLabelForToolId("demolish") ?? undefined;
    }
  }
  for (const ent of snap.entities) {
    if (ent.kind !== "blueprint") continue;
    for (const c of ent.occupiedCells) {
      if (coordKey(c) === cellKey) {
        return issuedTaskLabelForToolId("build") ?? undefined;
      }
    }
  }
  return undefined;
}

let domainBackedTaskDisplayLabels: Set<string> | undefined;
function domainBackedDisplayLabels(): Set<string> {
  if (!domainBackedTaskDisplayLabels) {
    domainBackedTaskDisplayLabels = new Set(
      ["demolish", "build"]
        .map((id) => issuedTaskLabelForToolId(id))
        .filter((x): x is string => x != null)
    );
  }
  return domainBackedTaskDisplayLabels;
}

/**
 * 将 UI 意图叠加层与 A 线快照对齐：领域占用的格以快照为准；快照不再承载的「拆除/建造」格上文案会移除；
 * 伐木等仅存意图的标记在领域无占用时保留。
 */
export function mergeTaskMarkerOverlayWithWorldSnapshot(
  overlay: ReadonlyMap<string, string>,
  snap: WorldSnapshot
): Map<string, string> {
  const domainLabels = domainBackedDisplayLabels();
  const out = new Map<string, string>();
  const keys = new Set<string>([...overlay.keys()]);
  for (const marker of snap.markers) {
    keys.add(coordKey(marker.cell));
  }
  for (const ent of snap.entities) {
    if (ent.kind !== "blueprint") continue;
    for (const c of ent.occupiedCells) {
      keys.add(coordKey(c));
    }
  }

  for (const k of keys) {
    const worldLabel = worldDerivedTaskLabelForCell(k, snap);
    if (worldLabel !== undefined) {
      out.set(k, worldLabel);
      continue;
    }
    const ov = overlay.get(k);
    if (ov === undefined) continue;
    if (domainLabels.has(ov)) continue;
    out.set(k, ov);
  }
  return out;
}
