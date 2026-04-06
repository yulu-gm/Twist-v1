# Claude Code 入口

**所有规则与配置已统一至 [`TWIST.md`](TWIST.md)，请直接阅读该文件。**

所有对 Agent.md / CLAUDE.md 的修改加入到 TWIST.md 中。

多系统需求请先走 `route-demand`：`.agent/skills/route-demand/SKILL.md`（完整流程见 `TWIST.md`）。
先识别受影响的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance` 子系统，再进入 TDD 与实现。

模块定位、模块阅读、归属判断、找入口文件时，优先走 `lookup-module-with-aidoc`：`.agent/skills/lookup-module-with-aidoc/SKILL.md`。
