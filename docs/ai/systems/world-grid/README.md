# world-grid 系统入口

## 系统职责摘要

`world-grid` 负责地图格子尺寸、格坐标、邻格、边界、出生点和占用查询，是本项目模拟层的地图基础。

## 标准文档

- `docs/ai/system-standards/world-grid.md`

## 当前关键实现文件

- `src/game/world-grid.ts`

## 当前关键测试文件

- `tests/domain/world-grid.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md`

## 何时必须回填

- 修改格子尺寸、邻格、边界、出生点或占用判断时，必须同步更新 routed aidoc。
- 修改地图系统与其他系统的接口承诺时，必须补充 `docs/ai/integration/`。
- 若新增地图加载方式或系统定位方式，必须同步更新 `docs/ai/index/system-index.json`。

