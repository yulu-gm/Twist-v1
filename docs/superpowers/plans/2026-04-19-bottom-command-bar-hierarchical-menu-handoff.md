# 底部命令栏分层菜单交接说明

请从当前分支开始实现，不要基于 `main` 直接开工。

- 设计文档：`docs/superpowers/specs/2026-04-19-bottom-command-bar-hierarchical-menu-design.md`
- 实现计划：`docs/superpowers/plans/2026-04-19-bottom-command-bar-hierarchical-menu.md`

实现范围只限底部命令栏分层菜单重构：

- 将现有全宽 toolbar 和 `Build / Zone` 特判 dropdown 改为左下角统一方块列表
- 将菜单路径放入 `PresentationState`
- 键盘改为动态 `Z / X / C / V / B / N / M`
- 非根层 `Esc` 返回一级，根层 `Esc` 切回 `选择`

请严格按 plan 的任务顺序推进，先做状态层、菜单纯函数和 selector，再做组件与键盘接线，不要跳过测试步骤。

完成实现后，请删除本交接说明文件。
