# 审计报告: src/game/interaction/domain-command-types.ts

## 1. 漏做需求 (Missing Requirements)

- [结论]: 与 `oh-code-design/交互系统.yaml`「核心数据 → 交互命令」所列关键字段对照，本文件已覆盖：**命令类型**（`verb`）、**目标格集合**（`targetCellKeys`）、**目标实体集合**（`targetEntityIds`）、**来源模式**（`sourceMode`，内含 `InteractionSource` 与选区修饰，并扩展 `inputShape` 以区分框选/笔刷/单格，利于回放与验收）。未发现文档明确要求而本类型缺失的必选字段。
- [可选差距]: `oh-gen-doc/交互系统.yaml`「交互模式」下列举了存储区创建、物资拾取标记、伐木标记、蓝图绘制、家具放置等模式；当前 `verb` 为自由 `string`，未在类型层与上述模式或菜单路径建立联合类型/常量表。这不构成对架构 YAML 条文的直接「漏做」，但会增加与 `command-menu`、命令生成器字符串约定漂移的长期风险。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 文件头注释写明供「mock 网关与命令通道」使用，并声明 A 线落地后可换共享包定义；同时导出 `MockWorldSubmitResult`、`MockLineAPort`（桩端口形状）。
- [影响]: 命名与注释使 Mock 语义显式化，并非隐藏分支；但 `oh-code-design` 与 `oh-gen-doc` 均未描述「B 线 Mock 网关 / A 线只读端口」结构，类型与真实世界网关合并后若未删除或改名，易出现「契约文件里长期带 Mock 前缀」的认知负担。
- [说明]: 未发现典型 `TODO`/`temp` 占位实现；本文件仅为类型，无运行时兼容分支。

## 3. 架构违规 (Architecture Violations)

- [结论]: 未发现明显问题。本模块为只读类型定义，依赖限于同目录 `floor-selection` 的 `SelectionModifier`，符合 `oh-code-design/交互系统.yaml`「交互意图层：把输入结果转为领域命令」一侧的数据形状表达，未出现跨层直接改核心状态或 UI 反向依赖领域实现等违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0101]: A 线共享类型落地后，将本文件中的「临时说明」与 `Mock*` 类型一并迁移或收敛到单一 `contracts/`（或共享包），避免 `game/interaction` 与 `player` 两侧长期双轨 re-export。
- [行动点 #0102]: 若需收紧类型安全，可将 `verb` 与 `oh-gen-doc` 所列模式及 `command-menu` 真值对齐为联合类型或从数据层导入的常量枚举，减少字符串魔法值。
- [行动点 #0103]: 合并网关后评估是否将 `MockWorldSubmitResult` / `MockLineAPort` 重命名为与运行环境无关的 `WorldSubmitResult` / `LineAReadPort`（或移出本文件），降低「Mock 即长期 API」的印象。