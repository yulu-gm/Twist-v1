/**
 * @file corpse.types.ts
 * @description 尸体对象的类型定义，描述死亡棋子留下的尸体实体
 * @dependencies core/types — 基础对象接口 MapObjectBase、ObjectKind、ObjectId
 * @part-of features/corpse — 尸体功能模块
 */

import { ObjectKind, MapObjectBase, ObjectId } from '../../core/types';

/**
 * 尸体接口 — 棋子死亡后在地图上残留的实体
 *
 * 继承 MapObjectBase，拥有位置、标签等通用属性，
 * 额外记录来源棋子和腐烂进度。
 */
export interface Corpse extends MapObjectBase {
  /** 对象类别标识，固定为 Corpse */
  kind: ObjectKind.Corpse;
  /** 产生该尸体的原始棋子 ID */
  originalPawnId: ObjectId;
  /** 腐烂进度：0 表示刚生成，1 表示完全腐烂（将被移除） */
  decayProgress: number;  // 0~1, 1=fully decayed
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Corpse]: Corpse;
  }
}
