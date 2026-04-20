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
  { defId: 'job_haul', label: '搬运', reportString: '搬运 {target} 中', workType: 'hauling' },
  /** 建造——在指定位置建造建筑物 */
  { defId: 'job_construct', label: '建造', reportString: '建造 {target} 中', workType: 'construction' },
  /** 采矿——开采岩石地形获取石料 */
  { defId: 'job_mine', label: '采矿', reportString: '开采 {target} 中', workType: 'mining' },
  /** 收获——采收成熟的作物或植物 */
  { defId: 'job_harvest', label: '收获', reportString: '收获 {target} 中', workType: 'growing' },
  /** 砍树——砍伐树木获取木材 */
  { defId: 'job_cut_tree', label: '砍树', reportString: '砍伐 {target} 中', workType: 'growing' },
  /** 进食——角色食用食物补充营养 */
  { defId: 'job_eat', label: '进食', reportString: '进食中', workType: 'personal' },
  /** 睡觉——角色在床上休息恢复精力 */
  { defId: 'job_sleep', label: '睡觉', reportString: '睡眠中', workType: 'personal' },
  /** 闲逛——角色无任务时随机漫步 */
  { defId: 'job_wander', label: '闲逛', reportString: '闲逛中', workType: 'personal' },
  /** 前往——角色移动到指定位置 */
  { defId: 'job_goto', label: '前往', reportString: '前往 {target} 中', workType: 'personal' },
  /** 运送材料——将建筑所需材料运送到工地 */
  { defId: 'job_deliver_materials', label: '运送材料', reportString: '运送材料中', workType: 'hauling' },
  /** 入库——将地面物资搬入仓库抽象库存 */
  { defId: 'job_store_in_storage', label: '入库', reportString: '入库 {target} 中', workType: 'hauling' },
  /** 取材——从仓库抽象库存取材后送往蓝图 */
  { defId: 'job_take_from_storage', label: '取材', reportString: '从仓库取材中', workType: 'hauling' },
];
