/**
 * @file room.system.ts
 * @description 房间重建系统——当地图标记为脏（dirty）时，使用 BFS 洪水填充算法重新计算所有房间区域
 * @dependencies TickPhase, ObjectKind, cellKey, CellCoordKey — 核心类型与工具函数；
 *              SystemRegistration — tick系统注册接口；World — 世界状态；GameMap, Room — 地图与房间类型
 * @part-of features/room — 房间管理功能
 */

import { TickPhase, ObjectKind, cellKey, CellCoordKey } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { GameMap, Room } from '../../world/game-map';

/**
 * 重建所有地图的房间数据
 * @param world - 世界状态对象
 * 操作：对每个标记为 dirty 的地图执行以下步骤：
 *  1. 收集所有墙体/不可通行格子（来自建筑物footprint和不可通行地形）
 *  2. 使用 BFS 洪水填充遍历所有非墙体格子
 *  3. 每个连通区域形成一个房间，触及边界的为室外房间
 *  4. 更新地图的房间列表并清除 dirty 标记
 */
function rebuildRooms(world: World): void {
  for (const [, map] of world.maps) {
    if (!map.rooms.dirty) continue;

    const width = map.width;
    const height = map.height;
    const visited = new Array(width * height).fill(false);
    const rooms: Room[] = [];
    let roomId = 0;

    // 构建墙体集合——收集所有被不可通行对象占据的格子
    const wallCells = new Set<string>();
    const buildings = map.objects.allOfKind(ObjectKind.Building);
    for (const b of buildings) {
      if (b.tags.has('wall') || b.tags.has('impassable')) {
        const fp = b.footprint ?? { width: 1, height: 1 };
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            wallCells.add(cellKey({ x: b.cell.x + dx, y: b.cell.y + dy }));
          }
        }
      }
    }

    // 同时检查地形的可通行性
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrain = map.terrain.get(x, y);
        const tDef = world.defs.terrains.get(terrain);
        if (tDef && !tDef.passable) {
          wallCells.add(cellKey({ x, y }));
        }
      }
    }

    // 洪水填充——遍历所有格子，将连通的非墙体区域归为同一房间
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx]) continue;
        const key = cellKey({ x, y });
        if (wallCells.has(key)) {
          visited[idx] = true;
          continue;
        }

        // BFS 洪水填充——从当前格子开始扩展连通区域
        const cells = new Set<CellCoordKey>();
        const queue: [number, number][] = [[x, y]];
        let touchesBoundary = false;
        visited[idx] = true;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          cells.add(cellKey({ x: cx, y: cy }));

          if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
            touchesBoundary = true;
          }

          const neighbors = [
            [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
              touchesBoundary = true;
              continue;
            }
            const ni = ny * width + nx;
            if (visited[ni]) continue;
            const nkey = cellKey({ x: nx, y: ny });
            if (wallCells.has(nkey)) continue;
            visited[ni] = true;
            queue.push([nx, ny]);
          }
        }

        rooms.push({
          id: `room_${roomId++}`,
          cells,
          isOutdoor: touchesBoundary,
          temperature: 20,
          impressiveness: 0,
        });
      }
    }

    map.rooms.rooms = rooms;
    map.rooms.dirty = false;
  }
}

/** 房间重建系统注册：在 WORLD_UPDATE 阶段每 tick 执行，当地图标记为脏时重建房间 */
export const roomRebuildSystem: SystemRegistration = {
  id: 'room_rebuild',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 1,
  execute: rebuildRooms,
};
