# 审计：`src/runtime-log/`

**任务**：T-17。本文仅产出审计结论，不涉及代码修改。

---

## 一句结论

`src/runtime-log/` **没有**形成「业务 mock 与真实数据」的双轨；它是**开发期可观测性**（内存面板 + 可选 NDJSON 落盘），与 `oh-gen-doc/UI系统.yaml` 中的玩家向 HUD **无逐条可对齐条款**。**当前 oh 未覆盖运行时可观测性管道**，下文结论主要基于代码推断。

---

## 一、概述与审计范围

审计目录：`src/runtime-log/`（`runtime-log.ts`、`runtime-log-session.ts`、`runtime-log-session-logger.ts`、`runtime-log-dev-server.ts`、`runtime-log-dev-client.ts`）。关注点：**事件模型是否清晰**、**是否夹杂仅早期调试 / Vite 开发服专用的分支与产物**、**与产品文档中的「可观测性」表述是否可比**。

**对照文档**：`oh-gen-doc/UI系统.yaml`（[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml)）。该文件主要描述菜单、工具、地图主画面、**玩家可见**的状态与进度反馈等；**未定义**开发者调试面板、运行时 NDJSON 落盘、AI/工作流内部诊断字段等。因此：**当前 oh 文档未覆盖「运行时可观测性 / 调试日志管道」条款**，下文若讨论与 oh 的关系，仅将 UI 文档中的「状态反馈」作为**玩家层**旁证；**本审计关于日志管线、类别与落盘策略的结论均基于代码推断**，避免与 oh 强行对齐。

---

## 二、人话：这套模块在解决什么问题

运行时日志层做三件事：**统一一条「带序号、时间、可选 tick、类别、verbosity、消息与 detail」的结构化事件**；**把事件喂给内存里的调试面板 store**（有条目上限，支持搜索）；在 **Vite `serve` + development 且非 release** 时，**额外通过 HTTP 批处理推到本地开发中间件**，由 Node 端 **append 到 `logs/dev/*.ndjson`**。  
`main.ts` 在启动时打一条 `Runtime.Session` 事件，并在页面卸载时 `flush`；`GameScene` 在 tick 后把 AI 决策摘要、工作生命周期事件等写入同一会话，并驱动 HUD 里的调试面板展示与暂停过滤。  
**与玩家 HUD（进度条、菜单）不同**：这是 **工程 / 设计调试用** 的第二条信息通道；`oh-gen-doc/UI系统.yaml` 里的进度条、状态图标属于**正式玩法反馈**，不应与 `AI.Decision` 类日志混为一谈。

---

## 三、与 `oh-gen-doc/UI系统.yaml` 的旁证对照（不强行对齐）

| YAML 语义块 | 与 `src/runtime-log/` 的关系 |
|-------------|-------------------------------|
| 状态反馈 · 小人状态 / 进度条 | **玩家可见**表现，由渲染与 HUD 承担；runtime-log **不参与**正式进度条绘制。 |
| 地图界面 · 显示内容 | 同上，属主场景渲染；runtime-log 仅在调试面板中展示**文本化**事件列表，**未在 YAML 中需求化**。 |
| 菜单 / 选区 / 蓝图 | 与日志模块**无直接条款**；不存在「必须记录某类 log」的策划约束。 |

**结论**：文档与代码在此维度 **不具备可逐条验收的对应关系**；将 runtime-log 视为 **oh 外的开发支撑设施** 更贴切。

---

## 四、代码结构与分叉行为（是否「仅调试 mock」）

1. **核心类型**（`runtime-log.ts`）：`RuntimeLogVerbosity`、`RuntimeLogCategory`（含枚举式字面量 + `(string & {})` 扩展）、`RuntimeLogEvent` / `RuntimeLogEventInput`、`RuntimeLogPanelEntry`；`createRuntimeLogEvent` 合并 `searchText`；`formatRuntimeLogDetail` / `runtimeLogEventToPanelEntry` 服务 UI 展示。
2. **会话**（`runtime-log-session.ts`）：进程内**单例** `getRuntimeLogSession()`；`runId` 默认为 `run-${Date.now().toString(36)}`；绑定 `createRuntimeDebugLogStore({ limit: 800 })` 与 `createRuntimeLogSessionLogger`。**仅当**编译期 `__TWIST_RUNTIME_LOG_DEV_SERVER__ === true` 时创建 `createRuntimeLogDevHttpBatchSink` 且 `enabled: true`；否则无 HTTP 批量 sink，但 **UI sink 仍始终写入内存 store**（日志仍会进调试面板）。
3. **logger**（`runtime-log-session-logger.ts`）：同步调用 `uiSink`；异步批：按 `flushSize` / `flushIntervalMs` 合并后调用 `asyncBatchSink.writeBatch`。
4. **Vite 侧**（`vite.config.ts` 引用 `runtime-log-dev-server.ts`）：`shouldEnableRuntimeLogDevServer` = `serve` + `development` + 非 release；`define` 注入 `__TWIST_RUNTIME_LOG_DEV_SERVER__`；挂载 `createRuntimeLogDevMiddleware`，处理 `POST /__runtime-log/start|batch|flush`。
5. **客户端 sink**（`runtime-log-dev-client.ts`）：向 `` `{endpoint}{/start|/batch|/flush}` `` POST JSON；首次写前确保 `start`。
6. **服务端落盘**：`logs/dev/{iso-时间戳}-{runId}.ndjson`，按批 `appendFile`。

**分叉总结**：HTTP + NDJSON **仅为开发服链路**；release / build 路径下中间件不启用、define 为 false。**并非**「两套完全重复的事件模型」，而是 **同一事件形态，可选第二存储（磁盘）**。内存面板在运行时始终可用，属于**常驻调试能力**，与 oh 是否要求「正式版可关面板」未在文档中定义。

---

## 五、尚不明确与结论

1. **产品是否允许正式包保留内存调试面板与完整 `detail`（含大块结构化 trace）**：oh 未写；若将来要求发布版零调试暴露，需在 **入口或构建** 侧另做开关（当前未在 `src/runtime-log` 内区分）。
2. **`RuntimeLogCategory` 的开放字符串**：便于扩展，但缺少与 oh / 验收的**命名空间约定**，长期可能堆积临时类别名。
3. **与 headless**：`src/headless/sim-debug-trace.ts` 复用 `createRuntimeLogEvent` 类型，但不走 `getRuntimeLogSession`；**浏览器内调试日志**与 **无头 trace 结构** 平行存在，是否统一观测模型留给后续设计。

**总判**：`src/runtime-log/` **没有**表现成「两套互斥的 mock 与真值逻辑」；主要是 **开发服落盘 + 常驻面板** 的组合。夹杂「早期调试」的痕迹主要体现在 **`__TWIST_RUNTIME_LOG_DEV_SERVER__` 条件化的 HTTP sink** 与 **NDJSON 文件** 上，属于**明确的 dev-only 分支**，而非业务 mock 数据层。与 `oh-gen-doc/UI系统.yaml` **无直接可观测性条款可对齐**，故不将现有实现判为「违反 oh」，也**不建议**把面板字段强行映射到 YAML 条目。

---

## 问题清单

| # | 摘要 | 类型 | 说明 / 路径 |
|---|------|------|-------------|
| R1 | oh **未覆盖**开发者运行时日志 / 面板 / NDJSON | **文档缺口** | 已在上文写明；验收与策划若需要可观测性需求，应 **增补独立文档**，而非沿用 UI 系统 YAML 的「状态反馈」段落。 |
| R2 | 内存调试面板与 **800 条**环形缓冲 | **能力边界** | `runtime-log-session.ts` 固定 `DEFAULT_LIMIT = 800`；长局或高频 AI 日志可能挤掉早期条目，**与「完整复盘」无关**，属设计取舍。 |
| R3 | `detail` 可含 **整坨** `pawnDecision` 等 | **体量 / 敏感** | `GameScene` 写入大块对象；面板 `detailText` 为 JSON 字符串；dev NDJSON 同步放大。**若需瘦身或分级 verbosity**，需在上层调用点约束，非本目录单独问题。 |
| R4 | `RuntimeLogCategory` 含 `(string & {})` | **类型松散** | `runtime-log.ts` 允许任意类别字符串；一致性依赖约定，无编译期枚举全集。 |
| R5 | 单例 `runId` 与页面生命周期绑定 | **语义** | `FALLBACK_RUN_ID` 在首次 `createSession` 时固定；刷新页面即新 run；与 **多标签页多文件** 行为符合直觉，但与「多次冷启动同页内换 run」未暴露 API。 |
| R6 | `enabled` 与 `uiSink` 不对称 | **行为注意** | `createRuntimeLogSessionLogger` 中 `enabled` 只影响 **asyncBatchSink**；`uiSink` **始终**在 `log()` 时调用（只要传入）。开发关 HTTP 时面板仍会涨——符合当前代码，但命名上易误读「enabled=关全盘」。 |

---

## 备注（构建）

编写本报告时执行 `npx tsc --noEmit`，仓库内仍存在 **与 `src/runtime-log/` 无关的既有报错**；本次任务 **仅新增** 本 Markdown，**未修改** TypeScript 源码。
