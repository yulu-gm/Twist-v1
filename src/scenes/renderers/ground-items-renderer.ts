/**
 * ground-items-renderer：地图容器物资（掉落物堆）的 EntityRenderer。
 */

import Phaser from "phaser";
import type { MaterialEntity } from "../../game/entity-system";
import type { WorldGridConfig } from "../../game/world-grid";
import type { EntityRenderer } from "./entity-view-sync";

type GroundStackView = Phaser.GameObjects.Container & {
  __qty: Phaser.GameObjects.Text;
  __name: Phaser.GameObjects.Text;
  __g: Phaser.GameObjects.Graphics;
};

function layoutGroundStackView(
  view: GroundStackView,
  entity: MaterialEntity,
  grid: WorldGridConfig,
  ox: number,
  oy: number
): void {
  const { col, row } = entity.cell;
  const cs = grid.cellSizePx;
  const pad = 4;
  const w = cs - pad * 2;
  const h = cs - pad * 2;
  view.setPosition(ox + col * cs, oy + row * cs);
  view.__g.clear();
  view.__g.setPosition(pad, pad);
  view.__g.lineStyle(2, 0xc9b87a, 0.95);
  view.__g.strokeRect(0, 0, w, h);
  view.__name.setPosition(cs / 2, cs / 2);
  view.__qty.setPosition(cs - pad, cs - pad);
}

export const groundMapMaterialRenderer: EntityRenderer<MaterialEntity, GroundStackView> = {
  shouldRender: (e) => e.containerKind === "map" || e.containerKind === "zone",
  create(scene, entity, grid, ox, oy) {
    const c = scene.add.container(0, 0) as GroundStackView;
    const g = scene.add.graphics();
    c.__g = g;
    c.add(g);
    const nameText = scene.add.text(0, 0, entity.materialKind, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "11px",
      color: "#e8dcc8",
      align: "center"
    });
    nameText.setOrigin(0.5, 0.5);
    c.__name = nameText;
    c.add(nameText);
    const qtyText = scene.add.text(0, 0, String(entity.quantity), {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "10px",
      color: "#f0e6d2"
    });
    qtyText.setOrigin(1, 1);
    c.__qty = qtyText;
    c.add(qtyText);
    c.setDepth(25);
    layoutGroundStackView(c, entity, grid, ox, oy);
    return c;
  },
  update(_scene, entity, view, grid, ox, oy) {
    view.__name.setText(entity.materialKind);
    view.__qty.setText(String(entity.quantity));
    layoutGroundStackView(view, entity, grid, ox, oy);
  }
};
