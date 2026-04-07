import type { EntityRegistry } from "./entity-system";
import { coordKey, gridCoordFromKey, type GridCoord } from "./world-grid";

export function syncTreesAndRocksFromSceneLayout(
  registry: EntityRegistry,
  treeCellKeys: ReadonlySet<string>,
  rockCells: ReadonlyArray<GridCoord>
): void {
  const treeDesired = treeCellKeys;
  for (const t of registry.listEntitiesByKind("tree")) {
    if (!treeDesired.has(coordKey(t.cell))) {
      registry.removeTree(t.id);
    }
  }
  for (const key of treeDesired) {
    const cell = gridCoordFromKey(key);
    if (!cell) {
      throw new Error(`syncTreesAndRocksFromSceneLayout: invalid tree cell key ${key}`);
    }
    const id = `tree:${key}`;
    if (!registry.getTree(id)) {
      registry.registerTree({
        kind: "tree",
        id,
        cell,
        lumberMarked: false,
        occupied: false
      });
    }
  }

  const rockDesiredKeys = new Set(rockCells.map((c) => coordKey(c)));
  for (const r of registry.listEntitiesByKind("rock")) {
    if (!rockDesiredKeys.has(coordKey(r.cell))) {
      registry.removeRock(r.id);
    }
  }
  const seenRockKeys = new Set<string>();
  for (const cell of rockCells) {
    const key = coordKey(cell);
    if (seenRockKeys.has(key)) continue;
    seenRockKeys.add(key);
    const id = `rock:${key}`;
    if (!registry.getRock(id)) {
      registry.registerRock({
        kind: "rock",
        id,
        cell,
        miningMarked: false,
        occupied: false
      });
    }
  }
}
