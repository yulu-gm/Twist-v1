import {
  ObjectId, ObjectKind, Tag, MapObjectBase, byId
} from './types';

export class ObjectPool {
  // Main storage
  readonly byId: Map<ObjectId, MapObjectBase> = new Map();

  // Indexes
  readonly byKind: Map<ObjectKind, Set<ObjectId>> = new Map();
  readonly byTag: Map<Tag, Set<ObjectId>> = new Map();

  // Callback for spatial index sync
  private onAdd?: (obj: MapObjectBase) => void;
  private onRemove?: (obj: MapObjectBase) => void;

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

  get(id: ObjectId): MapObjectBase | undefined {
    return this.byId.get(id);
  }

  has(id: ObjectId): boolean {
    return this.byId.has(id);
  }

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

  get size(): number {
    return this.byId.size;
  }

  all(): MapObjectBase[] {
    return Array.from(this.byId.values()).sort(byId);
  }
}
