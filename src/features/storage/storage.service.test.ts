/**
 * @file storage.service.test.ts
 * @description 仓库存储服务单元测试
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createBuilding } from '../building/building.factory';
import {
  canWarehouseAcceptItem,
  storeInWarehouse,
  withdrawFromWarehouse,
  summarizeWarehouseInventory,
  getWarehouseFreeCapacity,
} from './storage.service';

function makeWarehouse() {
  const defs = buildDefDatabase();
  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell: { x: 2, y: 2 },
    mapId: 'main',
    defs,
  });
  return { defs, warehouse };
}

describe('warehouse storage service', () => {
  it('stores, withdraws and summarizes warehouse inventory', () => {
    const { defs, warehouse } = makeWarehouse();

    expect(canWarehouseAcceptItem(warehouse, defs, 'wood')).toBe(true);
    expect(storeInWarehouse(warehouse, 'wood', 12)).toEqual({ storedCount: 12, remainingCount: 0 });
    expect(storeInWarehouse(warehouse, 'stone_block', 7)).toEqual({ storedCount: 7, remainingCount: 0 });
    expect(withdrawFromWarehouse(warehouse, 'wood', 5)).toEqual({ takenCount: 5, remainingCount: 0 });

    expect(summarizeWarehouseInventory(warehouse, defs)).toEqual({
      totalCount: 14,
      typeCount: 2,
      entries: [
        { defId: 'stone_block', label: 'Stone Block', count: 7, color: 0x999999 },
        { defId: 'wood', label: 'Wood', count: 7, color: 0x8B4513 },
      ],
    });
  });

  it('refuses to accept items beyond capacity and reports remaining count', () => {
    const { warehouse } = makeWarehouse();

    expect(getWarehouseFreeCapacity(warehouse)).toBe(160);
    const result = storeInWarehouse(warehouse, 'wood', 200);
    expect(result).toEqual({ storedCount: 160, remainingCount: 40 });
    expect(getWarehouseFreeCapacity(warehouse)).toBe(0);

    const overflow = storeInWarehouse(warehouse, 'stone_block', 10);
    expect(overflow).toEqual({ storedCount: 0, remainingCount: 10 });
  });

  it('removes inventory entry when fully withdrawn', () => {
    const { warehouse } = makeWarehouse();
    storeInWarehouse(warehouse, 'wood', 5);
    expect(withdrawFromWarehouse(warehouse, 'wood', 5)).toEqual({ takenCount: 5, remainingCount: 0 });
    expect(warehouse.storage!.inventory.wood).toBeUndefined();
    expect(warehouse.storage!.storedCount).toBe(0);
  });

  it('rejects non-haulable items', () => {
    const { defs, warehouse } = makeWarehouse();
    // 'wall_wood' is a building def, not haulable item — canWarehouseAcceptItem looks up items
    // Use a fictitious unknown item id to ensure rejection path
    expect(canWarehouseAcceptItem(warehouse, defs, 'nonexistent_item')).toBe(false);
  });
});
