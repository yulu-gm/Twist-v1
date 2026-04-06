# 任务工作流

Agent 默认工作流：

1. 阅读 `TWIST.md` 以及 `.agent/` 下的相关文件。
2. 在提出架构改动前先检查本地代码与文档。
3. 模块定位、模块阅读、归属判断、找入口文件 → 先走 `.agent/skills/lookup-module-with-aidoc/SKILL.md`。
4. 新增玩法、改交互、扩系统、补规则 → 先走 `.agent/skills/route-demand/SKILL.md`。
5. 先确定受影响的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance` 子系统，并写主控路由单到 `working-plan/route-demand/`。
6. 按 `oh-gen-doc -> oh-code-design -> oh-acceptance -> TDD/实现` 顺序推进。
7. 推送远端前 → 走 `.agent/skills/push-with-aidoc/SKILL.md`。
8. 初始化方式或协作流程变化时，同步更新面向人的文档。

功能开发工作流：

1. 明确玩法意图；若涉及多系统，先走 `route-demand`。
2. 若先要确认实现入口、归属模块或关键测试文件，先走 `lookup-module-with-aidoc`。
3. 明确受影响的 `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 子系统与更新顺序。
4. 先补需求与设计，再补验收；UI-first 原型允许先登记 fake/stub，再反推底层逻辑。
5. 明确模拟实体与状态迁移，明确角色 AI 如何评估目标。
6. 在 Phaser 场景中暴露对应行为。
7. 测试验证，补简短文档。
8. 推送前走 `push-with-aidoc`。

缺陷修复工作流：

1. 复现或隔离问题，确认发生在模拟层还是表现层。
2. 若需要先确认模块入口、归属边界或相关测试，先走 `lookup-module-with-aidoc`。
3. 在最小且正确的层级完成修复，条件允许时加回归测试。
4. 记录值得说明的规则变化。
5. 推送前走 `push-with-aidoc`。
