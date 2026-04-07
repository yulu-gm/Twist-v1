# 审计报告: src/runtime-log/runtime-log-dev-server.ts

## 1. 漏做需求 (Missing Requirements)
- 未发现明显问题。`oh-code-design/` 与 `oh-gen-doc/` 下九份系统 YAML（实体、需求、行为、时间、地图、建筑、工作、交互、UI）均未包含「开发服 HTTP 中间件接收运行时日志并写入 NDJSON」的专项需求或状态机步骤，故无法将本文件行为与策划/架构文档逐条对齐并认定文档级漏做。
- 补充说明（非文档指控）：`createRuntimeLogDevMiddleware` 对 JSON 体仅作 `JSON.parse` 与 `action` 字符串分支，未校验 `action` 是否属于 `start` | `batch` | `flush`；非法 `action` 会落入末尾分支并当作 `flush` 处理（见约第 131–132 行）。若未来在 `oh-gen-doc` / `oh-code-design` 中补充开发观测接口契约，应明确要求非法 action 返回 4xx 而非静默走 flush。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- 未发现明显问题。未发现 `mock`、`temp`、`TODO` 或仅为兼容已移除系统而存在的死分支；`CreateRuntimeLogDevFileStoreOptions` 中的 `now` / `randomId` 为可注入依赖，便于测试，属于合理设计而非无用兼容。

## 3. 架构违规 (Architecture Violations)
- 未发现明显问题。`oh-code-design` 中的分层与模块边界针对游戏运行时子系统（如 `UI系统.yaml` 的界面结构/状态/呈现/动作转发等），未将 Vite 开发中间件、Node `fs` 落盘纳入须遵守的架构图；本文件定位为开发期工具链，与「UI 不直接承担领域规则」等条款无直接冲突。需注意：该文件依赖 `vite` 的 `Connect` 类型与 `node:fs/promises`，须由构建配置保证不进入纯浏览器包，否则会产生环境错配风险；此属工程约束，当前 YAML 中无对应违规定义。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0296]: 为 `readJsonBody` 增加请求体大小上限（或流式截断），降低开发局域网下误用/恶意 POST 导致内存占满的风险。
- [行动点 #0297]: 在 middleware 内显式校验 `payload.action`，对未知值返回 400（如 `{ error: "invalid-action" }`），避免与 `flush` 语义混淆。
- [行动点 #0298]: `writeBatch` 在未知 `runId` 时会抛错并经由 catch 返回 500（约第 72–75、133–135 行）；`flushRun` 对未知 `runId` 则静默成功（约第 80–83 行）。若希望客户端对称地发现「未 start 的 run」，可对 flush 分支在 `runs` 中无记录时返回 404 或明确错误体。