# 审计报告: src/scenes/game-scene-camera-controls.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 策划侧对「缩放与平移」未形成可逐条验收的正式规则，文档仍为占位或待确认状态；本文件实现了中键平移与指针中心滚轮缩放及 `MIN_ZOOM`/`MAX_ZOOM` 钳制，属于**在文档缺口下的工程自选方案**，无法对照 YAML 证明「已全部满足策划意图」。
- [依据]:
  - `oh-gen-doc/UI系统.yaml` → `地图界面` → `缩放与平移`: **待后续需求补充**。
  - `oh-code-design/UI系统.yaml` → `待确认问题`: **缩放与平移尚未明确，后续可能影响 UI 锚点与反馈布局**。

- [指控]: `onPointerDown` 经 `isMiddleButton` 同时认可 `middleButtonDown()` 与 `event.button === 1`，而 `onPointerMove` 仅依赖 `middleButtonDown()`。在极少数 Pointer Events / 合成事件不一致的环境下，可能出现「按下判定成立、移动阶段却不更新平移」的边缘行为；设计文档未要求此种兼容性，但从实现完整性上属于潜在缺口。
- [依据]: 无对应 YAML 条款（实现层健壮性问题，与文档「待补充」叠加时更难排查）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无 mock/temp/TODO、无未接入的旧分支）。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。本类仅操作 `Phaser` 主相机滚动与缩放，不向领域层提交命令；与 `oh-code-design/交互系统.yaml` 中「输入采集与模式逻辑分离」的精神一致（左键框选等由 `GameSceneFloorInteraction` 等另行处理，见 `GameScene.ts` 中先 `floorInteraction.bind()` 再 `cameraControls.bind()`）。`GameScene` 在 `SHUTDOWN` 时调用 `unbind()`，生命周期上无显式泄漏问题。

- **合规对照（非违规，供验收引用）**: `oh-acceptance/交互系统.yaml` 场景 `INTERACT-004` 的 `presentation` 写明默认观察状态下拖拽可能触发地图平移（若支持）且不产生领域命令；本实现的中键平移与该「视口操作、不改世界状态」的叙述方向一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0309]: 待策划在 `oh-gen-doc` / `oh-code-design` 中落地「缩放与平移」正式规则后，将键位、倍率、是否支持触控/触摸板、是否与网格对齐等写进文档，再反查本文件常量与行为是否一致。
- [行动点 #0310]: 将 `MIN_ZOOM`/`MAX_ZOOM` 与地图 `cellSizePx` 或 UI 最小可读尺度关联，降低 `oh-code-design/UI系统.yaml` 风险条款中「反馈互相遮挡/不可读」的概率。
- [行动点 #0311]: 在 `onPointerMove` 中与 `onPointerDown` 对齐中键判定（例如复用 `isMiddleButton` 或同等条件），消除 `middleButtonDown` 与 `event.button` 判断路径不一致的边缘情况。

## 行动点落地（bundle #14，AP-0310 / AP-0311）

- **AP-0310（已核对 → 已修复）**: `GameSceneCameraControls` 构造函数增加 `cellSizePx`，由 `GameScene` 传入 `this.worldGrid.cellSizePx`；`zoomLimitsForCellSize` 以 48px 格下原 0.4 / 2.75 为基准，按「格边在屏幕上的像素」推导 `minZoom`/`maxZoom` 并做合理钳制，滚轮缩放使用实例上的上下限。
- **AP-0311（已核对 → 已修复）**: `onPointerMove` 的中键判定改为与 `onPointerDown` 一致，复用 `isMiddleButton(pointer)`。