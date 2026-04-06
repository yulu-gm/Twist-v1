---
name: lookup-module-with-aidoc
description: Use when you need to locate a module, confirm its owning system, or find entry files from aidoc first.
---

# lookup-module-with-aidoc

先查 aidoc 索引，再决定是否需要读源码。

## 使用原则

- 模块定位、模块阅读、归属判断、找入口文件时，优先用 aidoc 索引查询。
- 先调用 `tools/aidoc/index.mjs` 导出的 `lookupModule`、`lookupChangedFiles`、`lookupRoutedSystem`，或对应 CLI。
- 只有索引不足时才读源码。
- 这个 skill 只负责 aidoc 检索，不替代 route-demand；多系统需求仍然先走 route-demand。

## 结果要求

- 先给出模块名、实现入口文件、关键测试文件、场景入口文件。
- 如果需要 routed system 文档，再补 `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 的对应路径。
- 如果索引里已经足够，就不要再扩散到源码细节。
