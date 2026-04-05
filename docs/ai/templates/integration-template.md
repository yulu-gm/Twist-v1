# 集成文档模板

## 主题

`<yyyy-mm-dd>-<topic>`

## 玩家路径

按时间顺序描述玩家如何穿过多个系统。

1. 玩家执行什么动作
2. 哪个系统先响应
3. 其他系统如何接力反馈

## 参与系统

- `<system>`：负责什么

## 当前 UI-first fake

- 哪些输入、状态或任务结果仍由 fake/stub 提供
- 这些 fake 由哪个系统 aidoc 记录

## TDD 顺序

1. 先写哪些交互测试
2. 再写哪些组件或契约测试
3. 最后补哪些 domain 测试

## fake-to-real 反推顺序

1. 哪个 fake 先被真实接口替换
2. 替换后需要补哪些回归验证

## 必跑回归组合

- `<system-a>` + `<system-b>`
- `<system-b>` + `<system-c>`
