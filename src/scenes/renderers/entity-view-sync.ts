/**
 * entity-view-sync：静态实体视图与 EntityRegistry 的增量同步。
 */

import type Phaser from "phaser";
import type { AnyGameEntity, EntityId, EntityRegistry } from "../../game/entity-system";
import type { WorldGridConfig } from "../../game/world-grid";

export interface EntityRenderer<TEntity extends AnyGameEntity, TView extends Phaser.GameObjects.GameObject> {
  shouldRender?(entity: TEntity): boolean;
  create(
    scene: Phaser.Scene,
    entity: TEntity,
    grid: WorldGridConfig,
    ox: number,
    oy: number
  ): TView;
  update(
    scene: Phaser.Scene,
    entity: TEntity,
    view: TView,
    grid: WorldGridConfig,
    ox: number,
    oy: number
  ): void;
  destroy?(view: TView): void;
}

export type AnyEntityRenderer = EntityRenderer<AnyGameEntity, Phaser.GameObjects.GameObject>;

export type EntityViewRegistration = Readonly<{
  listEntities: (registry: EntityRegistry) => readonly AnyGameEntity[];
  renderer: AnyEntityRenderer;
}>;

function passesShouldRender(renderer: AnyEntityRenderer, entity: AnyGameEntity): boolean {
  const fn = renderer.shouldRender;
  return fn ? fn(entity) : true;
}

export function syncEntityViews(
  scene: Phaser.Scene,
  entityViews: Map<EntityId, Phaser.GameObjects.GameObject>,
  registry: EntityRegistry,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  registrations: readonly EntityViewRegistration[]
): void {
  const regById = new Map<EntityId, EntityViewRegistration>();
  const entityById = new Map<EntityId, AnyGameEntity>();

  for (const reg of registrations) {
    for (const entity of reg.listEntities(registry)) {
      if (!passesShouldRender(reg.renderer, entity)) continue;
      regById.set(entity.id, reg);
      entityById.set(entity.id, entity);
    }
  }

  for (const [id, view] of [...entityViews.entries()]) {
    if (regById.has(id)) continue;
    entityViews.delete(id);
    view.destroy(true);
  }

  for (const id of regById.keys()) {
    const reg = regById.get(id)!;
    const entity = entityById.get(id);
    if (!entity) continue;
    const renderer = reg.renderer;
    let view = entityViews.get(id);
    if (!view) {
      view = renderer.create(scene, entity, grid, ox, oy);
      entityViews.set(id, view);
    } else {
      renderer.update(scene, entity, view, grid, ox, oy);
    }
  }
}
