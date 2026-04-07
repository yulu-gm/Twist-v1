# 审计报告: src/runtime-log/runtime-log-dev-client.ts

## 1. 漏做需求 (Missing Requirements)

- 在 `oh-code-design/` 与 `oh-gen-doc/` 中未检索到针对「开发态 RuntimeLog HTTP 批量上报」「`createRuntimeLogDevHttpBatchSink`」或同义可观测性管道的条目；与仓库内 [`working-plan/remain-old-code-check/src-runtime-log.md`](../../../remain-old-code-check/src-runtime-log.md) 的结论一致：**策划事实源未需求化该能力**，故无法按 YAML 逐条判定「漏做」。

- [补充 / 扩展缺口]: 服务端 `start` 响应可含 `runId`、`filePath`（见 `runtime-log-dev-server.ts` 中 `writeJson` 与 `startRun` 返回值），本客户端在 `readJson` 后**既不校验 `ok` 字段也不消费 `filePath`**。若未来文档要求「调试面板展示本次 NDJSON 落盘路径」，当前实现未承接该信息；在现行文档空白前提下记为**潜在扩展点未实现**，而非已发布需求遗漏。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无业务 Mock、`TODO` 或死分支；`fetchImpl` 可选注入用于测试与替换实现，属合理依赖注入。

- [补充说明]: `readJson` 参数类型写成 `Response | { json: () => Promise<RuntimeLogResponse> }` 是为配合 Vitest 里简化的 fetch mock（见 `tests/runtime-log-dev-client.test.ts`），**非**面向生产的双轨兼容逻辑；与「旧系统孤岛」类技术债不同。

## 3. 架构违规 (Architecture Violations)

- 未发现明显违反 `oh-code-design` 中游戏域分层的情况：本文件仅依赖 `./runtime-log-session-logger` 的类型与 `./runtime-log` 的事件类型，**不**反向依赖 UI 或场景层，职责为「`RuntimeLogAsyncBatchSink` 的 HTTP 适配器」。

- [风险说明（文档外卫生）]: `endpoint` 由调用方传入，模块本身不限制必须为同源或 `/__runtime-log`；实际约束依赖 `runtime-log-session.ts` 与 Vite 中间件契约及 `__TWIST_RUNTIME_LOG_DEV_SERVER__` 构建开关。`oh-code-design/UI系统.yaml` **未**描述该 HTTP 通道；将其归为**工程内建开发设施**，需在发布与安全规范中保证生产包不启用该路径，而非单凭游戏 YAML 验收。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0293]: 若需与中间件演进对齐，在工程文档或注释中固定契约：`POST {endpoint}/start|batch|flush`、JSON 字段与 `runtime-log-dev-server` 中 `RuntimeLogDevRequest` 一致，并约定 `batch` 在 `events.length === 0` 时由客户端跳过（本文件已实现），与服务端空批行为一致。
- [行动点 #0294]: 增强失败可观测性：`response.ok` 为 false 时除抛出外可附带 `response.status` 或 `await response.text()` 摘要（需注意体积分支），便于区分 4xx/5xx、CORS 与网络错误；当前错误信息仅为 `request failed for ${path}`。
- [行动点 #0295]: 若产品确认要暴露落盘路径，在 `ensureStarted` 链上解析 `start` 的 JSON，将 `filePath` 经会话层写入调试 UI 或日志元数据，并届时在 `oh-gen-doc`/`oh-code-design` 中增补可观测性条款以便验收。

---

## 行动点落地记录（Worker / AP-0294、AP-0295）

### AP-0294（失败可观测性）

- **已核对**：原先 `!response.ok` 时仅 `request failed for ${path}`。
- **已修复**：`post` 在失败分支 `await response.text()`，正文截断至 512 字符后拼入 `Error` 消息，并包含 `HTTP ${status}`，便于区分 4xx/5xx 与错误体（如 dev-server 返回的 JSON）。
- **涉及文件**：`src/runtime-log/runtime-log-dev-client.ts`；`tests/runtime-log-dev-client.test.ts`（失败路径断言）。

### AP-0295（`filePath` → 会话 → 调试 UI）

- **已核对**：审计建议为条件式（产品确认后暴露）；工程上已实现最小闭环，便于开发态对照 NDJSON 文件。
- **已修复**：
  - `createRuntimeLogDevHttpBatchSink` 增加可选 `onStartAck`，在 `start` 成功且 JSON 解析成功后回调（携带服务端返回的 `filePath` / `runId`）。
  - `runtime-log-session` 在启用 dev HTTP sink 时注册 `onStartAck`，写入可变 `devNdjsonFilePath`，并提供 `setOnDevNdjsonPathReady` 供场景在路径就绪后刷新面板。
  - `GameScene` 注册回调 `syncDebugPanel`；`HudManager` / `index.html` 在调试面板内展示「NDJSON 落盘：…」（无路径时隐藏）。
- **未纳入（按审计原文）**：`oh-gen-doc` / `oh-code-design` 的可观测性条款增补仍待策划侧确认后单独提交。
- **涉及文件**：`src/runtime-log/runtime-log-dev-client.ts`、`src/runtime-log/runtime-log-session.ts`、`src/ui/hud-manager.ts`、`src/scenes/GameScene.ts`、`index.html`、`tests/runtime-log-dev-client.test.ts`。

**验证**：仓库根 `npx tsc --noEmit` 退出码 0；`npx vitest run tests/runtime-log-dev-client.test.ts` 通过。