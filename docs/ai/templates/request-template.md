# 路由后主控需求单模板

## 主题

`<yyyy-mm-dd>-<topic>`

## 原始需求

直接粘贴用户需求，保持原文的上下文。

## route-demand 路由结果

- 玩家目标：
- 输入动作：
- 画面反馈：
- 状态承诺：

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `<system>` | `<result>` | `docs/ai/system-standards/<system>.md` | `docs/ai/systems/<system>/<yyyy-mm-dd>-<topic>.md` | `<acceptance/component/domain>` |

## 依赖系统

- `<system>`：说明为何仅仅作为依赖，不单独产出新的 aidoc。

## SubAgent 分派计划

- `<system>` → 读取哪个标准文档，写回哪个 aidoc。

## 汇总注意事项

- 主 agent 只能在所有子系统 aidoc 返回之后，才可以生成集成文档和最终的 TDD 顺序。
