# route-demand Skill 的 TDD

## 目的

确保 `route-demand` 不只是说明文字，而是在压力下也会稳定执行系统拆分、SubAgent 分派和文档汇总。

## 压力场景

### 场景 1：多系统混合需求

- 需求同时提到点选角色、状态面板和任务规划。
- 期望结果：拆出 `selection-ui`、`scene-hud`、`task-planning`，而不是写成一篇混合文档。

### 场景 2：单系统局部需求

- 需求只改变 HUD 的一个状态卡表现。
- 期望结果：仅创建 `scene-hud` aidoc，不额外拆出无关系统。

### 场景 3：UI-first 原型

- 需求强调先验证交互体验，底层逻辑未定。
- 期望结果：UI 系统先产出 acceptance/component 级 failing test，领域系统仅登记依赖或后续反推项。

### 场景 4：不同模板并存

- 多个系统有不同标准文档。
- 期望结果：每个 SubAgent 使用自己的模板，不套统一格式。

## 验证重点

- 是否读取了 `demand-router.md` 和 `system-registry.md`
- 是否为每个目标系统分配了独立 SubAgent
- 是否等所有 aidoc 返回后再写集成文档
- 是否把 fake/stub 明确记录到系统 aidoc
