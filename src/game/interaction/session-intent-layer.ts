import type { ModeExplainInput } from "./mode-registry";
import { coordKey, type GridCoord } from "../map/world-grid";

/**
 * 在调用各模式 `explainRule` 之前对采集结果做意图层侧的可复用过滤/规范化。
 * 模式专属语义仍由各 `explainRule` 负责；此处单独体现「提交前基础处理」步骤。
 */
export type IntentLayerExplainInputFilter = (input: ModeExplainInput) => ModeExplainInput;

/** 按格键去重并保留首次出现顺序，避免重复坐标进入领域命令载荷。 */
export function dedupeExplainCells(input: ModeExplainInput): ModeExplainInput {
  const seen = new Set<string>();
  const cells: GridCoord[] = [];
  for (const c of input.cells) {
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    cells.push(c);
  }
  return { cells, modifier: input.modifier };
}

/** 默认意图层过滤器链（可在此处串联更多与模式无关的规范化步骤）。 */
export const defaultIntentLayerExplainInputFilter: IntentLayerExplainInputFilter = dedupeExplainCells;
