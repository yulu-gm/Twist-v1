/**
 * @file path.service.ts
 * @description A* 寻路服务，包含最小堆优先队列、A*搜索算法和可达性检查
 * @dependencies core/types — CellCoord, cellKey; world/game-map — GameMap; path.types — PathOptions, PathResult
 * @part-of features/pathfinding 寻路功能模块
 */

import { CellCoord, cellKey } from '../../core/types';
import { GameMap } from '../../world/game-map';
import { PathOptions, PathResult } from './path.types';

// ── 二叉最小堆（优先队列，用于 A* 的开放列表） ──

/** 堆节点：包含格子坐标和 f 值（g + h） */
interface HeapNode {
  /** 格子坐标 */
  cell: CellCoord;
  /** f 值 = g（已走代价）+ h（启发式估计） */
  f: number;
}

/**
 * 最小堆实现，按 f 值排序
 * 用于 A* 算法中高效获取 f 值最小的待探索节点
 */
class MinHeap {
  /** 内部存储数组 */
  private data: HeapNode[] = [];

  /** 获取堆中元素数量 */
  get size(): number {
    return this.data.length;
  }

  /**
   * 插入一个节点到堆中
   * @param node - 包含格子坐标和 f 值的节点
   */
  push(node: HeapNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  /**
   * 弹出并返回 f 值最小的节点
   * @returns f 值最小的节点，堆为空时返回 undefined
   */
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

  /**
   * 上浮操作：将新插入的元素向上调整到正确位置
   * @param i - 起始索引
   */
  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  /**
   * 下沉操作：将堆顶元素向下调整到正确位置
   * @param i - 起始索引
   */
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

// ── 四方向邻居偏移量 ──
const DIRS: CellCoord[] = [
  { x: 0, y: -1 }, // 上
  { x: 0, y: 1 },  // 下
  { x: -1, y: 0 }, // 左
  { x: 1, y: 0 },  // 右
];

// ── 曼哈顿距离（A* 启发式函数） ──

/**
 * 计算两个格子间的曼哈顿距离，作为 A* 的启发式估计
 * @param from - 起点坐标
 * @param to - 终点坐标
 * @returns 曼哈顿距离值
 */
export function estimateDistance(from: CellCoord, to: CellCoord): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

// ── A* 寻路算法 ──

/**
 * 使用 A* 算法在地图上寻找从起点到终点的最短路径
 * @param map - 游戏地图（提供通行性和地形信息）
 * @param from - 起点格子坐标
 * @param to - 终点格子坐标
 * @param options - 寻路选项（最大搜索节点数等）
 * @returns 寻路结果，包含是否成功、路径坐标序列和总代价
 */
export function findPath(
  map: GameMap,
  from: CellCoord,
  to: CellCoord,
  options?: PathOptions,
): PathResult {
  const maxNodes = options?.maxSearchNodes ?? 2000;

  // 平凡情况：起点即终点
  if (from.x === to.x && from.y === to.y) {
    return { found: true, path: [{ x: from.x, y: from.y }], cost: 0 };
  }

  // 终点不可通行则直接返回无路径
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
      // 到达目标，回溯重建路径
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

      // 检查边界和通行性
      if (!map.pathGrid.isPassable(nx, ny)) continue;

      // 检查空间索引中的通行性（目标格子除外，允许走到目标处）
      if (neighborKey !== goalKey && !map.spatial.isPassable(neighbor)) continue;

      // 获取地形移动代价
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

/**
 * 从 cameFrom 映射表中回溯重建完整路径
 * @param cameFrom - 每个节点的前驱节点映射（key -> 前驱key）
 * @param goalKey - 终点的 key
 * @param start - 起点坐标（用于终止条件）
 * @returns 从起点到终点的格子坐标数组
 */
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

/**
 * 简单地形移动代价查询
 * 不同地形有不同的通行代价，默认为1
 * @param terrainDefId - 地形定义ID
 * @returns 该地形的移动代价
 */
function getTerrainMoveCost(terrainDefId: string): number {
  // 地形定义在此处不易直接访问，使用合理的默认值
  // pathGrid 已处理不可通行地形的过滤
  switch (terrainDefId) {
    case 'water_shallow': return 4;
    case 'mud': return 3;
    case 'sand': return 2;
    case 'marsh': return 3;
    default: return 1;
  }
}

// ── 可达性检查 ──

/**
 * 检查从起点到终点是否存在可通行的路径
 * @param map - 游戏地图
 * @param from - 起点坐标
 * @param to - 终点坐标
 * @returns 如果存在路径返回 true，否则返回 false
 */
export function isReachable(
  map: GameMap,
  from: CellCoord,
  to: CellCoord,
): boolean {
  const result = findPath(map, from, to);
  return result.found;
}
