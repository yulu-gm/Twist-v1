# scene-hud 系统入口

## 系统职责摘要

`scene-hud` 负责 HUD、状态卡、按钮和场景内信息展示，目前标准文档已登记，实现仍待后续 routed aidoc 落地。

## 标准文档

- `docs/ai/system-standards/scene-hud.md`

## 当前关键实现文件

- 暂无已登记实现文件

## 当前关键测试文件

- 暂无已登记测试

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- 暂无 routed aidoc；新增 HUD 或按钮前先补 routed aidoc

## 何时必须回填

- 新增 HUD、状态卡、按钮或场景信息展示时，必须先补 routed aidoc。
- 若实现文件、测试文件或场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 若信息展示改变玩家路径或跨系统反馈，必须补充 `docs/ai/integration/`。

