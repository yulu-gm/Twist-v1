## 主题

`2026-04-05-a-line-world-core-and-build-loop`

## 玩家路径

1. 玩家或脚本放置一个标记或蓝图。
2. `world-core` 把输入转换为去重后的工作单，并把结果写入统一的可序列化世界快照。
3. 执行者领取工作后，锁定状态阻止其他执行者重复领取；时间推进则持续通过统一时间快照和事件输出。
4. 工作完成后，`world-core` 更新实体与占格；若是建造，则把蓝图转成建筑并派生休息点结果。

## 参与系统

- `world-core`：维护统一世界真相源、序列化投影、时间事件、工作锁定/去重、建造落地与派生结果
- `world-grid`：提供格子边界与占格键语义
- `time-of-day`：提供暂停、调速与跨天事件

## 当前 UI-first fake

- 当前没有接入真实 UI；标记、蓝图和工作执行都由 domain tests 中的命令回放驱动。
- `world-core` 暂时只支持有限工作和建筑种类，用来先验证 A 线闭环。

## TDD 顺序

1. 先写 `world-core` 的 domain tests，锁定实体/占用一致性、快照序列化与时间契约。
2. 再写工作与建造闭环的 domain tests，锁定工作锁定、去重、失败重开与蓝图落地。
3. 最后在后续场景接入时补契约或集成测试。

## fake-to-real 反推顺序

1. 先把命令回放替换为真实的交互命令入口。
2. 再把 `world-core` 的只读快照接给行为与 UI 系统消费。
3. 接入之后补充 `world-core + selection-ui`、`world-core + task-planning` 的回归验证。

## 必跑回归组合

- `world-core` + `world-grid`
- `world-core` + `time-of-day`
- `world-core` + `task-planning`
