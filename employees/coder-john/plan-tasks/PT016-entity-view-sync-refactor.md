# PT016 静态实体视图同步重构

## 1. 计划目标
彻底解决当前静态实体（岩石、树木、地面掉落物、建筑）采用“一次性绘制 (Fire-and-Forget)”导致的数据与画面不同步问题。
落实 `oh-code-design/实体系统.yaml` 中“提供只读投影”与 `UI系统.yaml` 中“刷新反馈”的架构要求，引入统一的**视图映射表与渲染器注册机制 (Unified EntityRenderer Registry)**。

## 2. 关联文档
- `employees/coder-john/docs/ER001-实体视图同步重构报告-2026-04-07.md`
- `oh-code-design/实体系统.yaml`
- `oh-code-design/UI系统.yaml`

## 3. 实施步骤

### 步骤 1：定义核心同步管线
- **文件**: `src/scenes/renderers/entity-view-sync.ts` (新建)
- **内容**: 
  - 定义泛型接口 `EntityRenderer<TEntity, TView>`，包含 `shouldRender`、`create`、`update`、`destroy` 生命周期方法。
  - 实现核心分发函数 `syncEntityViews`：遍历注册表，比对 `EntityRegistry` 数据与 `entityViews` 映射表，执行增量创建、更新与销毁。

### 步骤 2：重构具体实体渲染器
将现有分散的 `drawXXX` 逻辑封装为符合 `EntityRenderer` 接口的对象：
- **`RockRenderer` / `TreeRenderer`**: 
  - 职责：创建静态图形（Rectangle），无需 update。
- **`GroundItemRenderer`**: 
  - 职责：`shouldRender` 限制仅渲染 `containerKind === "map"` 的物资；`create` 绘制框与文本的 Container；`update` 刷新数量文本。
- **`BuildingRenderer`**: 
  - 职责：绘制建筑占位图与底部标签的 Container。

### 步骤 3：改造 GameScene 渲染接入
- **文件**: `src/scenes/GameScene.ts`
- **内容**:
  - **清理旧代码**：删除 `create()` 中对 `drawStoneCells`、`drawGroundItemStacks`、`drawBuildingsFromRegistry` 的一次性调用。
  - **状态声明**：新增唯一的 `entityViews: Map<EntityId, any>` 映射表，以及 `renderers` 字典。
  - **挂载管线**：在 `update()` 方法末尾（紧跟小人同步之后），调用 `syncEntityViews`。

### 步骤 4：清理废弃的旧渲染代码
- **文件**: `src/scenes/renderers/grid-renderer.ts`, `ground-items-renderer.ts`, `buildings-renderer.ts` 等。
- **内容**: 删除已被 `EntityRenderer` 替代的旧 `drawXXX` 导出函数，彻底消除历史包袱。

## 4. 验收标准
1. 游戏运行无报错，初始画面（石头、树木、建筑、种子物资）渲染与重构前一致。
2. 玩家框选并让小人执行“开采”或“砍伐”后，目标岩石/树木在画面上立刻消失。
3. 开采/砍伐完成后，原地立刻渲染出新生成的掉落物（石块/木柴）。
4. 源码中不再存在 `drawStoneCells`、`drawGroundItemStacks` 等一次性绘制静态实体的代码。