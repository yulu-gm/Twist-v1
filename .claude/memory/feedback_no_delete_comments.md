---
name: no-delete-comments
description: Never delete existing comments when modifying code — update them if needed but always preserve
type: feedback
originSessionId: 184d5833-2948-4fae-a526-20a785440967
---
禁止删除已有注释，代码更新后必须同步更新注释。

**Why:** 用户明确要求，注释是项目知识的一部分，删除会丢失上下文，过时的注释比没有注释更有害。

**How to apply:** 在编辑任何文件时，检查 old_string 中是否包含注释，确保 new_string 中保留并更新它们。拆分/重构文件时，将注释随代码一起迁移到新文件。代码逻辑变更后，检查相关注释是否仍然准确，不准确则更新。
