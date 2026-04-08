/**
 * @file index.ts
 * @description 定义数据库构建入口——汇总所有分类的定义数据并构建 DefDatabase。
 *              将地形、建筑、物品、植物、工作等各模块的定义注册到统一的数据库中。
 * @dependencies world/def-database（DefDatabase 类）, defs/terrains, defs/buildings,
 *               defs/items, defs/plants, defs/jobs
 * @part-of defs 模块——游戏静态数据定义
 */

import { DefDatabase } from '../world/def-database';
import { TERRAIN_DEFS } from './terrains';
import { BUILDING_DEFS } from './buildings';
import { ITEM_DEFS } from './items';
import { PLANT_DEFS } from './plants';
import { JOB_DEFS } from './jobs';

/**
 * 构建并返回一个完整的定义数据库
 * 遍历所有分类的定义数组，将每个定义注册到 DefDatabase 对应的映射表中。
 * @returns 已注册所有定义的 DefDatabase 实例
 */
export function buildDefDatabase(): DefDatabase {
  const db = new DefDatabase();

  for (const def of TERRAIN_DEFS) db.registerTerrain(def);
  for (const def of BUILDING_DEFS) db.registerBuilding(def);
  for (const def of ITEM_DEFS) db.registerItem(def);
  for (const def of PLANT_DEFS) db.registerPlant(def);
  for (const def of JOB_DEFS) db.registerJob(def);

  return db;
}
