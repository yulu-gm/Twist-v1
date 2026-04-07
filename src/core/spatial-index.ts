import { CellCoord, Footprint, ObjectId } from './types';

/**
 * SpatialIndex — cell-based spatial lookup.
 * Backed by a flat array of Sets, one per cell.
 */
export class SpatialIndex {
  readonly width: number;
  readonly height: number;
  private cells: Set<ObjectId>[];
  private impassable: Set<ObjectId>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = new Set();
    }
    this.impassable = new Set();
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getAt(cell: CellCoord): ObjectId[] {
    if (!this.inBounds(cell.x, cell.y)) return [];
    return Array.from(this.cells[this.idx(cell.x, cell.y)]);
  }

  getInRect(min: CellCoord, max: CellCoord): ObjectId[] {
    const result: ObjectId[] = [];
    const x0 = Math.max(0, min.x);
    const y0 = Math.max(0, min.y);
    const x1 = Math.min(this.width - 1, max.x);
    const y1 = Math.min(this.height - 1, max.y);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const id of this.cells[this.idx(x, y)]) {
          result.push(id);
        }
      }
    }
    return result;
  }

  isPassable(cell: CellCoord): boolean {
    if (!this.inBounds(cell.x, cell.y)) return false;
    const ids = this.cells[this.idx(cell.x, cell.y)];
    for (const id of ids) {
      if (this.impassable.has(id)) return false;
    }
    return true;
  }

  isOccupied(cell: CellCoord): boolean {
    if (!this.inBounds(cell.x, cell.y)) return false;
    return this.cells[this.idx(cell.x, cell.y)].size > 0;
  }

  onObjectAdded(id: ObjectId, cell: CellCoord, footprint?: Footprint, blocksMovement: boolean = false): void {
    const w = footprint?.width ?? 1;
    const h = footprint?.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = cell.x + dx;
        const cy = cell.y + dy;
        if (this.inBounds(cx, cy)) {
          this.cells[this.idx(cx, cy)].add(id);
        }
      }
    }
    if (blocksMovement) {
      this.impassable.add(id);
    }
  }

  onObjectRemoved(id: ObjectId, cell: CellCoord, footprint?: Footprint): void {
    const w = footprint?.width ?? 1;
    const h = footprint?.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = cell.x + dx;
        const cy = cell.y + dy;
        if (this.inBounds(cx, cy)) {
          this.cells[this.idx(cx, cy)].delete(id);
        }
      }
    }
    this.impassable.delete(id);
  }

  onObjectMoved(id: ObjectId, from: CellCoord, to: CellCoord, footprint?: Footprint): void {
    this.onObjectRemoved(id, from, footprint);
    this.onObjectAdded(id, to, footprint, this.impassable.has(id));
  }

  markImpassable(id: ObjectId): void {
    this.impassable.add(id);
  }

  markPassable(id: ObjectId): void {
    this.impassable.delete(id);
  }

  clear(): void {
    for (const set of this.cells) {
      set.clear();
    }
    this.impassable.clear();
  }
}
