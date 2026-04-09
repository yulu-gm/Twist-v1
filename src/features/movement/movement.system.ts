/**
 * @file movement.system.ts
 * @description 移动系统，每 tick 处理所有棋子沿路径的逐格移动逻辑
 * @dependencies core/types — ObjectKind, TickPhase, cellEquals; core/tick-runner — 系统注册;
 *               core/logger — 日志; world/world — World; world/game-map — GameMap
 * @part-of features/movement 移动功能模块
 */

import {
  ObjectKind, TickPhase, cellEquals,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import type { Pawn } from '../pawn/pawn.types';

/** 移动系统注册：在 EXECUTION 阶段每 tick 执行 */
export const movementSystem: SystemRegistration = {
  id: 'movement',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(map);
    }
  },
};

/**
 * 处理单个地图中所有棋子的移动
 * 遍历每个有路径的棋子，累加移动进度，进度满时移动到下一格
 * @param map - 游戏地图
 */
function processMap(map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    const mv = pawn.movement;
    if (!mv.path || mv.path.length === 0) continue;

    // 如果路径索引超出路径长度，清除路径并跳过
    if (mv.pathIndex >= mv.path.length) {
      mv.path = [];
      mv.pathIndex = 0;
      mv.moveProgress = 0;
      continue;
    }

    const targetCell = mv.path[mv.pathIndex];

    // 如果已在目标格子上，推进索引
    if (cellEquals(pawn.cell, targetCell)) {
      mv.pathIndex++;
      mv.moveProgress = 0;

      // 检查路径是否完成
      if (mv.pathIndex >= mv.path.length) {
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        log.debug('path', `Pawn ${pawn.id} finished path`, undefined, pawn.id);
      }
      continue;
    }

    // 累加移动进度
    mv.moveProgress += mv.speed;

    if (mv.moveProgress >= 1) {
      // 检查目标格子是否仍可通行
      if (!map.spatial.isPassable(targetCell) && !cellEquals(targetCell, pawn.cell)) {
        // 路径被阻挡 — 清除路径，让 AI 重新规划
        log.debug('path', `Pawn ${pawn.id} path blocked at (${targetCell.x},${targetCell.y})`, undefined, pawn.id);
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        continue;
      }

      const prevCell = { x: pawn.cell.x, y: pawn.cell.y };

      // 移动到下一格
      pawn.cell = { x: targetCell.x, y: targetCell.y };
      /** 更新空间索引中的位置 */
      map.spatial.onObjectMoved(pawn.id, prevCell, pawn.cell);

      // 保存 prevCell 供渲染插值使用
      mv.prevCell = prevCell;

      mv.moveProgress = 0;
      mv.pathIndex++;

      // 检查路径是否完成
      if (mv.pathIndex >= mv.path.length) {
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        log.debug('path', `Pawn ${pawn.id} finished path`, undefined, pawn.id);
      }
    }
  }
}
