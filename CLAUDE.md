# Project Rules

## Memory

- 项目记忆文件存放在 `.claude/memory/`，索引为 `.claude/memory/MEMORY.md`。
- 新增、更新、删除记忆时，优先操作项目内的 `.claude/memory/` 而非用户目录下的全局记忆路径。

## Project Structure

Twist-v1 目录：
- `src/core`：基础设施与通用类型
- `src/world`：世界、地图、区域、房间
- `src/defs`：静态定义
- `src/features`：玩法功能模块
- `src/adapter`：输入、渲染、UI、调试
- `src/presentation`：展示态
- `plan`：架构与说明文档
- `project-map`：模块索引

## Search Guidance

- 项目内搜索、模块定位、概念追踪时，优先使用 `$search_proj_info`。

## Code Modification Rules

- **禁止删除已有注释。** 修改代码时必须保留原有的注释。可以修改注释内容使其与代码变更保持一致，但不得删除注释。
- **代码更新后要更新注释。** 当代码逻辑发生变更时，必须同步更新相关注释，确保注释与代码一致。
- **不要兼容旧代码。** 这是一个初创项目，没有需要兼容的线上环境和历史包袱，所有旧代码都可以改，新设计和重构在初版就应该完全落地，不要新旧并存。
