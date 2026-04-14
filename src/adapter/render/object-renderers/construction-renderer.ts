import Phaser from 'phaser';
import { ObjectKind, type MapObjectBase } from '../../../core/types';
import type { Blueprint } from '../../../features/construction/blueprint.types';
import type { ConstructionSite } from '../../../features/construction/construction-site.types';
import { hasConstructionOccupants } from '../../../features/construction/construction.helpers';
import type { GameMap } from '../../../world/game-map';
import { getObjectPixelCenter, getSpriteSize, scaleColor } from '../render-utils';
import type { ObjectRenderer } from './types';

const WARNING_STROKE = 0xff4d4f;
const WARNING_FILL = 0xff6b6b;

interface ConstructionVisualStyle {
  fillColor: number;
  fillAlpha: number;
  strokeColor: number;
  strokeAlpha: number;
  strokeWidth: number;
}

type ConstructionRenderable = Blueprint | ConstructionSite;

type RectangleSpriteLike = Phaser.GameObjects.GameObject & {
  setPosition(x: number, y: number): unknown;
  setFillStyle(color: number, alpha?: number): unknown;
  setStrokeStyle(width: number, color?: number, alpha?: number): unknown;
};

export class ConstructionRenderer implements ObjectRenderer {
  readonly kinds = new Set([ObjectKind.Blueprint, ObjectKind.ConstructionSite]);

  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;
  private map: GameMap;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: GameMap) {
    this.scene = scene;
    this.layer = layer;
    this.map = map;
  }

  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.Rectangle {
    const size = getSpriteSize(obj);
    const style = this.getStyle(obj as ConstructionRenderable, color);
    const rect = this.scene.add.rectangle(cx, cy, Math.max(4, size.w - 4), Math.max(4, size.h - 4), style.fillColor, style.fillAlpha);
    rect.setStrokeStyle(style.strokeWidth, style.strokeColor, style.strokeAlpha);
    this.layer.add(rect);
    return rect;
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, color: number): void {
    if (!this.isRectangleSprite(sprite)) {
      return;
    }

    const center = getObjectPixelCenter(obj.cell, obj.footprint);
    const style = this.getStyle(obj as ConstructionRenderable, color);

    sprite.setPosition(center.x, center.y);
    sprite.setFillStyle(style.fillColor, style.fillAlpha);
    sprite.setStrokeStyle(style.strokeWidth, style.strokeColor, style.strokeAlpha);
  }

  private getStyle(obj: ConstructionRenderable, color: number): ConstructionVisualStyle {
    if (hasConstructionOccupants(this.map, obj)) {
      return {
        fillColor: WARNING_FILL,
        fillAlpha: 0.3,
        strokeColor: WARNING_STROKE,
        strokeAlpha: 0.98,
        strokeWidth: 2,
      };
    }

    if (obj.kind === ObjectKind.Blueprint) {
      return {
        fillColor: color,
        fillAlpha: 0.28,
        strokeColor: scaleColor(color, 1.2),
        strokeAlpha: 0.95,
        strokeWidth: 2,
      };
    }

    const progressAlpha = Math.min(0.46, 0.34 + obj.buildProgress * 0.12);
    return {
      fillColor: color,
      fillAlpha: progressAlpha,
      strokeColor: scaleColor(color, 0.82),
      strokeAlpha: 0.95,
      strokeWidth: 2,
    };
  }

  private isRectangleSprite(sprite: Phaser.GameObjects.GameObject): sprite is RectangleSpriteLike {
    return 'setPosition' in sprite && 'setFillStyle' in sprite && 'setStrokeStyle' in sprite;
  }
}

export const constructionRendererStyleTokens = {
  warningStroke: WARNING_STROKE,
  warningFill: WARNING_FILL,
} as const;
