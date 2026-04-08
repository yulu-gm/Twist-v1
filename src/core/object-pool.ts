/**
 * @file object-pool.ts
 * @description 游戏对象池 - 管理地图上所有游戏对象的集中存储与多维索引。
 *              提供按 ID 直接访问、按种类 (Kind) 索引、按标签 (Tag) 索引三种查询方式，
 *              支持空间索引同步回调，实现高效的对象增删改查。
 * @dependencies types.ts (ObjectId, ObjectKind, Tag, MapObjectBase, byId)
 * @part-of 核心引擎层 (core)
 */

import {
  ObjectId, ObjectKind, Tag, MapObjectBase, byId
} from './types';

/** 游戏对象池 - 集中管理所有地图对象，提供多维索引查询 */
export class ObjectPool {
  // ── 主存储 ──
  /** 按 ID 存储所有对象的主映射表 */
  readonly byId: Map<ObjectId, MapObjectBase> = new Map();

  // ── 索引 ──
  /** 按对象种类分组的 ID 集合索引（Pawn/Building/Item 等） */
  readonly byKind: Map<ObjectKind, Set<ObjectId>> = new Map();
  /** 按标签分组的 ID 集合索引，用于灵活的属性查询 */
  readonly byTag: Map<Tag, Set<ObjectId>> = new Map();

  // ── 空间索引同步回调 ──
  /** 对象添加时的回调，用于同步空间索引 */
  private onAdd?: (obj: MapObjectBase) => void;
  /** 对象移除时的回调，用于同步空间索引 */
  private onRemove?: (obj: MapObjectBase) => void;

  /**
   * 构造对象池
   * @param hooks - 可选的回调钩子，用于在对象增删时同步空间索引等外部数据结构
   */
  constructor(hooks?: {
    onAdd?: (obj: MapObjectBase) => void;
    onRemove?: (obj: MapObjectBase) => void;
  }) {
    this.onAdd = hooks?.onAdd;
    this.onRemove = hooks?.onRemove;

    // Initialize kind sets
    for (const kind of Object.values(ObjectKind)) {
      this.byKind.set(kind, new Set());
    }
  }

  /**
   * 添加对象到池中
   * @param obj - 要添加的地图对象，会被加入主存储、种类索引和标签索引，并触发 onAdd 回调
   */
  add(obj: MapObjectBase): void {
    this.byId.set(obj.id, obj);

    // Kind index
    let kindSet = this.byKind.get(obj.kind);
    if (!kindSet) {
      kindSet = new Set();
      this.byKind.set(obj.kind, kindSet);
    }
    kindSet.add(obj.id);

    // Tag index
    for (const tag of obj.tags) {
      let tagSet = this.byTag.get(tag);
      if (!tagSet) {
        tagSet = new Set();
        this.byTag.set(tag, tagSet);
      }
      tagSet.add(obj.id);
    }

    this.onAdd?.(obj);
  }

  /**
   * 从池中移除对象
   * @param id - 要移除的对象 ID，会从所有索引中清除并触发 onRemove 回调
   */
  remove(id: ObjectId): void {
    const obj = this.byId.get(id);
    if (!obj) return;

    this.onRemove?.(obj);

    this.byId.delete(id);
    this.byKind.get(obj.kind)?.delete(id);
    for (const tag of obj.tags) {
      this.byTag.get(tag)?.delete(id);
    }
  }

  /**
   * 按 ID 获取对象
   * @param id - 对象 ID
   * @returns 对象实例，不存在时返回 undefined
   */
  get(id: ObjectId): MapObjectBase | undefined {
    return this.byId.get(id);
  }

  /**
   * 判断对象是否存在于池中
   * @param id - 对象 ID
   * @returns 存在返回 true
   */
  has(id: ObjectId): boolean {
    return this.byId.has(id);
  }

  /**
   * 更新对象的标签集合，同步维护标签索引
   * @param id - 对象 ID
   * @param newTags - 新的标签集合，旧标签将被移除，新标签将被添加
   */
  updateTags(id: ObjectId, newTags: Set<Tag>): void {
    const obj = this.byId.get(id);
    if (!obj) return;

    // Remove from old tag indexes
    for (const tag of obj.tags) {
      if (!newTags.has(tag)) {
        this.byTag.get(tag)?.delete(id);
      }
    }

    // Add to new tag indexes
    for (const tag of newTags) {
      if (!obj.tags.has(tag)) {
        let tagSet = this.byTag.get(tag);
        if (!tagSet) {
          tagSet = new Set();
          this.byTag.set(tag, tagSet);
        }
        tagSet.add(id);
      }
    }

    obj.tags = newTags;
  }

  /**
   * 获取指定种类的所有对象
   * @param kind - 对象种类（如 Pawn、Building 等）
   * @returns 该种类的所有对象数组，按 ID 排序
   */
  allOfKind(kind: ObjectKind): MapObjectBase[] {
    const ids = this.byKind.get(kind);
    if (!ids) return [];
    const result: MapObjectBase[] = [];
    for (const id of ids) {
      const obj = this.byId.get(id);
      if (obj) result.push(obj);
    }
    return result.sort(byId);
  }

  /**
   * 获取拥有指定标签的所有对象
   * @param tag - 标签
   * @returns 拥有该标签的所有对象数组，按 ID 排序
   */
  allWithTag(tag: Tag): MapObjectBase[] {
    const ids = this.byTag.get(tag);
    if (!ids) return [];
    const result: MapObjectBase[] = [];
    for (const id of ids) {
      const obj = this.byId.get(id);
      if (obj) result.push(obj);
    }
    return result.sort(byId);
  }

  /**
   * 获取同时拥有所有指定标签的对象（交集查询）
   * @param tags - 标签数组，从最小集合开始遍历以提高效率
   * @returns 同时拥有所有标签的对象数组，按 ID 排序
   */
  allWithTags(tags: Tag[]): MapObjectBase[] {
    if (tags.length === 0) return [];
    // Start from the smallest set for efficiency
    const sets = tags
      .map(t => this.byTag.get(t))
      .filter((s): s is Set<ObjectId> => s !== undefined && s.size > 0);
    if (sets.length !== tags.length) return []; // Some tag has no entries

    sets.sort((a, b) => a.size - b.size);
    const result: MapObjectBase[] = [];
    for (const id of sets[0]) {
      if (sets.every(s => s.has(id))) {
        const obj = this.byId.get(id);
        if (obj) result.push(obj);
      }
    }
    return result.sort(byId);
  }

  /** 获取池中对象总数 */
  get size(): number {
    return this.byId.size;
  }

  /**
   * 获取池中所有对象
   * @returns 所有对象的数组，按 ID 排序
   */
  all(): MapObjectBase[] {
    return Array.from(this.byId.values()).sort(byId);
  }
}
