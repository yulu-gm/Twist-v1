/**
 * 工具 → 输入形态策略：与交互系统 YAML 中「框选 / 笔刷」对齐的薄层。
 */

/** 建造类使用笔刷轨迹；其余工具沿用矩形框选（单点即 1×1 矩形）。 */
export function interactionInputShapeForToolId(toolId: string): "rect-selection" | "brush-stroke" {
  return toolId === "build" ? "brush-stroke" : "rect-selection";
}
