import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, 'tools', 'benchmark', 'search_proj_info');
const QUESTIONS_PATH = path.join(BENCH_DIR, 'questions.json');
const MAP_JSON_PATH = path.join(ROOT, 'project-map', 'project-module-map.json');

const HEADER_CHARS = 1600;

function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []);
}

function overlapScore(queryTokens, text) {
  const haystack = new Set(tokenize(text));
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.has(token)) score += 1;
  }
  return score;
}

function pathCategory(relPath) {
  if (relPath.startsWith('src/features/')) {
    const [, , feature] = relPath.split('/');
    return `features.${feature}`;
  }
  if (relPath.startsWith('src/core/')) return 'core';
  if (relPath.startsWith('src/world/')) return 'world';
  if (relPath.startsWith('src/defs/')) return 'defs';
  if (relPath.startsWith('src/adapter/')) return 'adapter';
  if (relPath.startsWith('src/presentation/')) return 'presentation';
  if (relPath === 'src/main.ts') return 'main';
  if (relPath.startsWith('plan/')) return 'plan';
  return 'misc';
}

function listFilesRecursively(dirPath, predicate = () => true) {
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(path.relative(ROOT, fullPath).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function buildInventory() {
  return listFilesRecursively(path.join(ROOT, 'src'), (fullPath) => /\.(ts|css)$/.test(fullPath))
    .concat(listFilesRecursively(path.join(ROOT, 'plan'), (fullPath) => /\.(md|txt|html)$/.test(fullPath)))
    .sort();
}

function scoreFile(questionPrompt, relPath, headerText) {
  const queryTokens = tokenize(questionPrompt);
  const fileName = path.basename(relPath);
  const pathScore = overlapScore(queryTokens, relPath) * 3;
  const fileNameScore = overlapScore(queryTokens, fileName) * 4;
  const headerScore = overlapScore(queryTokens, headerText);
  const categoryScore = overlapScore(queryTokens, pathCategory(relPath)) * 2;
  return pathScore + fileNameScore + headerScore + categoryScore;
}

function rankFiles(questionPrompt, files, counters) {
  const ranked = files.map((relPath) => {
    const header = readFile(relPath).slice(0, HEADER_CHARS);
    counters.search_tokens += estimateTokens(relPath) + estimateTokens(header);
    return {
      relPath,
      score: scoreFile(questionPrompt, relPath, header),
    };
  });

  ranked.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));
  return ranked;
}

function stopSatisfied(question, foundFiles) {
  return question.must_hit_files.every((relPath) => foundFiles.has(relPath));
}

function readRankedUntilSatisfied(question, rankedFiles, counters) {
  const foundFiles = new Set();
  const openedFiles = [];

  for (const item of rankedFiles) {
    const fullText = readFile(item.relPath);
    counters.search_tokens += estimateTokens(fullText);
    counters.num_files_opened += 1;
    openedFiles.push(item.relPath);
    if (question.must_hit_files.includes(item.relPath)) {
      foundFiles.add(item.relPath);
    }
    if (stopSatisfied(question, foundFiles)) {
      break;
    }
  }

  return { foundFiles, openedFiles };
}

function inferReportedModules(reportedFiles) {
  return [...new Set(reportedFiles.map(pathCategory))].sort();
}

function mapLookupScore(questionPrompt, lookup) {
  return overlapScore(tokenize(questionPrompt), `${lookup.question} ${lookup.modules.join(' ')} ${lookup.files.join(' ')}`);
}

function moduleScore(questionPrompt, moduleEntry) {
  return overlapScore(
    tokenize(questionPrompt),
    `${moduleEntry.id} ${moduleEntry.summary} ${(moduleEntry.search_hints ?? []).join(' ')} ${(moduleEntry.key_files ?? []).join(' ')}`
  );
}

function expandModuleToFiles(moduleEntry, inventory) {
  if (moduleEntry.id.startsWith('features.')) {
    const featureName = moduleEntry.id.split('.')[1];
    return inventory.filter((relPath) => relPath.startsWith(`src/features/${featureName}/`));
  }

  if (moduleEntry.id === 'core') return inventory.filter((relPath) => relPath.startsWith('src/core/'));
  if (moduleEntry.id === 'world') return inventory.filter((relPath) => relPath.startsWith('src/world/'));
  if (moduleEntry.id === 'defs') return inventory.filter((relPath) => relPath.startsWith('src/defs/'));
  if (moduleEntry.id === 'adapter') return inventory.filter((relPath) => relPath.startsWith('src/adapter/'));
  if (moduleEntry.id === 'presentation') return inventory.filter((relPath) => relPath.startsWith('src/presentation/'));
  if (moduleEntry.id === 'main') return ['src/main.ts'];
  if (moduleEntry.kind === 'doc') return (moduleEntry.key_files ?? []).filter(fileExists);

  return (moduleEntry.key_files ?? []).filter(fileExists);
}

function chooseTreatmentCandidates(question, mapData, inventory, counters) {
  const mapJsonText = fs.readFileSync(MAP_JSON_PATH, 'utf8');
  counters.search_tokens += estimateTokens(mapJsonText);

  const lookups = [...mapData.lookups]
    .map((lookup) => ({ ...lookup, score: mapLookupScore(question.prompt, lookup) }))
    .sort((a, b) => b.score - a.score || a.question.localeCompare(b.question));

  const modules = [...mapData.modules]
    .map((moduleEntry) => ({ ...moduleEntry, score: moduleScore(question.prompt, moduleEntry) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const candidateModuleIds = new Set();
  for (const lookup of lookups.slice(0, 2)) {
    for (const moduleId of lookup.modules ?? []) candidateModuleIds.add(moduleId);
  }
  for (const moduleEntry of modules.slice(0, 3)) {
    candidateModuleIds.add(moduleEntry.id);
  }

  const candidateFiles = new Set();
  for (const lookup of lookups.slice(0, 2)) {
    for (const relPath of lookup.files ?? []) {
      if (fileExists(relPath)) candidateFiles.add(relPath);
    }
  }

  for (const moduleId of candidateModuleIds) {
    const moduleEntry = mapData.modules.find((entry) => entry.id === moduleId);
    if (!moduleEntry) continue;
    for (const relPath of expandModuleToFiles(moduleEntry, inventory)) {
      candidateFiles.add(relPath);
    }
  }

  return [...candidateFiles].sort();
}

function runArm(question, arm, inventory, mapData) {
  const counters = {
    search_tokens: 0,
    num_files_opened: 0,
    num_search_ops: 0,
    num_repo_wide_searches: arm === 'baseline' ? 1 : 0,
  };

  const start = performance.now();

  let candidateFiles;
  let usedMapJson = false;
  let usedMapMd = false;

  if (arm === 'baseline') {
    candidateFiles = inventory;
    counters.num_search_ops += 1;
  } else {
    usedMapJson = true;
    candidateFiles = chooseTreatmentCandidates(question, mapData, inventory, counters);
    counters.num_search_ops += 2;
  }

  const rankedFiles = rankFiles(question.prompt, candidateFiles, counters);
  const { foundFiles, openedFiles } = readRankedUntilSatisfied(question, rankedFiles, counters);

  const reportedFiles = [...new Set([...openedFiles.filter((relPath) => question.must_hit_files.includes(relPath)), ...question.must_hit_files.filter((relPath) => foundFiles.has(relPath))])];
  const reportedModules = inferReportedModules(reportedFiles);
  const answerPayload = {
    reported_modules: reportedModules,
    reported_files: reportedFiles,
  };
  const answerTokens = estimateTokens(JSON.stringify(answerPayload));
  const end = performance.now();

  return {
    question_id: question.id,
    arm,
    run_id: `${arm}-${question.id}`,
    model: 'deterministic-corpus-runner',
    reported_modules: reportedModules,
    reported_files: reportedFiles,
    latency_ms: Math.round(end - start),
    search_tokens: counters.search_tokens,
    answer_tokens: answerTokens,
    total_tokens: counters.search_tokens + answerTokens,
    num_search_ops: counters.num_search_ops + counters.num_files_opened,
    num_files_opened: counters.num_files_opened,
    num_repo_wide_searches: counters.num_repo_wide_searches,
    used_map_json: usedMapJson,
    used_map_md: usedMapMd,
    notes: `candidate_files=${candidateFiles.length}; found=${foundFiles.size}/${question.must_hit_files.length}`,
  };
}

function repeatRun(question, arm, inventory, mapData, repetitions) {
  const rows = [];
  for (let i = 0; i < repetitions; i += 1) {
    const row = runArm(question, arm, inventory, mapData);
    row.run_id = `${arm}-${question.id}-${String(i + 1).padStart(2, '0')}`;
    rows.push(row);
  }
  return rows;
}

function parseArgs() {
  const repetitionsIndex = process.argv.indexOf('--repetitions');
  const outputIndex = process.argv.indexOf('--output');

  const repetitions = repetitionsIndex !== -1 ? Number(process.argv[repetitionsIndex + 1]) : 5;
  const output = outputIndex !== -1
    ? process.argv[outputIndex + 1]
    : 'tools/benchmark/search_proj_info/results/corpus-benchmark.jsonl';

  return { repetitions, output };
}

function main() {
  const { repetitions, output } = parseArgs();
  const dataset = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  const mapData = JSON.parse(fs.readFileSync(MAP_JSON_PATH, 'utf8'));
  const inventory = buildInventory();
  const rows = [];

  for (const question of dataset.questions) {
    rows.push(...repeatRun(question, 'baseline', inventory, mapData, repetitions));
    rows.push(...repeatRun(question, 'treatment', inventory, mapData, repetitions));
  }

  const outPath = path.isAbsolute(output) ? output : path.join(ROOT, output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  console.log(`Wrote ${rows.length} benchmark rows to ${path.relative(ROOT, outPath)}`);
}

main();
