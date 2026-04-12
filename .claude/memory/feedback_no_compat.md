---
name: feedback-no-compat
description: 初创项目不要兼容旧代码，新设计应完全落地
type: feedback
originSessionId: 9128ff6f-832f-4cad-81ec-c77ba43490ff
---
不要兼容旧代码，新设计和重构在初版就应该完全落地，不要新旧并存。

**Why:** 初创项目没有线上环境和历史包袱，所有旧代码都可以改。

**How to apply:** 重构时直接替换旧实现，不保留兼容层、不做 feature flag、不留 deprecated 路径。
