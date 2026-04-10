import { describe, expect, it } from 'vitest';
import { getObjectPixelCenter, getSpriteSize } from './render-utils';
import { ObjectKind } from '../../core/types';

describe('render-utils multi-cell helpers', () => {
  it('computes the pixel center from the full footprint instead of the anchor cell only', () => {
    expect(getObjectPixelCenter({ x: 4, y: 7 }, { width: 1, height: 2 })).toEqual({
      x: 4 * 32 + 16,
      y: 7 * 32 + 32,
    });
  });

  it('returns a full multi-cell pixel size for beds and other furniture', () => {
    expect(getSpriteSize({
      id: 'obj_bed',
      kind: ObjectKind.Building,
      defId: 'bed_wood',
      mapId: 'main',
      cell: { x: 4, y: 7 },
      footprint: { width: 1, height: 2 },
      tags: new Set(),
      destroyed: false,
    })).toEqual({ w: 32, h: 64 });
  });
});
