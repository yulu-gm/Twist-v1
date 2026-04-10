/**
 * @file console.ts
 * @description 调试控制台，在 window.opus 上暴露全局调试 API，
 *              供开发者在浏览器控制台中检查和操纵游戏状态
 * @dependencies world/world — 世界状态；world/game-map — 地图数据；
 *               core/inspector — 对象/格子/AI 检查器；core/logger — 日志系统；
 *               core/types — ObjectKind
 * @part-of adapter/debug — 调试工具模块
 */

import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { inspector } from '../../core/inspector';
import { log } from '../../core/logger';
import { ObjectKind } from '../../core/types';

/** 扩展 Window 接口，声明 opus 调试 API 全局属性 */
declare global {
  interface Window {
    opus: Record<string, (...args: any[]) => unknown>;
  }
}

/**
 * 安装调试控制台到 window.opus
 *
 * @param world - 游戏世界对象
 * @param map - 当前地图对象
 *
 * 提供的 API：
 * - inspect(id): 检查指定对象
 * - cell(x,y): 检查指定格子
 * - pawns(): 列出所有棋子
 * - job(id): 查看棋子当前任务
 * - aiLog(id, count): 获取棋子 AI 日志
 * - reservations(): 列出所有预约
 * - zones(): 列出所有区域
 * - rooms(): 列出所有房间
 * - tick(): 获取当前 tick
 * - status(): 获取世界状态概览
 * - cmd(type, payload): 推送命令到队列
 * - spawn(defId, x, y, count): 生成物品
 * - destroy(objectId): 销毁对象
 * - advance(count): 快进指定 tick 数
 * - logs(count): 获取最近日志
 * - world(): 获取世界对象（完整访问）
 * - map(): 获取地图对象
 */
export function installDebugConsole(world: World, map: GameMap): void {
  const debugApi = {
    /** 按 ID 检查一个地图对象 */
    inspect(id: string) {
      return inspector.inspectObject(id);
    },

    /** 检查指定坐标的格子信息 */
    cell(x: number, y: number) {
      return inspector.inspectCell(map.id, { x, y });
    },

    /** 列出地图上所有棋子 */
    pawns() {
      return map.objects.allOfKind(ObjectKind.Pawn);
    },

    /** 检查指定棋子的当前任务 */
    job(pawnId: string) {
      return inspector.inspectPawnJob(pawnId);
    },

    /** 获取指定棋子的 AI 决策日志 */
    aiLog(pawnId: string, count = 20) {
      return inspector.inspectAILog(pawnId, count);
    },

    /** 列出所有活动预约 */
    reservations() {
      return map.reservations.getAll();
    },

    /** 列出所有区域 */
    zones() {
      return map.zones.getAll();
    },

    /** 列出所有房间 */
    rooms() {
      return map.rooms.rooms;
    },

    /** 获取当前 tick 数 */
    tick() {
      return world.tick;
    },

    /** 获取世界状态概览（对象数量统计） */
    status() {
      return {
        tick: world.tick,
        speed: world.speed,
        clock: world.clock,
        objects: map.objects.size,
        pawns: map.objects.allOfKind(ObjectKind.Pawn).length,
        buildings: map.objects.allOfKind(ObjectKind.Building).length,
        items: map.objects.allOfKind(ObjectKind.Item).length,
        plants: map.objects.allOfKind(ObjectKind.Plant).length,
        designations: map.objects.allOfKind(ObjectKind.Designation).length,
        blueprints: map.objects.allOfKind(ObjectKind.Blueprint).length,
        constructionSites: map.objects.allOfKind(ObjectKind.ConstructionSite).length,
        reservations: map.reservations.getAll().length,
      };
    },

    /** 推送一个命令到命令队列 */
    cmd(type: string, payload: Record<string, unknown> = {}) {
      world.commandQueue.push({ type, payload });
      return `Queued: ${type}`;
    },

    /** 在指定位置生成物品 */
    spawn(defId: string, x: number, y: number, count = 1) {
      return this.cmd('debug_spawn', { defId, cell: { x, y }, count });
    },

    /** 销毁指定对象 */
    destroy(objectId: string) {
      return this.cmd('debug_destroy', { objectId });
    },

    /** 快进指定数量的 tick */
    advance(count: number) {
      return this.cmd('debug_advance_ticks', { count });
    },

    /** 获取最近的日志条目 */
    logs(count = 30) {
      return log.getEntries({ count });
    },

    /** 获取世界对象（完整访问，调试用） */
    world() {
      return world;
    },

    /** 获取地图对象 */
    map() {
      return map;
    },
  };

  // 挂载到 window.opus 供浏览器控制台使用
  window.opus = debugApi;

  console.log(
    '%c[Opus World] Debug console installed. Type opus.status() to get started.',
    'color: #4fc3f7; font-weight: bold',
  );
  console.log(
    'Available: opus.inspect(id), opus.cell(x,y), opus.pawns(), opus.job(id), ' +
    'opus.spawn(def,x,y), opus.destroy(id), opus.advance(n), opus.status(), opus.logs()',
  );
}
