/**
 * Grid<T> — generic 2D array backed by a flat typed storage.
 */
export class Grid<T> {
  readonly width: number;
  readonly height: number;
  private data: T[];

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

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x: number, y: number): T {
    return this.data[this.idx(x, y)];
  }

  set(x: number, y: number, value: T): void {
    this.data[this.idx(x, y)] = value;
  }

  fill(value: T): void {
    this.data.fill(value);
  }

  forEach(fn: (x: number, y: number, value: T) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(x, y, this.data[this.idx(x, y)]);
      }
    }
  }

  map<U>(fn: (x: number, y: number, value: T) => U): Grid<U> {
    return new Grid<U>(this.width, this.height, (x, y) => fn(x, y, this.get(x, y)));
  }

  toFlatArray(): T[] {
    return [...this.data];
  }

  static fromFlatArray<T>(width: number, height: number, arr: T[]): Grid<T> {
    const grid = new Grid<T>(width, height, arr[0]);
    for (let i = 0; i < arr.length; i++) {
      grid.data[i] = arr[i];
    }
    return grid;
  }

  clone(): Grid<T> {
    const g = new Grid<T>(this.width, this.height, this.data[0]);
    for (let i = 0; i < this.data.length; i++) {
      g.data[i] = this.data[i];
    }
    return g;
  }
}
