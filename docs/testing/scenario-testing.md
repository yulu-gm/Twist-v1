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
# 默认端口为 5173（可通过环境变量 VITE_PORT 覆盖）
# http://localhost:5173/scenario-select.html              ← 场景选择页面
# http://localhost:5173/scenario-select.html?scenario=eating  ← 进入指定场景工作台
```

### 工作台使用流程

进入 `scenario-select.html` 后：

1. 先选择场景卡片
2. 进入 `ready` 状态的工作台（不自动开跑）
3. 手动点击 `Start` 开始运行
4. 可在右侧工作台使用以下控件：
   - `Pause` — 暂停执行
   - `1x / 2x / 3x` — 切换 simulation 速度
   - `+1 tick` — 手动步进 1 tick（仅 paused 下可用）
   - `+10 ticks` — 手动步进 10 ticks（仅 paused 下可用）
   - `Run to Next Gate` — 运行到下一个 waitFor/command 完成点（仅 paused 下可用）
   - `Restart` — 销毁当前 session 并重新回到 ready
   - `Back to Scenarios` — 返回场景选择页（不刷新页面）

带 `?scenario=<id>` 的 URL 刷新后会自动进入对应场景的 `ready` 状态，不会自动开跑。

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
  visual-runner/          # 可视运行器和工作台
    scenario-select-main.ts           # 入口 — 启动工作台
    scenario-workbench-app.ts         # 页面壳层 — selector/workbench 模式协调
    visual-scenario-controller.ts     # session 生命周期拥有者
    scenario-hud.tsx                  # 工作台 HUD 控制面板
    shadow-runner.ts                  # visual/headless 快照对比
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
