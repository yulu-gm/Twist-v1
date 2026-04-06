# SubAgent 契约

与 `SKILL.md` 中的 **SubAgent 契约** 一节一致，单独成文便于分包粘贴。

## 主 agent 下发内容

每个 SubAgent 的输入必须包含：

- 原始需求摘要
- 本系统负责的玩家可见结果
- 本系统对应的 `oh-gen-doc` 路径
- 本系统对应的 `oh-code-design` 路径
- 本系统对应的 `oh-acceptance` 路径
- 本系统默认验证层级
- 本系统主要代码目录
- 已知 fake/stub 边界
- 已知跨系统阻塞项

## SubAgent 必须执行

1. 阅读本系统对应的 `oh-gen-doc`、`oh-code-design`、`oh-acceptance`。
2. 只提炼本系统需要更新的行为、边界和验证点。
3. 输出一份文档更新建议包。

## 文档更新建议包格式

返回内容必须至少包含以下字段：

- `system`
- `why_impacted`
- `upstream_docs_to_update`
- `code_design_sync_points`
- `acceptance_sync_points`
- `recommended_first_test`
- `blocked_by`

## SubAgent 禁止行为

- 不要替其他系统补规格。
- 不要擅自改写系统注册表。
- 不要越过主 agent 直接决定跨系统接口。
- 不要把未确认的领域规则伪装成既定事实。
- 不要直接跳进实现代码或把自己变成 TDD 执行阶段。

## 返回要求

SubAgent 的最终返回必须至少说明：

- 本系统为什么受影响
- 需要先更新哪一层文档
- `oh-code-design` 需要同步哪些字段或边界
- `oh-acceptance` 需要补哪些场景
- 首个 failing test 建议落在哪个层级
- 还依赖主 agent 汇总哪些外部系统结果
