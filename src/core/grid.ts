/**
 * @file grid.ts
 * @description 通用二维网格数据结构，使用一维数组存储实现高效访问
 * @dependencies 无外部依赖
 * @part-of core 核心模块 — 用于地形、寻路、雾战等所有需要二维数据的场景
 */

/**
 * Grid<T> — generic 2D array backed by a flat typed storage.
 * 通用二维网格类，支持任意类型 T 的存储与查询
 */
export class Grid<T> {
  // ── 网格尺寸 ──
  readonly width: number;   // 网格宽度（列数）
  readonly height: number;  // 网格高度（行数）

  // ── 内部存储 ──
  private data: T[];        // 一维数组，按 y * width + x 索引

  /**
   * 创建二维网格
   * @param width - 网格宽度
   * @param height - 网格高度
   * @param fill - 填充值：可以是固定值，也可以是 (x, y) => T 的生成函数
   */
  constructor(width: number, height: number, fill: T | ((x: number, y: number) => T)) {
    this.width = width;
    this.height = height;
    if (typeof fill === 'function') {
      const fn = fill as (x: number, y: number) => T;
      this.data = new Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          this.data[y * width + x] = fn(x, y);
        }
      }
    } else {
      this.data = new Array(width * height).fill(fill);
    }
  }

  /**
   * 将二维坐标转换为一维数组索引
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 一维数组中的索引位置
   */
  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * 判断坐标是否在网格范围内
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 在范围内返回 true
   */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * 获取指定坐标的值
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 该坐标存储的值
   */
  get(x: number, y: number): T {
    return this.data[this.idx(x, y)];
  }

  /**
   * 设置指定坐标的值
   * @param x - 列坐标
   * @param y - 行坐标
   * @param value - 要存储的值
   */
  set(x: number, y: number, value: T): void {
    this.data[this.idx(x, y)] = value;
  }

  /**
   * 用固定值填充整个网格
   * @param value - 填充值
   */
  fill(value: T): void {
    this.data.fill(value);
  }

  /**
   * 遍历网格中所有格子，对每个格子执行回调
   * @param fn - 回调函数，接收 (x, y, value)
   */
  forEach(fn: (x: number, y: number, value: T) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(x, y, this.data[this.idx(x, y)]);
      }
    }
  }

  /**
   * 将网格映射为新类型的网格（类似数组的 map）
   * @param fn - 映射函数，接收 (x, y, value)，返回新类型的值
   * @returns 映射后的新网格
   */
  map<U>(fn: (x: number, y: number, value: T) => U): Grid<U> {
    return new Grid<U>(this.width, this.height, (x, y) => fn(x, y, this.get(x, y)));
  }

  /**
   * 将网格数据导出为一维数组（用于序列化）
   * @returns 网格数据的浅拷贝数组
   */
  toFlatArray(): T[] {
    return [...this.data];
  }

  /**
   * 从一维数组还原网格（用于反序列化）
   * @param width - 网格宽度
   * @param height - 网格高度
   * @param arr - 一维数据数组
   * @returns 还原后的网格实例
   */
  static fromFlatArray<T>(width: number, height: number, arr: T[]): Grid<T> {
    const grid = new Grid<T>(width, height, arr[0]);
    for (let i = 0; i < arr.length; i++) {
      grid.data[i] = arr[i];
    }
    return grid;
  }

  /**
   * 深拷贝当前网格
   * @returns 内容相同的全新网格实例
   */
  clone(): Grid<T> {
    const g = new Grid<T>(this.width, this.height, this.data[0]);
    for (let i = 0; i < this.data.length; i++) {
      g.data[i] = this.data[i];
    }
    return g;
  }
}
