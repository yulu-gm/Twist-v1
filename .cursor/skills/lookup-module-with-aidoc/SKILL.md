---
name: lookup-module-with-aidoc
description: 优先通过 aidoc 索引定位模块、入口文件和归属系统。
---

# lookup-module-with-aidoc

- 模块定位、模块阅读、归属判断、找入口文件时，先查 aidoc 索引。
- 只有索引不足时才读源码。
- 该 skill 不替代 `route-demand`；多系统需求仍按 `route-demand` 的流程走。
- 输出时优先给出实现入口文件、关键测试文件、场景入口文件，以及对应的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance`。
