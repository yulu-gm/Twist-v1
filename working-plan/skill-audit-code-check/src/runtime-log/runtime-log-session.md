# 审计报告: src/runtime-log/runtime-log-session.ts

## 1. 漏做需求 (Missing Requirements)

- [结论]: 未发现明显问题。
- [说明]: 在 `oh-code-design/` 与 `oh-gen-doc/` 中未检索到针对「运行日志会话、`runId`、单例、`flush` 批量策略」的专项条文，无法将本文件与具体策划条款逐条对照并认定「应做未做」。
- [相邻设计（仅供参考，不构成对本文件的硬性验收）]: `oh-code-design/实体系统.yaml` 中「读取投影层」写明为 UI、调试视图提供只读投影（约第 29–31 行）；`oh-code-design/需求系统.yaml` 中「需求投影层」写明为 UI 和调试工具输出可读状态（约第 26–28 行）。上述描述指向**领域侧投影**，而非本文件所承担的「开发态 HTTP 批 sink + 内存面板 store」管道，故不宜据此推断本会话必须实现何种 `runId` 或多 Tab 语义。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [结论]: 未发现 `mock` / 明显临时分支 / `TODO` 等典型无用兼容代码。
- [备注]: 第 39 行 `FALLBACK_RUN_ID` 使用 `Date.now().toString(36)` 于模块加载时固定，配合第 41–42 行模块级 `sequence`，在单例语义下可工作；若未来多会话或多窗口分析需要区分 run，属产品/工具链需求而非当前文件中的「兼容层堆积」。

## 3. 架构违规 (Architecture Violations)

- [指控]: 第 1 行从 `../ui/runtime-debug-log-store` 引入并创建内存 store，使 `src/runtime-log` 对 `src/ui` 产生编译期依赖，依赖方向与常见分层（表现层依赖基础设施/领域，而非基础设施反向依赖 UI 目录下的实现）相反。
- [依据]: `oh-code-design/UI系统.yaml`「分层」约定界面各层通过订阅等领域只读数据完成展示（约第 13–25 行）；「接口边界」约定输入来自交互、行为、时间、地图、实体等系统（约第 80–85 行）。运行日志管道若默认绑定某一 UI 包内 store 实现，易与「UI 消费只读数据、底层不反向挂靠 UI 实现模块」的边界意图冲突，并增加循环依赖风险（`runtime-log` ↔ `ui` 已通过 `runtime-debug-log-store` 与 `runtime-log` 类型互引形成事实上的耦合网）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0302]: 将 `RuntimeDebugLogStore` 类型与 `createRuntimeDebugLogStore` 迁至中性模块（例如 `runtime-log` 内 `store` 子文件或 `shared`），由 `ui` 仅消费类型或传入实现了接口的实例，从而去掉 `runtime-log-session.ts` 对 `../ui/` 的直接 import。
- [行动点 #0303]: 在仍保留单例的前提下，将 `runId` 生成策略与 dev server 启动协商或 `crypto.randomUUID()` 等方案对齐（若后续验收要求多 Tab / 多 run 区分），避免将「模块加载时刻」与「分析会话边界」混为一谈。