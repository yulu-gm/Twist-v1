# 审计报告: src/ui/menu-model.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**：`setCommandMenuCategory` 仅改写 `activeCategoryId`，未将 `activeCommandId` 约束到该分类下的合法命令；若调用方在切换分类后依赖 `activeCommandId`，可能出现「当前分类」与「当前命令」分属不同分类的不一致状态。`selectCommandMenuCommand` 会同步分类，但分类专用 setter 未做对称处理。
- **[依据]**：`oh-code-design/UI系统.yaml` 中「菜单模型」职责包含管理菜单层级与菜单项映射；关键流程「菜单进入操作模式」要求 UI 更新当前选中状态并与后续模式切换一致。分类与命令指针应在切换分类时保持单一事实来源下的自洽。
- **[说明]**：`oh-gen-doc/UI系统.yaml` 与 `oh-gen-doc/交互系统.yaml` 描述的一级结构为「区域 / 建造 / 家具」及对应子项；当前命令菜单的分类与命令 ID 由 `src/data/command-menu.ts` 定义（含 `orders` 等策划文档未逐条展开的指令类入口）。`menu-model.ts` 作为该数据的读模型包装层，**不单独承担**「文档与数据表完全一致」的责任，但若以 `oh-gen-doc` 为验收基准，整体产品语义存在「文档仍为第一天三条主链、实现已扩展指令类」的偏差，需在数据层与策划同步而非本文件内补全。
- **[范围]**：`oh-code-design/UI系统.yaml`「界面状态」中的当前模式提示、当前悬停信息、工具栏选中态等，本文件未建模；属合理的模块切分（应由界面状态层其他模块承接），**不**记为本文件漏做，除非项目约定所有界面态必须集中于 `menu-model`。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- **[指控]**：第 18–36 行保留「旧版扁平菜单」类型 `MenuItem` / `MenuItemAction` 与 `MenuState` 及 `createMenuState`、`selectMenuItem`、`toggleMenuVisibility`；文件头注释写明供少量组件测试引用。
- **[影响]**：双轨菜单状态（扁平 vs 命令菜单）增加维护与认知成本；若测试长期依赖扁平模型，会拖延与 `CommandMenuState` + 数据驱动菜单树的统一。
- **[说明]**：未发现 `mock`/`TODO` 字符串或硬编码假菜单数据；本文件的「兼容」主要体现在保留旧 API 表面。

## 3. 架构违规 (Architecture Violations)

- **[结论]**：未发现明显问题。
- **[说明]**：本文件为纯函数式 UI 状态与读模型辅助，从 `../data/command-menu` 读取配置化定义，不直接修改地图、实体或领域命令，符合 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」及扩展点「菜单树与工具栏可改为数据驱动配置」的方向。`activeCommandForCommandMenuState` / `commandInteractionSemantics` 等处对默认命令的非空断言属于实现韧性细节，不构成对交互系统或地图系统的越权调用。

## 4. 修复建议 (Refactor Suggestions)

- **[行动点 #0357]**：要么在 `setCommandMenuCategory` 内同步调用与 `createCommandMenuState` 类似的逻辑（切换分类时将 `activeCommandId` 设为该分类首个命令或显式传入的默认命令），要么删除/私有化该 API 并在全仓保证只用 `selectCommandMenuCommand` 切换；当前仓库内暂无其他文件引用该函数，是收紧 API 的窗口期。
- **[行动点 #0358]**：将仍依赖 `MenuItem`/`MenuState` 的组件测试迁移到 `CommandMenuState` + `command-menu` 数据后，删除扁平菜单相关导出，消除双轨。
- **[行动点 #0359]**：在策划侧更新 `oh-gen-doc` 菜单章节或与 `command-menu` 数据对齐（区域/建造/家具 vs orders/structures/furniture 的命名与层级），避免验收时「文档与实现各说各话」；此项主要落在文档与 `src/data/command-menu.ts`，`menu-model` 随数据更正即可。