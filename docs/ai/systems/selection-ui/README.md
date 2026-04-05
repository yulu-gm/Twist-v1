# selection-ui 系统入口

## 系统职责摘要

`selection-ui` 负责选中、高亮、焦点切换和目标对象切换反馈，目前标准文档已登记，实现仍待后续 routed aidoc 落地。

## 标准文档

- `docs/ai/system-standards/selection-ui.md`

## 当前关键实现文件

- 暂无已登记实现文件

## 当前关键测试文件

- 暂无已登记测试

## 当前接入场景文件

- `src/scenes/GameScene.ts`（格上 **工具点格** 的 mock 任务标记为点击反馈，规格见 **scene-hud** `2026-04-05-mock-task-markers-on-grid.md` 与集成 `2026-04-05-mock-task-markers-on-grid.md`）

## 最新/历史 aidoc

- 暂无本系统独立 routed aidoc；若将「选中格 / 指令目标」提升为一等选择模型，先补 aidoc 再登记实现文件

## 何时必须回填

- 新增选中、高亮、焦点或目标切换交互时，必须先补 routed aidoc。
- 若实现文件、测试文件或场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 若玩家路径发生变化，必须补充 `docs/ai/integration/`。

