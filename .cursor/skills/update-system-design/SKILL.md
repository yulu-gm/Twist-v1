---
name: update-system-design
description: >-
  Merges full user-story context and diffs into structured YAML design docs
  under oh-gen-doc/: Chinese keys only, one independent YAML file per analyzed
  dimension, preserves historical requirements, appends a short note to
  MEMORY.md. Use when oh-story/ gains or changes .md files, or when refreshing
  system design from stories and oh-gen-doc.
---

# 结构化系统设计文档更新

## 触发条件
当 oh-story/ 目录有新增或修改的 .md 文件时触发。

## 核心目标与输出要求
1. **格式要求**：必须使用 **YAML** 语法编写结构化的内容，并且**所有结构化的键名（Key）必须全部使用中文表示**。
2. **核心目的**：将所有 user story 的需求深度整合。文档的细节和信息量必须足够丰富，使得一个**完全不熟悉项目的开发者**能够仅凭这些文档，结构化地深入了解项目的每一个细节，并开发出所有的用户需求。
3. **动态多维度拆解与独立文件**：文档必须从多个维度进行深度剖析。这些拆分的维度**不是固定的**，你需要根据项目类型和具体需求**自行分析和决定**，并且**每个维度必须输出为独立的 YAML 文件**。
   - *例如*：如果是一个网站项目，你可能需要拆分出 `页面元素`、`接口定义`、`后端逻辑`、`数据模型` 等维度。
   - *例如*：如果是一个游戏项目，你可能需要拆分出 `玩法设计`、`表现设计`、`系统设计` 等维度。
   - 维度的增删完全取决于需求的实际情况，核心原则是：“能够提供给不熟悉项目的人各个维度的信息拆解”。

## 输入信息

### 全量 Story 文件
oh-story/中的所有文件
禁止阅读其他文件，保持上下文纯净

## 执行步骤

### 第一步：读取现有文档
用 Read 工具读取 `oh-gen-doc/` 目录下现有的所有 `.yaml` 设计文档。如果不存在则准备从头创建。

### 第二步：读取全量需求
用 Read 工具读取上述所有 story 文件，理解完整需求上下文。

### 第三步：分析变更与维度提取
根据git Diff 信息和全量需求：
- 识别新增和修改的需求。
- **分析并决定**当前项目需要哪些“维度”来结构化这些需求。
- 将需求细节拆解并映射到对应的维度中。

### 第四步：合并与结构化更新
将新的拆解内容与现有 YAML 结构合并。
- 必须保留历史需求（除非被明确修改或废弃），绝对不能删除变更之外的内容。
- 确保 YAML 结构清晰，层级合理，字段命名语义化。

### 第五步：写回文档
用 Write 或 Edit 工具将每个维度的内容**分别写回** `oh-gen-doc/` 目录下独立的 `.yaml` 文件中。**绝对不要**将所有内容堆砌在一个文件里。
例如，必须分别创建 `oh-gen-doc/接口定义.yaml`, `oh-gen-doc/页面元素.yaml`, `oh-gen-doc/数据模型.yaml` 等，保持结构清晰。

### 第六步：记录变更
用 Edit 工具在 MEMORY.md 末尾追加本次变更的一两句摘要。

## 关键约束
- **强制多文件输出**：每个拆分的维度必须是一个独立的 `.yaml` 文件，严禁将所有维度合并输出到一个单一的 YAML 文件中。
- 最终的 YAML 内容必须同时包含历史需求和本次新需求，不允许只保留新内容。
- 遇到需求冲突时，在 YAML 中添加 `待确认风险` 或类似中文标记。
- 必须基于全量 story 理解上下文，而非仅依赖变更文件。
- **绝对不要**使用 Markdown 格式输出设计主体内容，必须是纯合法的 YAML 格式（可以利用 YAML 的多行文本 `|` 或 `>` 语法来包含长段落说明）。
