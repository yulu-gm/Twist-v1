/**
 * @file seeded-random.ts
 * @description 基于 Mulberry32 算法的可播种伪随机数生成器，保证确定性与可序列化
 * @dependencies 无外部依赖
 * @part-of core 核心模块 — 用于地图生成、AI 决策等需要确定性随机的场景
 */

/**
 * Mulberry32 seeded PRNG — deterministic, serializable state.
 * 可播种伪随机数生成器：相同种子始终产生相同序列，状态可存档/恢复
 */
export class SeededRandom {
  // ── 内部状态 ──
  private state: number;  // 当前 PRNG 状态（32 位整数）

  /**
   * 创建伪随机数生成器
   * @param seed - 随机种子（整数）
   */
  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  /** 生成 [0, 1) 范围内的浮点数（Mulberry32 核心算法） */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive */
  /**
   * 生成 [min, max] 范围内的整数（含两端）
   * @param min - 最小值
   * @param max - 最大值
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max) */
  /**
   * 生成 [min, max) 范围内的浮点数
   * @param min - 最小值（含）
   * @param max - 最大值（不含）
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with the given probability [0, 1] */
  /**
   * 按指定概率返回 true（掷骰子）
   * @param probability - 概率值 [0, 1]，0=永不，1=必定
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick a random element from an array */
  /**
   * 从数组中随机选取一个元素
   * @param arr - 源数组
   * @returns 随机选中的元素
   */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /** Shuffle an array in place (Fisher-Yates) */
  /**
   * 原地打乱数组顺序（Fisher-Yates 洗牌算法）
   * @param arr - 要打乱的数组（会被修改）
   * @returns 打乱后的同一数组引用
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Get state for serialization */
  /**
   * 获取当前内部状态（用于存档序列化）
   * @returns 当前 PRNG 状态值
   */
  getState(): number {
    return this.state;
  }

  /** Restore state from serialization */
  /**
   * 恢复内部状态（用于存档反序列化）
   * @param state - 之前保存的状态值
   */
  setState(state: number): void {
    this.state = state;
  }
}
