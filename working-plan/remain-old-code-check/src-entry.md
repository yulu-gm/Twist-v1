# 审计：`src/main.ts`、`src/vite-env.d.ts`

对照文档：`oh-gen-doc/UI系统.yaml`（任务 T-18 指定；入口与 Vite 全局更多是**工程/可观测性基础设施**，该 YAML **未**单独描述浏览器引导与 Phaser 根实例，下文在「文档应然 vs 代码现状」中写明缺口）。联动阅读：场景侧复杂度见同目录 [`src-scenes.md`](src-scenes.md)；领域编排与世界 bootstrap 见 [`src-game-root.md`](src-game-root.md)。

---

## 一句结论

浏览器入口 **`src/main.ts` 极薄**：在挂到 `#app` 的 Phaser 根上只注册 **`GameScene`**，无第二套场景路由、无历史演示页或多入口分流；首屏即完整游戏场景。并行做两件事：**启动运行时日志会话**（首条 `Runtime.Session` 事件 + `beforeunload`/`pagehide` 时 `flush`），以及 **1280×720 基准画布 + `RESIZE` 居中缩放**。**`src/vite-env.d.ts`** 仅声明打包期注入的全局 `__TWIST_RUNTIME_LOG_DEV_SERVER__`，与同全局在 `src/runtime-log/runtime-log-session.ts` 内的重复 `declare` 并存。相对 `oh-gen-doc/UI系统.yaml`，**入口层既无「多余兼容挂载点」的典型老旧代码 smell，也缺乏文档对「调试日志 dev server、Phaser 引导」的明示**，属**实现领先或工程内建**与策划事实源之间的空白，而非入口文件本身堆砌 mock。

---

## 要解决什么问题（审计视角）

任务关注的是：**入口是否仍挂载演示路径、历史兼容分支或与产品无关的第二入口**，以免读者误判「真游戏从别处进」。本仓库中 **HTML 仅 `index.html` 一处**以 `<script type="module" src="/src/main.ts">` 加载应用；`main.ts` **不**再引入其它场景类型、不切换 hash 路由、不条件注册第二个 `Phaser.Scene`。

与 `oh-gen-doc/UI系统.yaml` 的交集主要在**间接层面**：UI 文档描述的是 HUD、地图画面与交互，**落地依赖** Phaser 父节点 `#app` 与后续在 **GameScene** 内创建的 DOM 叠层（详见 [`src-scenes.md`](src-scenes.md) 一句结论与各 renderer/HUD 小节）。**入口文件本身**不承担菜单或地图条款的兑现，审计价值在于：**确认没有第二条「秘密启动路径」**，并把 **runtime log + Vite define** 标成需与可观测性/交付边界对齐的横切 concern。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 对照 `oh-gen-doc/UI系统.yaml`

- **策划文档未写明的部分**：`UI系统.yaml` **未**描述「单页 Vite 入口」「Phaser.Game 构造参数」「开发态运行时日志 HTTP 批处理 sink」。当前实现中，这些由 **`main.ts` + `vite.config.ts` `define`** + `runtime-log-session` 协同完成，**不属于 UI 条目可直接验收的范畴**；若产品希望「交付版绝不打外部日志」，需在发布规范或 UI/工程文档中单独约定（而非仅凭现有 UI YAML）。
- **与 UI 体验弱相关的部分**：固定 `width`/`height` 与 `Phaser.Scale.RESIZE` + `CENTER_BOTH` 决定画布在 `#app` 内的缩放行为；`index.html` 将 `#app` 设为 `100%`×`100%`，与 **全屏容器 + 内容等比缩放**的常见模式一致。**`oh-gen-doc/UI系统.yaml`** 中「地图界面 · 缩放与平移」针对的是**相机/地图操作**，与 **根 Game 的 scale 模式** 是不同层次——入口层选择合理的 scale 配置，**与 scenes 报告里「文档写待补充而相机已实现」可并列阅读**（见 [`src-scenes.md`](src-scenes.md)）。

### `src/vite-env.d.ts` 与 Vite 契约

- **`__TWIST_RUNTIME_LOG_DEV_SERVER__`**：在 `vite.config.ts` 中由 `shouldEnableRuntimeLogDevServer` 决定，经 `define` 注入为布尔字面量；`vite-env.d.ts` 为 **IDE/ tsc 在浏览器源码侧**提供类型。实际消费逻辑在 **`src/runtime-log/runtime-log-session.ts`**（同一全局常量再次被 `declare`）。

---

## 代码里大致怎么走（main.ts 与 vite-env）

1. **`getRuntimeLogSession()`**：模块加载即拿单例；随后 **无条件** `log` 一条 `Runtime.Session` / `Display` 级别消息，`detail.source` 为 `"main.ts"`。
2. **`window` 监听**：对 `beforeunload` 与 `pagehide` 注册回调，在页面离开时 **`void runtimeLogSession.flush()`**（异步不打断卸载语义依赖运行时与 sink 实现）。
3. **`new Phaser.Game({...})`**：`parent: "app"` 与 `index.html` 中 `<div id="app">` 对应；`scene: [GameScene]` **唯一**场景类；`backgroundColor: "#171411"` 与页面深色背景接近。
4. **`export default game`**：供模块默认导出；当前仓库 **无**其它 TS 文件 `import` `main`（仅 HTML 侧加载），导出主要为惯例或未来扩展预留。
5. **`vite-env.d.ts`**：单条 `declare const __TWIST_RUNTIME_LOG_DEV_SERVER__: boolean`，与 Vite `define` 键一致；**不含** `/// <reference types="vite/client" />` 等扩展——若项目其它处依赖 Vite 客户端类型，可能由 tsconfig 路径或其它 `.d.ts` 覆盖（本任务仅审计本文件内容）。

---

## 尚不明确或需联动阅读

1. **运行时日志是否算产品能力**：与 `oh-gen-doc/UI系统.yaml` 未写条款一致，**dev server 日志管道**更接近工程工具；是否写入 oh、是否在 release 单文件中禁用，需产品与工程共同拍板（实现上已由 `TWIST_RELEASE` / `shouldEnableRuntimeLogDevServer` 等约束，细则见 `vite.config.ts` 与 `runtime-log` 目录；后续可有专文 `src-runtime-log.md`）。
2. **单场景策略的长期性**：当前仅 `GameScene`；若未来新增标题/加载场景，`main.ts` 的 `scene` 数组与启动顺序将成为产品入口契约，**与 [`src-scenes.md`](src-scenes.md) 中「YAML 场景热切换」等调试能力**是否合并路由，需单独设计。
3. **世界与玩家的权威数据源**：入口不碰 `WorldCore`；**bootstrap 与 orchestrator** 均在场景创建链路中，见 [`src-game-root.md`](src-game-root.md)「代码里大致怎么走」与 [`src-scenes.md`](src-scenes.md) 对 `bootstrapWorldForScene` 的描述。

---

## 问题清单

| # | 摘要 | 类型 | 涉及路径 / 说明 |
|---|------|------|----------------|
| E1 | **`__TWIST_RUNTIME_LOG_DEV_SERVER__` 在两处 `declare`**（`vite-env.d.ts` 与 `runtime-log-session.ts`） | **重复契约** | 单点声明更有利于「全局来源= Vite env」的认知；当前不导致编译错误，但增加改键时漏改风险。 |
| E2 | **应用入口、Phaser 引导、runtime log 会话生命周期** 未出现在 `oh-gen-doc/UI系统.yaml` | **文档缺口 / 工程内建** | 非「旧代码」问题；若需可交付说明，应另增工程或 UI 附录条款，避免仅靠代码推断。 |
| E3 | **`main.ts` 顶层副作用**（立即 `log`、注册 `window`）与 **ESM 单次执行** 假设绑定 | **环境假设** | 对当前「仅浏览器、仅 `index.html` 引一次」成立；若未来 Workers 或 SSR 复用模块需复查（低风险前瞻项）。 |
| E4 | **`export default game` 无 TS 引用方** | **可能冗余** | 与「薄入口」一致，导出或为惯例；若强制 tree-shaking/规范可评估是否保留（非老旧 mock）。 |

---

*本报告仅新增说明性 Markdown，未修改任何源码。*
