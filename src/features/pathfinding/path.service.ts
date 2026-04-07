import { CellCoord, cellKey } from '../../core/types';
import { GameMap } from '../../world/game-map';
import { PathOptions, PathResult } from './path.types';

// ── Binary Min-Heap (priority queue) ──

interface HeapNode {
  cell: CellCoord;
  f: number;
}

class MinHeap {
  private data: HeapNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: HeapNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < n && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

// ── 4-directional neighbors ──
const DIRS: CellCoord[] = [
  { x: 0, y: -1 }, // up
  { x: 0, y: 1 },  // down
  { x: -1, y: 0 }, // left
  { x: 1, y: 0 },  // right
];

// ── Manhattan distance ──

export function estimateDistance(from: CellCoord, to: CellCoord): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

// ── A* Pathfinding ──

export function findPath(
  map: GameMap,
  from: CellCoord,
  to: CellCoord,
  options?: PathOptions,
): PathResult {
  const maxNodes = options?.maxSearchNodes ?? 2000;

  // Trivial: already at destination
  if (from.x === to.x && from.y === to.y) {
    return { found: true, path: [{ x: from.x, y: from.y }], cost: 0 };
  }

  // If destination is impassable, no path
  if (!map.spatial.isPassable(to) && !map.pathGrid.isPassable(to.x, to.y)) {
    return { found: false, path: [], cost: 0 };
  }

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const closedSet = new Set<string>();

  const startKey = cellKey(from);
  const goalKey = cellKey(to);

  gScore.set(startKey, 0);
  open.push({ cell: { x: from.x, y: from.y }, f: estimateDistance(from, to) });

  let nodesExpanded = 0;

  while (open.size > 0) {
    const current = open.pop()!;
    const currentKey = cellKey(current.cell);

    if (currentKey === goalKey) {
      // Reconstruct path
      const path = reconstructPath(cameFrom, currentKey, from);
      return { found: true, path, cost: gScore.get(currentKey)! };
    }

    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    nodesExpanded++;
    if (nodesExpanded >= maxNodes) {
      return { found: false, path: [], cost: 0 };
    }

    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const dir of DIRS) {
      const nx = current.cell.x + dir.x;
      const ny = current.cell.y + dir.y;
      const neighbor: CellCoord = { x: nx, y: ny };
      const neighborKey = cellKey(neighbor);

      if (closedSet.has(neighborKey)) continue;

      // Check bounds and passability
      if (!map.pathGrid.isPassable(nx, ny)) continue;

      // Also check spatial passability (unless it's the destination cell)
      if (neighborKey !== goalKey && !map.spatial.isPassable(neighbor)) continue;

      // Terrain move cost
      const terrainDefId = map.terrain.inBounds(nx, ny) ? map.terrain.get(nx, ny) : null;
      const moveCost = terrainDefId ? getTerrainMoveCost(terrainDefId) : 1;

      const tentativeG = currentG + moveCost;
      const prevG = gScore.get(neighborKey) ?? Infinity;

      if (tentativeG < prevG) {
        gScore.set(neighborKey, tentativeG);
        cameFrom.set(neighborKey, currentKey);
        const f = tentativeG + estimateDistance(neighbor, to);
        open.push({ cell: neighbor, f });
      }
    }
  }

  return { found: false, path: [], cost: 0 };
}

function reconstructPath(
  cameFrom: Map<string, string>,
  goalKey: string,
  start: CellCoord,
): CellCoord[] {
  const path: CellCoord[] = [];
  let current = goalKey;
  while (current !== undefined) {
    const [x, y] = current.split(',').map(Number);
    path.push({ x, y });
    const prev = cameFrom.get(current);
    if (prev === undefined) break;
    current = prev;
  }
  path.reverse();
  return path;
}

/** Simple terrain cost lookup — defaults to 1 */
function getTerrainMoveCost(terrainDefId: string): number {
  // Terrain defs aren't easily accessible here without a World reference,
  // so we use sensible defaults. The pathGrid already handles impassability.
  switch (terrainDefId) {
    case 'water_shallow': return 4;
    case 'mud': return 3;
    case 'sand': return 2;
    case 'marsh': return 3;
    default: return 1;
  }
}

// ── Reachability check ──

export function isReachable(
  map: GameMap,
  from: CellCoord,
  to: CellCoord,
): boolean {
  const result = findPath(map, from, to);
  return result.found;
}
