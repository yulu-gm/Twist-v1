/**
 * @file serialization.ts
 * @description 存档版本迁移系统，支持跨版本的存档兼容。
 * @dependencies 无外部依赖
 * @part-of 核心引擎层 (core)
 */

/** 当前存档版本号 */
export const CURRENT_SAVE_VERSION = 1;

/** 存档版本迁移接口 - 定义从一个版本到另一个版本的数据转换 */
interface SaveMigration {
  /** 源版本号 */
  fromVersion: number;
  /** 目标版本号 */
  toVersion: number;
  /** 执行迁移的函数，接收旧版数据并返回新版数据 */
  migrate(data: any): any;
}

/** 已注册的迁移列表，按源版本号排序 */
const migrations: SaveMigration[] = [];

/**
 * 对存档数据依次应用所有必要的迁移，将其升级到当前版本
 * @param data - 旧版存档数据（包含 version 字段）
 * @returns 迁移到 CURRENT_SAVE_VERSION 的存档数据
 * @throws 如果找不到某个版本对应的迁移，则抛出错误
 */
export function applyMigrations(data: any): any {
  while (data.version < CURRENT_SAVE_VERSION) {
    const migration = migrations.find(m => m.fromVersion === data.version);
    if (!migration) {
      throw new Error(`No migration found for save version ${data.version}`);
    }
    data = migration.migrate(data);
    data.version = migration.toVersion;
  }
  return data;
}
