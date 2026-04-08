/**
 * @file serialization.ts
 * @description 序列化与反序列化工具 - 处理游戏世界状态的 JSON 存档。
 *              核心功能：将 Set/Map 等原生数据结构转换为可 JSON 序列化的格式，
 *              并在加载时还原。同时包含存档版本迁移系统，支持跨版本的存档兼容。
 * @dependencies 无外部依赖（纯工具函数）
 * @part-of 核心引擎层 (core)
 */

/**
 * Serialization utilities — handle Set/Map conversion for JSON.
 */

/**
 * 将游戏世界对象序列化为 JSON 字符串
 * @param world - 游戏世界状态对象（含 Set/Map 等复杂数据结构）
 * @returns 格式化后的 JSON 字符串，Set/Map 已被转换为可序列化的标记对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(world: any): string {
  return JSON.stringify(world, replacer, 2);
}

/**
 * JSON.stringify 的 replacer 回调 - 将 Set 和 Map 转换为带 __type 标记的普通对象
 * @param _key - JSON 键名（未使用）
 * @param value - 当前值，如果是 Set/Map 则转换为标记对象
 * @returns 转换后的值
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replacer(_key: string, value: any): any {
  if (value instanceof Set) {
    return { __type: 'Set', values: Array.from(value) };
  }
  if (value instanceof Map) {
    return { __type: 'Map', entries: Array.from(value.entries()) };
  }
  return value;
}

/**
 * 递归反序列化值 - 将带 __type 标记的对象还原为 Set/Map
 * @param value - 从 JSON 解析出的值
 * @returns 还原后的值，__type:'Set' 还原为 Set，__type:'Map' 还原为 Map，数组和对象递归处理
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeValue(value: any): any {
  if (value && typeof value === 'object') {
    if (value.__type === 'Set') {
      return new Set(value.values);
    }
    if (value.__type === 'Map') {
      return new Map(value.entries.map(([k, v]: [any, any]) => [k, deserializeValue(v)]));
    }
    if (Array.isArray(value)) {
      return value.map(deserializeValue);
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deserializeValue(v);
    }
    return result;
  }
  return value;
}

/**
 * 将 JSON 字符串反序列化为游戏世界对象
 * @param json - 之前通过 serialize() 生成的 JSON 字符串
 * @returns 还原后的世界状态对象，Set/Map 已从标记对象恢复为原生类型
 */
export function deserialize(json: string): any {
  const raw = JSON.parse(json);
  return deserializeValue(raw);
}

/** 当前存档版本号 */
export const CURRENT_SAVE_VERSION = 1;

/** 存档版本迁移接口 - 定义从一个版本到另一个版本的数据转换 */
export interface SaveMigration {
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
 * 注册一个存档迁移
 * @param migration - 迁移定义，包含源/目标版本号和迁移函数
 */
export function registerMigration(migration: SaveMigration): void {
  migrations.push(migration);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

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
