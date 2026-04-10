# Scenario Testing

## 概述

Twist-v1 的 simulation 场景测试体系，支持同源脚本在无头回归和可视化验收两种模式下运行。

## 运行无头回归

```bash
# 运行全部场景测试
npm run test:scenario

# 监视模式
npm run test:scenario:watch

# 运行单个场景
npx vitest run --config vitest.scenario.config.ts src/testing/headless/woodcutting.scenario.test.ts
```

## 打开可视化验收

```bash
# 方式 1：一键打开场景选择页面（推荐）
visual-test.bat

# 方式 2：npm 脚本打开选择页面
npm run scenario:visual:select

# 方式 3：直接打开指定场景
npm run scenario:visual

# 切换其他场景 — 修改 URL 参数
# http://localhost:3000/scenario-select.html              ← 场景选择页面
# http://localhost:3000/scenario-select.html?scenario=eating  ← 直接运行指定场景
# http://localhost:3000/scenario.html?scenario=stockpile-haul
# http://localhost:3000/scenario.html?scenario=blueprint-construction
```

## 已有场景

| ID | 标题 | 验证链路 |
|----|------|---------|
| `woodcutting` | 砍树 | command → designation → AI → work → 物品掉落 |
| `stockpile-haul` | 搬运进 Stockpile | stockpile 创建 → AI 搬运 → 物品放置 |
| `eating` | 进食 | needs 触发 → AI 选择进食 → 拾取 → 消费恢复 |
| `blueprint-construction` | 建造蓝图 | 蓝图放置 → 材料搬运 → 施工 → 建筑落地 |

## 目录结构

```
src/testing/
  scenario-dsl/           # DSL 类型和构造器
    scenario.types.ts
    scenario.builders.ts
  scenario-harness/       # Harness 和 checkpoint
    scenario-harness.ts
    checkpoint-snapshot.ts
  scenario-actions/       # 复用型业务动作
    setup-actions.ts
    player-actions.ts
    wait-conditions.ts
  scenarios/              # 业务场景定义
    woodcutting.scenario.ts
    stockpile-haul.scenario.ts
    eating.scenario.ts
    blueprint-construction.scenario.ts
  headless/               # 无头运行器和测试
    headless-scenario-runner.ts
    scenario-regression.test.ts
  visual-runner/          # 可视运行器和 HUD
    scenario-main.ts
    visual-scenario-controller.ts
    scenario-hud.tsx
    shadow-runner.ts
  scenario-registry.ts    # 场景注册表
```

## 添加新场景

1. 在 `src/testing/scenarios/` 下创建 `xxx.scenario.ts`
2. 使用 `createScenario()` 定义场景，步骤用业务语言表达
3. 在 `src/testing/scenario-registry.ts` 中注册
4. 在 `src/testing/headless/` 下创建测试文件
5. 运行 `npm run test:scenario` 验证

## 设计原则

- **场景优先**：以业务流程为测试主轴，不是零散的函数单测
- **同源脚本**：无头和可视模式使用同一份场景定义
- **业务级原语**：步骤文案用业务语言，适合 HUD 直接展示
- **可观察性内建**：运行过程中持续暴露当前步骤、等待条件、分歧
