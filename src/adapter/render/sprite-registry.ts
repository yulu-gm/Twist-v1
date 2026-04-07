import Phaser from 'phaser';
import { ObjectId } from '../../core/types';

export class SpriteRegistry {
  private sprites: Map<ObjectId, Phaser.GameObjects.GameObject> = new Map();

  get(id: ObjectId): Phaser.GameObjects.GameObject | undefined {
    return this.sprites.get(id);
  }

  set(id: ObjectId, sprite: Phaser.GameObjects.GameObject): void {
    this.sprites.set(id, sprite);
  }

  delete(id: ObjectId): void {
    this.sprites.delete(id);
  }

  has(id: ObjectId): boolean {
    return this.sprites.has(id);
  }

  entries(): IterableIterator<[ObjectId, Phaser.GameObjects.GameObject]> {
    return this.sprites.entries();
  }

  clear(): void {
    for (const [, sprite] of this.sprites) {
      sprite.destroy();
    }
    this.sprites.clear();
  }
}
