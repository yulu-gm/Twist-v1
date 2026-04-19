/**
 * @file jobs.ts
 * @description 工作定义数据——定义游戏中所有工作类型。
 *              工作（Job）是角色执行任务的基本单元，每种工作定义了
 *              显示名称、汇报字符串模板和所属工作类型分类。
 *              工作类型包括：搬运（hauling）、建造（construction）、
 *              采矿（mining）、种植（growing）、个人行为（personal）。
 * @dependencies world/def-database（JobDef 接口）
 * @part-of defs 模块——游戏静态数据定义
 */

import { JobDef } from '../world/def-database';

export const JOB_DEFS: JobDef[] = [
  /** 搬运——将物品从地面运送到仓储区 */
  { defId: 'job_haul', label: 'Haul', reportString: 'hauling {target}', workType: 'hauling' },
  /** 建造——在指定位置建造建筑物 */
  { defId: 'job_construct', label: 'Construct', reportString: 'constructing {target}', workType: 'construction' },
  /** 采矿——开采岩石地形获取石料 */
  { defId: 'job_mine', label: 'Mine', reportString: 'mining {target}', workType: 'mining' },
  /** 收获——采收成熟的作物或植物 */
  { defId: 'job_harvest', label: 'Harvest', reportString: 'harvesting {target}', workType: 'growing' },
  /** 砍树——砍伐树木获取木材 */
  { defId: 'job_cut_tree', label: 'Cut Tree', reportString: 'cutting {target}', workType: 'growing' },
  /** 进食——角色食用食物补充营养 */
  { defId: 'job_eat', label: 'Eat', reportString: 'eating', workType: 'personal' },
  /** 睡觉——角色在床上休息恢复精力 */
  { defId: 'job_sleep', label: 'Sleep', reportString: 'sleeping', workType: 'personal' },
  /** 闲逛——角色无任务时随机漫步 */
  { defId: 'job_wander', label: 'Wander', reportString: 'wandering', workType: 'personal' },
  /** 前往——角色移动到指定位置 */
  { defId: 'job_goto', label: 'Go To', reportString: 'going to {target}', workType: 'personal' },
  /** 运送材料——将建筑所需材料运送到工地 */
  { defId: 'job_deliver_materials', label: 'Deliver Materials', reportString: 'delivering materials', workType: 'hauling' },
  /** 入库——将地面物资搬入仓库抽象库存 */
  { defId: 'job_store_in_storage', label: 'Store In Warehouse', reportString: 'storing {target}', workType: 'hauling' },
  /** 取材——从仓库抽象库存取材后送往蓝图 */
  { defId: 'job_take_from_storage', label: 'Take From Warehouse', reportString: 'taking material from warehouse', workType: 'hauling' },
];
