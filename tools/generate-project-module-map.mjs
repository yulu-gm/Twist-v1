import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const PLAN_DIR = path.join(ROOT, 'plan');
const MAP_DIR = path.join(ROOT, 'project-map');
const OUTPUT_JSON = path.join(MAP_DIR, 'project-module-map.json');
const OUTPUT_MD = path.join(MAP_DIR, 'project-module-map.md');

const MODULE_SUMMARIES = {
  'main': '应用启动与装配入口，负责构建 defs、world、初始内容、系统注册和 Phaser 启动。',
  'core': '核心引擎基础设施，提供时钟、命令总线、事件总线、对象池、网格与 tick 调度。',
  'world': '世界根数据与地图级容器，管理 GameMap、DefDatabase 桥接以及区域/房间/预约等子系统。',
  'defs': '静态定义数据层，集中注册 terrain/building/item/plant/job 等 Def。',
  'adapter': '适配器层，连接 Phaser、输入、渲染、DOM UI 与调试工具，不承载 simulation 规则。',
  'presentation': '展示态桥梁，存放选中、悬停、工具模式、预览等不属于 simulation 的瞬态状态。',
  'features.ai': 'AI 调度与 toil 执行层，负责候选工作生成、任务生命周期和具体 toil handler。',
  'features.building': '建筑对象 schema、工厂和查询，以及建筑 tick 行为。',
  'features.construction': '蓝图、工地、建造命令与施工进度处理，是从蓝图到建筑的主链路。',
  'features.corpse': '尸体对象创建与腐烂系统。',
  'features.designation': '指派对象、指派命令和 work 生成入口，连接玩家意图与可执行工作。',
  'features.fire': '火焰对象行为与扩散/熄灭更新。',
  'features.item': '物品对象 schema、工厂和查询，供掉落、搬运、消耗等系统复用。',
  'features.movement': 'Pawn 移动状态与逐 tick 移动推进逻辑。',
  'features.pathfinding': '寻路服务与路径结果类型，支撑 GoTo 等行动。',
  'features.pawn': 'Pawn schema、工厂、命令和需求衰减系统。',
  'features.plant': '植物对象创建与生长逻辑。',
  'features.reservation': '地图预约表的 feature 侧桥接与清理逻辑。',
  'features.room': '房间重建系统与房间类型桥接。',
  'features.save': '存档命令、存储读取和存档数据结构。',
  'features.zone': '区域命令、查询与 zone 类型桥接。',
  'doc.architecture': '总架构蓝图，定义 Simulation/Presentation 分离、Command 入口和 feature-based 组织。',
  'doc.flows': '业务流程解释，适合回答“某个交互从输入到执行的链路在哪里”。',
  'doc.audit': '基建检查与坏味道报告，适合定位热点文件、演化瓶颈和高风险模块。'
};

const MODULE_META = {
  'main': {
    kind: 'entry',
    keyFiles: ['src/main.ts'],
    dependsOn: ['core', 'world', 'defs', 'features.*', 'adapter'],
    usedBy: ['vite entry'],
    searchHints: [
      '启动流程',
      'buildSystems',
      'registerCommands',
      '初始地图生成',
      'boot',
    ],
    docRefs: ['plan/opus architecture.md', 'plan/业务场景解释.md'],
  },
  'core': {
    kind: 'layer',
    keyFiles: ['src/core/tick-runner.ts', 'src/core/command-bus.ts', 'src/core/types.ts', 'src/core/object-pool.ts'],
    dependsOn: [],
    usedBy: ['main', 'world', 'features.*', 'adapter'],
    searchHints: ['tick 顺序', 'command bus', 'event bus', '基础类型', '对象池'],
    docRefs: ['plan/opus architecture.md', 'plan/基建检查报告.md'],
  },
  'world': {
    kind: 'layer',
    keyFiles: ['src/world/world.ts', 'src/world/game-map.ts', 'src/world/def-database.ts'],
    dependsOn: ['core'],
    usedBy: ['main', 'features.*', 'adapter'],
    searchHints: ['World 结构', 'GameMap', 'pathGrid', 'rooms', 'reservations'],
    docRefs: ['plan/opus architecture.md', 'plan/业务场景解释.md'],
  },
  'defs': {
    kind: 'layer',
    keyFiles: ['src/defs/index.ts', 'src/defs/terrains.ts', 'src/defs/buildings.ts', 'src/defs/items.ts'],
    dependsOn: ['world'],
    usedBy: ['main', 'features.*', 'adapter.render'],
    searchHints: ['DefDatabase', 'terrain defs', 'building defs', 'item defs', 'job defs'],
    docRefs: ['plan/opus architecture.md'],
  },
  'adapter': {
    kind: 'layer',
    keyFiles: ['src/adapter/main-scene.ts', 'src/adapter/render/render-sync.ts', 'src/adapter/input/input-handler.ts'],
    dependsOn: ['world', 'core', 'presentation', 'features.*'],
    usedBy: ['main'],
    searchHints: ['MainScene', 'Phaser', '渲染同步', 'DOM UI', '输入拖拽'],
    docRefs: ['plan/V1友好交互-落地计划.md', 'plan/业务场景解释.md'],
  },
  'presentation': {
    kind: 'layer',
    keyFiles: ['src/presentation/presentation-state.ts'],
    dependsOn: ['core'],
    usedBy: ['adapter'],
    searchHints: ['PresentationState', 'ToolType', '选中态', '预览态'],
    docRefs: ['plan/V1友好交互-落地计划.md', 'plan/代码坏味道审计报告.md'],
  },
  'features.ai': {
    kind: 'feature',
    keyFiles: ['src/features/ai/job-selector.ts', 'src/features/ai/toil-executor.ts', 'src/features/ai/job-lifecycle.ts'],
    dependsOn: ['features.pawn', 'features.pathfinding', 'features.designation', 'features.construction', 'world', 'core'],
    usedBy: ['main', 'features.movement'],
    searchHints: ['工作选择', 'wander', 'toil handler', 'cleanupProtocol', 'job lifecycle'],
    docRefs: ['plan/业务场景解释.md', 'plan/基建检查报告.md'],
  },
  'features.building': {
    kind: 'feature',
    keyFiles: ['src/features/building/building.types.ts', 'src/features/building/building.factory.ts', 'src/features/building/building.systems.ts'],
    dependsOn: ['core', 'world', 'defs'],
    usedBy: ['features.construction', 'adapter.render'],
    searchHints: ['building factory', 'building tick', 'building queries'],
    docRefs: ['plan/opus architecture.md'],
  },
  'features.construction': {
    kind: 'feature',
    keyFiles: ['src/features/construction/construction.commands.ts', 'src/features/construction/construction.system.ts', 'src/features/construction/construction.queries.ts'],
    dependsOn: ['features.building', 'features.item', 'features.designation', 'world', 'core'],
    usedBy: ['main', 'features.ai', 'adapter.input'],
    searchHints: ['place blueprint', 'construction progress', 'cancel construction', 'construction site'],
    docRefs: ['plan/业务场景解释.md', 'plan/opus architecture.md'],
  },
  'features.corpse': {
    kind: 'feature',
    keyFiles: ['src/features/corpse/corpse.factory.ts', 'src/features/corpse/corpse.system.ts', 'src/features/corpse/corpse.types.ts'],
    dependsOn: ['core', 'world'],
    usedBy: ['main', 'adapter.render'],
    searchHints: ['corpse decay', 'corpse factory'],
    docRefs: ['plan/opus architecture.md'],
  },
  'features.designation': {
    kind: 'feature',
    keyFiles: ['src/features/designation/designation.commands.ts', 'src/features/designation/designation.system.ts', 'src/features/designation/designation.queries.ts'],
    dependsOn: ['world', 'defs', 'core'],
    usedBy: ['main', 'adapter.input', 'features.ai'],
    searchHints: ['designate mine', 'designate cut', 'cancel designation', 'work generation'],
    docRefs: ['plan/业务场景解释.md'],
  },
  'features.fire': {
    kind: 'feature',
    keyFiles: ['src/features/fire/fire.system.ts', 'src/features/fire/fire.types.ts'],
    dependsOn: ['world', 'core'],
    usedBy: ['main', 'adapter.render'],
    searchHints: ['fire system', 'fire types'],
    docRefs: ['plan/opus architecture.md'],
  },
  'features.item': {
    kind: 'feature',
    keyFiles: ['src/features/item/item.factory.ts', 'src/features/item/item.types.ts', 'src/features/item/item.queries.ts'],
    dependsOn: ['core', 'defs', 'world'],
    usedBy: ['main', 'features.ai', 'features.construction', 'adapter.render'],
    searchHints: ['item factory', 'createItemRaw', 'stackCount', 'food tag'],
    docRefs: ['plan/业务场景解释.md', 'plan/基建检查报告.md'],
  },
  'features.movement': {
    kind: 'feature',
    keyFiles: ['src/features/movement/movement.system.ts', 'src/features/movement/movement.types.ts'],
    dependsOn: ['features.pawn', 'world', 'core'],
    usedBy: ['main', 'features.ai', 'adapter.render'],
    searchHints: ['movement system', 'moveProgress', 'pathIndex'],
    docRefs: ['plan/V1友好交互-落地计划.md', 'plan/业务场景解释.md'],
  },
  'features.pathfinding': {
    kind: 'feature',
    keyFiles: ['src/features/pathfinding/path.service.ts', 'src/features/pathfinding/path.types.ts', 'src/features/pathfinding/path.grid.ts'],
    dependsOn: ['world', 'core'],
    usedBy: ['features.ai', 'adapter.preview'],
    searchHints: ['findPath', 'isReachable', 'MinHeap', 'adjacent passable'],
    docRefs: ['plan/基建检查报告.md', 'plan/业务场景解释.md'],
  },
  'features.pawn': {
    kind: 'feature',
    keyFiles: ['src/features/pawn/pawn.factory.ts', 'src/features/pawn/pawn.commands.ts', 'src/features/pawn/pawn.systems.ts', 'src/features/pawn/pawn.types.ts'],
    dependsOn: ['core', 'world'],
    usedBy: ['main', 'features.ai', 'features.movement', 'adapter.render'],
    searchHints: ['createPawn', 'needs decay', 'draft pawn', 'force job', 'pawn schema'],
    docRefs: ['plan/业务场景解释.md', 'plan/opus architecture.md'],
  },
  'features.plant': {
    kind: 'feature',
    keyFiles: ['src/features/plant/plant.factory.ts', 'src/features/plant/plant.system.ts', 'src/features/plant/plant.types.ts'],
    dependsOn: ['core', 'defs', 'world'],
    usedBy: ['main', 'features.designation', 'adapter.render'],
    searchHints: ['grow plants', 'tree', 'berry bush', 'growthProgress'],
    docRefs: ['plan/业务场景解释.md'],
  },
  'features.reservation': {
    kind: 'feature',
    keyFiles: ['src/features/reservation/reservation.table.ts', 'src/features/reservation/reservation.types.ts'],
    dependsOn: ['world', 'core'],
    usedBy: ['main', 'features.ai'],
    searchHints: ['reservation cleanup', 'Reservation type'],
    docRefs: ['plan/业务场景解释.md'],
  },
  'features.room': {
    kind: 'feature',
    keyFiles: ['src/features/room/room.system.ts', 'src/features/room/room.types.ts'],
    dependsOn: ['world', 'features.building', 'core'],
    usedBy: ['main', 'adapter.debug'],
    searchHints: ['room rebuild', 'markDirty', 'room graph'],
    docRefs: ['plan/业务场景解释.md'],
  },
  'features.save': {
    kind: 'feature',
    keyFiles: ['src/features/save/save.commands.ts', 'src/features/save/save.types.ts'],
    dependsOn: ['world', 'core', 'features.*'],
    usedBy: ['main', 'debug tooling'],
    searchHints: ['save game', 'load game', 'localStorage', 'SaveData'],
    docRefs: ['plan/基建检查报告.md', 'plan/代码坏味道审计报告.md'],
  },
  'features.zone': {
    kind: 'feature',
    keyFiles: ['src/features/zone/zone.commands.ts', 'src/features/zone/zone.queries.ts', 'src/features/zone/zone.types.ts'],
    dependsOn: ['world', 'core'],
    usedBy: ['main', 'adapter.input'],
    searchHints: ['zone set cells', 'zone delete', 'storage zone'],
    docRefs: ['plan/opus architecture.md'],
  },
  'doc.architecture': {
    kind: 'doc',
    keyFiles: ['plan/opus architecture.md'],
    dependsOn: [],
    usedBy: ['main', 'core', 'world', 'features.*', 'adapter'],
    searchHints: ['架构原则', 'World 数据模型', 'GameMap', '对象类型系统'],
    docRefs: ['plan/opus architecture.md'],
  },
  'doc.flows': {
    kind: 'doc',
    keyFiles: ['plan/业务场景解释.md'],
    dependsOn: [],
    usedBy: ['features.ai', 'adapter.input', 'main'],
    searchHints: ['行为调度流程', '采矿流程', '建造流程'],
    docRefs: ['plan/业务场景解释.md'],
  },
  'doc.audit': {
    kind: 'doc',
    keyFiles: ['plan/基建检查报告.md', 'plan/代码坏味道审计报告.md'],
    dependsOn: [],
    usedBy: ['maintainers'],
    searchHints: ['大文件热点', '演化瓶颈', '坏味道', '优先级建议'],
    docRefs: ['plan/基建检查报告.md', 'plan/代码坏味道审计报告.md'],
  },
};

const FEATURE_FILE_ORDER = [
  '.commands.ts',
  '.system.ts',
  '.systems.ts',
  '.factory.ts',
  '.queries.ts',
  '.types.ts',
  '.service.ts',
  '.table.ts',
  '.grid.ts',
];

const LOOKUPS = [
  {
    question: '启动/注册/主循环在哪里？',
    modules: ['main', 'adapter', 'core'],
    files: ['src/main.ts', 'src/adapter/main-scene.ts', 'src/core/tick-runner.ts'],
    why: '主装配在 main，tick 推进在 MainScene，系统执行顺序在 TickRunner。',
  },
  {
    question: 'Pawn 的工作选择逻辑在哪里？',
    modules: ['features.ai', 'features.pawn'],
    files: ['src/features/ai/job-selector.ts', 'src/features/ai/job-lifecycle.ts', 'src/features/pawn/pawn.types.ts'],
    why: '选工、分配和 job 生命周期都集中在 AI feature，Pawn schema 决定了 ai/needs 字段形状。',
  },
  {
    question: '采矿从拖框到执行的链路在哪？',
    modules: ['adapter', 'features.designation', 'features.ai'],
    files: ['src/adapter/input/input-handler.ts', 'src/features/designation/designation.commands.ts', 'src/features/ai/jobs/mine-job.ts', 'src/features/ai/toil-handlers/work.handler.ts'],
    why: '输入层下发指派命令，designation 落地为对象，AI 再把指派转成可执行 job 和 toil。',
  },
  {
    question: '房间重建和 pathGrid 更新在哪处理？',
    modules: ['world', 'features.room', 'features.construction'],
    files: ['src/world/game-map.ts', 'src/world/path-grid.ts', 'src/features/room/room.system.ts', 'src/features/construction/construction.system.ts'],
    why: 'pathGrid 是地图级基础设施，房间重建是 feature，建造完成后会触发路径和房间相关更新。',
  },
  {
    question: '存档读取从哪里开始？',
    modules: ['features.save', 'world'],
    files: ['src/features/save/save.commands.ts', 'src/features/save/save.types.ts', 'src/world/world.ts'],
    why: 'save.commands 同时承载保存和加载入口，并在加载时重建世界与地图容器。',
  },
  {
    question: '渲染同步和对象 renderer 在哪一层？',
    modules: ['adapter', 'presentation'],
    files: ['src/adapter/render/render-sync.ts', 'src/adapter/render/object-renderers/pawn-renderer.ts', 'src/presentation/presentation-state.ts'],
    why: '渲染与 renderer 都在 adapter 层，presentation-state 负责非 simulation 的 UI 桥接状态。',
  },
  {
    question: 'Defs 和静态数据去哪看？',
    modules: ['defs', 'world'],
    files: ['src/defs/index.ts', 'src/defs/terrains.ts', 'src/defs/buildings.ts', 'src/world/def-database.ts'],
    why: 'defs 负责定义内容，DefDatabase 负责统一注册与访问。',
  },
  {
    question: '区域、指派、建造这些玩家意图在哪里入库？',
    modules: ['features.zone', 'features.designation', 'features.construction'],
    files: ['src/features/zone/zone.commands.ts', 'src/features/designation/designation.commands.ts', 'src/features/construction/construction.commands.ts'],
    why: '用户输入最终都会经由 command handler 落地为 simulation 对象或状态变更。',
  },
];

const PATTERNS = [
  {
    name: '四层主链路',
    description: '主入口从 main 装配 world/core/defs/features，再由 adapter 驱动渲染与输入。',
    paths: ['src/main.ts', 'src/core', 'src/world', 'src/defs', 'src/features', 'src/adapter'],
  },
  {
    name: 'Feature 目录模式',
    description: 'feature 通常按 types / factory / queries / system / commands 拆分，AI 额外包含 jobs 和 toil-handlers。',
    paths: ['src/features'],
  },
  {
    name: 'Simulation 与 Presentation 分离',
    description: 'simulation 规则不依赖 Phaser 或 DOM，展示态通过 presentation-state 作为桥梁。',
    paths: ['src/presentation/presentation-state.ts', 'src/adapter', 'plan/opus architecture.md'],
  },
  {
    name: '命令入口统一',
    description: '玩家、UI、调试工具的外部写入都经由 command bus 与具体 command handlers 进入 world。',
    paths: ['src/core/command-bus.ts', 'src/main.ts', 'src/features/*/*.commands.ts'],
  },
  {
    name: 'Tick 阶段化执行',
    description: '系统执行按 command processing -> work generation -> AI decision -> reservation -> execution -> world update -> cleanup -> event dispatch 组织。',
    paths: ['src/core/tick-runner.ts', 'src/main.ts'],
  },
];

const DOCS = [
  {
    id: 'architecture',
    path: 'plan/opus architecture.md',
    summary: '最完整的架构蓝图，适合先理解分层、World/GameMap 和对象模型。',
    useFor: ['架构总览', '层间边界', '核心模型'],
  },
  {
    id: 'flows',
    path: 'plan/业务场景解释.md',
    summary: '按实际业务链路解释输入、指派、AI 选工、toil 执行之间的跳转关系。',
    useFor: ['交互链路', '采矿流程', '建造流程', '行为调度'],
  },
  {
    id: 'infra-audit',
    path: 'plan/基建检查报告.md',
    summary: '指出大文件、结构热点与未来扩展瓶颈，适合快速锁定高风险区域。',
    useFor: ['热点文件', '演化风险', '重构切入点'],
  },
  {
    id: 'smell-audit',
    path: 'plan/代码坏味道审计报告.md',
    summary: '补充职责混乱、重复规则与缺少测试保护网等问题观察。',
    useFor: ['问题背景', '热点定位', '重构理由'],
  },
];

const HOTSPOT_REASONS = {
  'src/main.ts': '启动、系统注册、命令注册和初始内容生成都在这里汇合，是全局装配热点。',
  'src/adapter/input/input-handler.ts': '输入监听、拖拽状态、命令下发和预览计算都集中在这里。',
  'src/features/ai/job-selector.ts': '空闲判定、候选收集、评分、预约和 wander 回退都在这里。',
  'src/features/save/save.commands.ts': '保存/加载、序列化、localStorage 访问和世界重建耦合在同一入口。',
  'src/features/ai/toil-executor.ts': 'Toil 执行入口，是实际行为落地的关键枢纽。',
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFilesRecursively(dirPath, predicate = () => true) {
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(toPosix(path.relative(ROOT, fullPath)));
    }
  }
  return results.sort();
}

function toPosix(input) {
  return input.split(path.sep).join('/');
}

function readFileSafe(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function extractDescription(relPath) {
  const text = readFileSafe(relPath);
  const match = text.match(/@description\s+([\s\S]*?)(?:\n\s*\*\s*@|\n\s*\*\/)/);
  if (match) {
    return normalizeSentence(match[1]);
  }
  const line = text.split('\n').map((item) => item.trim()).find(Boolean);
  return line ? normalizeSentence(line.replace(/^[/#*\s]+/, '')) : '';
}

function normalizeSentence(text) {
  return text.replace(/\r/g, '').replace(/\n\s*\*\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractExports(relPath) {
  const text = readFileSafe(relPath);
  const regex = /^export\s+(?:class|function|const|interface|type|enum)\s+([A-Za-z0-9_]+)/gm;
  const names = [];
  for (const match of text.matchAll(regex)) {
    names.push(match[1]);
  }
  return unique(names).slice(0, 8);
}

function extractTopLevelFunctions(relPath) {
  const text = readFileSafe(relPath);
  const regex = /^function\s+([A-Za-z0-9_]+)\s*\(/gm;
  const names = [];
  for (const match of text.matchAll(regex)) {
    names.push(match[1]);
  }
  return unique(names).slice(0, 8);
}

function getLineCount(relPath) {
  return readFileSafe(relPath).split('\n').length;
}

function unique(values) {
  return [...new Set(values)];
}

function sortFeatureFiles(files) {
  return [...files].sort((a, b) => {
    const aRank = getFeatureFileRank(a);
    const bRank = getFeatureFileRank(b);
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

function getFeatureFileRank(file) {
  const index = FEATURE_FILE_ORDER.findIndex((suffix) => file.endsWith(suffix));
  return index === -1 ? FEATURE_FILE_ORDER.length : index;
}

function buildFeatureModule(featureName, allFiles) {
  const id = `features.${featureName}`;
  const featureFiles = allFiles.filter((file) => file.startsWith(`src/features/${featureName}/`));
  const meta = MODULE_META[id] ?? {
    kind: 'feature',
    keyFiles: sortFeatureFiles(featureFiles).slice(0, 4),
    dependsOn: ['world', 'core'],
    usedBy: ['main'],
    searchHints: [featureName],
    docRefs: [],
  };

  const keyFiles = (meta.keyFiles ?? sortFeatureFiles(featureFiles).slice(0, 4)).filter((file) => featureFiles.includes(file));
  const exportsOrRoles = unique(keyFiles.flatMap((file) => [
    ...extractExports(file),
    ...extractTopLevelFunctions(file),
  ])).slice(0, 10);

  return {
    id,
    kind: meta.kind,
    summary: MODULE_SUMMARIES[id] ?? `${featureName} 相关功能模块。`,
    key_files: keyFiles,
    exports_or_roles: exportsOrRoles,
    depends_on: meta.dependsOn,
    used_by: meta.usedBy,
    search_hints: meta.searchHints,
    doc_refs: meta.docRefs,
    file_count: featureFiles.length,
    files: featureFiles,
  };
}

function buildModules(allSrcFiles) {
  const topLevelFiles = allSrcFiles.filter((file) => file.startsWith('src/'));
  const featuresDir = path.join(SRC_DIR, 'features');
  const featureNames = fs.readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const modules = [];

  for (const id of ['main', 'core', 'world', 'defs', 'adapter', 'presentation']) {
    const meta = MODULE_META[id];
    const keyFiles = meta.keyFiles.filter((file) => topLevelFiles.includes(file));
    modules.push({
      id,
      kind: meta.kind,
      summary: MODULE_SUMMARIES[id],
      key_files: keyFiles,
      exports_or_roles: unique(keyFiles.flatMap((file) => [
        ...extractExports(file),
        ...extractTopLevelFunctions(file),
      ])).slice(0, 10),
      depends_on: meta.dependsOn,
      used_by: meta.usedBy,
      search_hints: meta.searchHints,
      doc_refs: meta.docRefs,
    });
  }

  for (const featureName of featureNames) {
    modules.push(buildFeatureModule(featureName, topLevelFiles));
  }

  for (const id of ['doc.architecture', 'doc.flows', 'doc.audit']) {
    const meta = MODULE_META[id];
    modules.push({
      id,
      kind: meta.kind,
      summary: MODULE_SUMMARIES[id],
      key_files: meta.keyFiles,
      exports_or_roles: [],
      depends_on: meta.dependsOn,
      used_by: meta.usedBy,
      search_hints: meta.searchHints,
      doc_refs: meta.docRefs,
    });
  }

  return modules;
}

function buildLayers() {
  return [
    {
      id: 'main',
      path: 'src/main.ts',
      summary: '启动入口与装配层。',
      downstream: ['core', 'world', 'defs', 'features', 'adapter'],
    },
    {
      id: 'core',
      path: 'src/core',
      summary: '全局基础设施与通用运行时组件。',
      downstream: ['world', 'features', 'adapter'],
    },
    {
      id: 'world',
      path: 'src/world',
      summary: '世界根数据、地图容器和 map 级子系统。',
      downstream: ['features', 'adapter'],
    },
    {
      id: 'defs',
      path: 'src/defs',
      summary: '静态定义和注册入口。',
      downstream: ['main', 'features', 'adapter'],
    },
    {
      id: 'features',
      path: 'src/features',
      summary: '业务特性目录，负责 simulation 规则和 command/system 实现。',
      downstream: ['adapter via world state'],
    },
    {
      id: 'adapter',
      path: 'src/adapter',
      summary: 'Phaser、输入、渲染、UI 和调试适配层。',
      downstream: ['presentation'],
    },
    {
      id: 'presentation',
      path: 'src/presentation',
      summary: '非 simulation 的展示态桥梁。',
      downstream: ['adapter'],
    },
    {
      id: 'plan',
      path: 'plan',
      summary: '项目内架构蓝图、流程解释和演化审计文档。',
      downstream: ['human and agent guidance'],
    },
  ];
}

function buildHotspots(allSrcFiles) {
  const scored = allSrcFiles
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ path: file, lines: getLineCount(file) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 8);

  return scored.map((item) => ({
    path: item.path,
    lines: item.lines,
    reason: HOTSPOT_REASONS[item.path] ?? '文件体量较大，通常意味着更多上下文切换和更高的检索成本。',
  }));
}

function buildProject(packageJson) {
  return {
    name: packageJson.name,
    language: 'TypeScript',
    runtime: 'Vite + Phaser',
    primary_entry: 'src/main.ts',
    architecture_style: 'main -> core/world/defs/features -> adapter/presentation',
    purpose: '为 agent 提供高密度模块导航，先读 map 再做局部搜索。',
  };
}

function buildLookupIndex(lookups) {
  const index = {};
  for (const item of lookups) {
    for (const file of item.files) {
      index[file] ??= [];
      index[file].push(item.question);
    }
  }
  return index;
}

function renderMarkdown(data) {
  const featureModules = data.modules.filter((module) => module.kind === 'feature');
  const majorModules = data.modules.filter((module) => ['entry', 'layer'].includes(module.kind));

  const lines = [];
  lines.push('# Project Module Map');
  lines.push('');
  lines.push('## 项目总体架构');
  lines.push('');
  lines.push(`- 项目：\`${data.project.name}\``);
  lines.push(`- 技术栈：${data.project.runtime}`);
  lines.push(`- 主入口：\`${data.project.primary_entry}\``);
  lines.push(`- 目标：${data.project.purpose}`);
  lines.push('- 推荐阅读顺序：先看 `plan/opus architecture.md` 理解边界，再看本文件缩小模块范围，最后进入具体代码文件。');
  lines.push('');
  lines.push('## 分层与依赖方向');
  lines.push('');
  for (const layer of data.layers) {
    lines.push(`- \`${layer.id}\` → \`${layer.path}\`：${layer.summary}`);
  }
  lines.push('');
  lines.push('依赖主方向：`main` 装配 `core/world/defs/features`，`adapter` 读取 simulation 状态并驱动输入/渲染，`presentation` 作为展示态桥梁。');
  lines.push('');
  lines.push('## 核心模块导航');
  lines.push('');
  for (const module of majorModules) {
    lines.push(`### ${module.id}`);
    lines.push('');
    lines.push(`- 职责：${module.summary}`);
    lines.push(`- 代表文件：${module.key_files.map((item) => `\`${item}\``).join('，')}`);
    if (module.search_hints.length > 0) {
      lines.push(`- 先搜这些词：${module.search_hints.map((item) => `\`${item}\``).join('，')}`);
    }
    if (module.doc_refs.length > 0) {
      lines.push(`- 相关文档：${module.doc_refs.map((item) => `\`${item}\``).join('，')}`);
    }
    lines.push('');
  }
  lines.push('## Feature 模块导航表');
  lines.push('');
  lines.push('| Feature | 职责 | 代表文件 | 先看什么问题 |');
  lines.push('| --- | --- | --- | --- |');
  for (const module of featureModules) {
    lines.push(`| \`${module.id}\` | ${module.summary} | ${module.key_files.slice(0, 3).map((item) => `\`${item}\``).join('<br>')} | ${module.search_hints.slice(0, 3).map((item) => `\`${item}\``).join(' / ')} |`);
  }
  lines.push('');
  lines.push('## 高频任务推荐入口');
  lines.push('');
  for (const lookup of data.lookups) {
    lines.push(`- ${lookup.question}`);
    lines.push(`  先看：${lookup.files.map((item) => `\`${item}\``).join('，')}。原因：${lookup.why}`);
  }
  lines.push('');
  lines.push('## 关键文档入口');
  lines.push('');
  for (const doc of data.docs) {
    lines.push(`- \`${doc.path}\`：${doc.summary}`);
  }
  lines.push('');
  lines.push('## 检索注意事项');
  lines.push('');
  lines.push('- 先读 `project-map/project-module-map.json` 再搜代码；它是给 agent 用的主索引。');
  lines.push('- 问“链路在哪”时，优先看 `plan/业务场景解释.md`，再跳到相应 feature 文件。');
  lines.push('- 问“架构边界/这一层该放什么”时，优先看 `plan/opus architecture.md`。');
  lines.push('- 问“为什么这个文件是热点/为什么改这里风险高”时，优先看 `plan/基建检查报告.md` 和 `plan/代码坏味道审计报告.md`。');
  lines.push('- 对 feature 目录，通常按 `commands -> system -> queries/factory -> types` 的顺序收缩搜索范围最省 token。');
  lines.push('- `adapter` 负责表现与输入，不要在这里寻找 simulation 规则本体；真正规则多半在 `features/*` 或 `world/*`。');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function validatePathsExist(data) {
  const requiredPaths = new Set();

  for (const module of data.modules) {
    for (const file of module.key_files ?? []) requiredPaths.add(file);
    for (const file of module.doc_refs ?? []) requiredPaths.add(file);
  }

  for (const lookup of data.lookups) {
    for (const file of lookup.files ?? []) requiredPaths.add(file);
  }

  for (const doc of data.docs) {
    requiredPaths.add(doc.path);
  }

  const missing = [...requiredPaths]
    .filter(Boolean)
    .filter((relPath) => !fs.existsSync(path.join(ROOT, relPath)))
    .sort();

  if (missing.length > 0) {
    throw new Error(`Module map references missing files:\n${missing.join('\n')}`);
  }
}

function main() {
  const packageJson = readJson(path.join(ROOT, 'package.json'));
  const allSrcFiles = listFilesRecursively(SRC_DIR, (file) => file.endsWith('.ts') || file.endsWith('.css'));
  const planFiles = listFilesRecursively(PLAN_DIR, (file) => file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.html'));

  const data = {
    schema_version: 1,
    project: buildProject(packageJson),
    layers: buildLayers(),
    modules: buildModules(allSrcFiles),
    patterns: PATTERNS,
    lookups: LOOKUPS,
    lookup_index: buildLookupIndex(LOOKUPS),
    hotspots: buildHotspots(allSrcFiles),
    docs: DOCS,
    inventory: {
      src_files: allSrcFiles.length,
      plan_files: planFiles.length,
      features: fs.readdirSync(path.join(SRC_DIR, 'features'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    },
  };

  validatePathsExist(data);

  ensureDir(MAP_DIR);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(data), 'utf8');

  console.log(`Generated ${toPosix(path.relative(ROOT, OUTPUT_JSON))}`);
  console.log(`Generated ${toPosix(path.relative(ROOT, OUTPUT_MD))}`);
}

main();
