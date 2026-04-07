# 审计报告: src/game/interaction/session-manager.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `InteractionSession.state` 声明了 `"previewing"`，但仓库内无任何代码将状态设为 `previewing`，也无基于该状态的分支逻辑；会话始终从 `collecting` 经 `commitSession` 直接进入 `committed`。
- [依据]: `oh-code-design/交互系统.yaml` 中「反馈协调层」职责包含维护预览/虚影等反馈状态，「核心数据」下「输入会话」含与采集过程相关的语义；当前类型未承载设计文档中「输入会话」所列关键字段（起始位置、当前指针位置、命中格集合、是否已确认），若本类型意图对应设计中的「输入会话」，则与 `oh-code-design/交互系统.yaml` 中「核心数据 → 输入会话 → 关键字段」不一致；若仅为「模式级生命周期会话」，则 `previewing` 与上述分层中的预览阶段未在代码层闭合。
- [指控]: `commitSession` 在调用 `mode.explainRule` 后直接定稿命令，未体现 `oh-code-design/交互系统.yaml`「交互意图层」中「在提交前执行基础校验与过滤」的独立步骤（校验完全内聚于各模式的 `explainRule` 或调用方，设计中的意图层职责在模块边界上未单独体现）。
- [依据]: 见 `oh-code-design/交互系统.yaml` 中「分层 → 交互意图层 → 职责」与「模块 → 交互命令生成器」相关描述。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `makeCommandId` 在缺少 `crypto.randomUUID` 时使用 `Date.now` 与 `Math.random` 拼接 id；属运行环境兼容，非业务 Mock。
- [影响]: 极低碰撞风险场景下可接受；与「无用兼容」关系不大，仅作客观记录。
- [指控]: `resetInteractionSessionIdSequence` 标注为测试用，但通过 `session-manager` / `interaction/index` 进入公共导出面，生产包体亦可见该 API。
- [影响]: 测试隔离依赖模块级可变计数器，易造成「仅测试应重置的全局序号」与业务 API 混排；不属于典型死代码，但增加误用面。
- 其余: 未发现 `mock`/`temp`/`TODO` 残留或仅为兼容旧系统而无调用方的分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 未发现本文件越权修改地图/实体/UI 等跨子系统核心数据；仅变更传入的 `InteractionSession` 的可变字段（`state`、`cancelled`），边界相对清晰。
- [依据]: 与 `oh-code-design/交互系统.yaml`「接口边界」中输出面向地图/实体/建筑/UI 的约束相比，本文件仅产出 `DomainCommand`，不直接调用下游系统，未观察到明显分层越权。
- [轻微观测]: `oh-code-design/交互系统.yaml` 将「模式注册表」「选区会话管理器」「笔刷会话管理器」「交互命令生成器」列为并列模块；本文件将「会话生命周期 + 取模式 + explain + 命令定稿」集中实现，与文档中的模块拆分粒度不完全一一对应，属组织结构差异而非明确的单向依赖违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0111]: 要么实现 `previewing` 状态及与反馈层/采集层的过渡（与 `oh-code-design/交互系统.yaml` 反馈与输入会话语义对齐），要么从类型与文档中移除该枚举值，避免「有类型无行为」。
- [行动点 #0112]: 明确 `InteractionSession` 在设计中的定位：若对应「输入会话」，则补充或与选区/笔刷模块协同暴露设计中的关键字段；若仅为模式会话，建议在注释或模块说明中与 `oh-code-design` 的「输入会话」区分命名，减少歧义。
- [行动点 #0113]: 若需严格贴合「交互意图层」校验职责，可在 `commitSession` 与 `explainRule` 之间增加可复用的校验/过滤钩子或独立小模块，而非仅依赖各模式自行实现。
- [行动点 #0114]: 将 `resetInteractionSessionIdSequence` 限制在测试入口（例如测试 setup 通过动态 import 或 `@internal` 约定），避免与对外 API 混排，或改用可注入的 id 生成策略以消除模块级可变全局状态。