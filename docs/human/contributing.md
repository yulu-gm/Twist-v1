# 贡献指南

## 修改代码前

请先阅读：

1. `Agent.md`
2. `.agent/repo-rules.md`
3. `.agent/coding-standards.md`

## 协作期望

- 保持改动聚焦，不要把无关修改混在一起。
- 引入新系统时要同步补充文档。
- 对确定性逻辑，在可行时补充测试。
- 保持模拟代码与表现层代码的职责分离。
- 新增玩法、改交互、扩系统、补规则时，先参考 `.agent/skills/route-demand/SKILL.md` 走需求拆分与 aidoc 路由流程。
- 准备推送远端前，先走 `.agent/skills/push-with-aidoc/SKILL.md`，检查受影响系统的 aidoc、索引和受控提交格式。
