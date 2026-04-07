/**
 * {@link seedInitialTreesAndResources} 的默认数量区间。
 * 策划在 oh-gen-doc 地图初始化中细化规则时，优先在此对齐，避免散落在播种逻辑内。
 */

export const initialSeedEntityCounts = {
  /** 树木棵数：treeMin + floor(rng() * treeRngSpan)，即闭区间 8–12。 */
  treeMin: 8,
  treeRngSpan: 5,
  /** 地面食物资源个数：resourceMin + floor(rng() * resourceRngSpan)，即闭区间 3–5。 */
  resourceMin: 3,
  resourceRngSpan: 3
} as const;
