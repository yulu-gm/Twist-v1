import { vi } from 'vitest';

const PHYSICAL_OCCUPANT_TAG = 'physical_occupant';

vi.mock('../../world/occupancy', () => ({
  PHYSICAL_OCCUPANT_TAG,
  getPhysicalOccupantsInFootprint(
    map: {
      spatial: { getInRect: (min: { x: number; y: number }, max: { x: number; y: number }) => string[] };
      objects: { get: (id: string) => { id: string; destroyed: boolean; tags: Set<string> } | undefined };
    },
    cell: { x: number; y: number },
    footprint?: { width: number; height: number },
    options?: { ignoreIds?: string[] },
  ) {
    const width = footprint?.width ?? 1;
    const height = footprint?.height ?? 1;
    const ignoreIds = new Set(options?.ignoreIds ?? []);
    const ids = new Set(
      map.spatial.getInRect(
        { x: cell.x, y: cell.y },
        { x: cell.x + width - 1, y: cell.y + height - 1 },
      ),
    );

    return Array.from(ids)
      .filter(id => !ignoreIds.has(id))
      .map(id => map.objects.get(id))
      .filter(
        (
          obj,
        ): obj is { id: string; destroyed: boolean; tags: Set<string> } => !!obj
          && !obj.destroyed
          && obj.tags.has(PHYSICAL_OCCUPANT_TAG),
      );
  },
  hasPhysicalOccupantsInFootprint(
    map: {
      spatial: { getInRect: (min: { x: number; y: number }, max: { x: number; y: number }) => string[] };
      objects: { get: (id: string) => { id: string; destroyed: boolean; tags: Set<string> } | undefined };
    },
    cell: { x: number; y: number },
    footprint?: { width: number; height: number },
    options?: { ignoreIds?: string[] },
  ) {
    const width = footprint?.width ?? 1;
    const height = footprint?.height ?? 1;
    const ignoreIds = new Set(options?.ignoreIds ?? []);
    const ids = new Set(
      map.spatial.getInRect(
        { x: cell.x, y: cell.y },
        { x: cell.x + width - 1, y: cell.y + height - 1 },
      ),
    );

    return Array.from(ids).some((id) => {
      if (ignoreIds.has(id)) return false;
      const obj = map.objects.get(id);
      return !!obj && !obj.destroyed && obj.tags.has(PHYSICAL_OCCUPANT_TAG);
    });
  },
}));

export { PHYSICAL_OCCUPANT_TAG };
