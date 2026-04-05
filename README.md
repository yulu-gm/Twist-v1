# Twist_V1

`Twist_V1` 是一个以 Agent 协作为核心的游戏项目，使用 Phaser 与 TypeScript 构建，目标是实现一款后末日聚落模拟游戏。

## 项目愿景

玩家将控制多个幸存者，选择落脚地点，建立生存基地，并在需求、优先级、工作分配、危险环境与稀缺资源的相互作用下，推动一段段涌现式故事自然发生。

本项目借鉴了 RimWorld 等殖民模拟游戏的玩法模式，同时会建立属于自己的世界观、系统结构与生产流程。

## 技术栈

- Phaser 3
- TypeScript
- Vite
- Vitest

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器
npm run test     # 运行测试
npm run build    # 构建生产资源
```

## 项目结构

```text
Twist_V1/
├─ CLAUDE.md          # Claude Code 入口（含目录职责速查）
├─ Agent.md           # Agent 入口索引
├─ .agent/            # Agent 行为规则与工作流文档
├─ docs/ai/           # 系统规格与架构说明
├─ docs/human/        # 上手指南与协作说明
├─ src/
│  ├─ game/           # 模拟层（与 Phaser 解耦）
│  └─ scenes/         # Phaser 场景与表现层
├─ data/              # 静态游戏数据与 JSON 配置
├─ tests/             # 自动化测试
└─ tools/             # 开发工具与校验脚本
```

## 当前状态

项目处于脚手架阶段，核心游戏系统尚未实现。近期规格与里程碑见 `docs/ai/project-overview.md`。

## 需求路由流程

当需求涉及新增玩法、交互反馈、系统扩展或规则补充时，先使用项目内私有 Skill：

- `.agent/skills/route-demand/SKILL.md`

该流程会先把需求拆成多个子系统 aidoc，再汇总成集成文档与 TDD 顺序，避免把多系统需求混写成单篇规格。
