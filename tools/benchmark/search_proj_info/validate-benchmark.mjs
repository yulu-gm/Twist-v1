import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, 'tools', 'benchmark', 'search_proj_info');
const QUESTIONS_PATH = path.join(BENCH_DIR, 'questions.json');
const BASELINE_PROMPT = path.join(BENCH_DIR, 'baseline.prompt.md');
const TREATMENT_PROMPT = path.join(BENCH_DIR, 'treatment.prompt.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

const dataset = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));

if (dataset.schema_version !== 1) {
  fail(`Unsupported schema_version: ${dataset.schema_version}`);
}

if (!Array.isArray(dataset.questions) || dataset.questions.length < 10) {
  fail('Benchmark must contain at least 10 questions.');
}

const ids = new Set();
const missingPaths = new Set();

for (const question of dataset.questions) {
  if (ids.has(question.id)) {
    fail(`Duplicate question id: ${question.id}`);
  }
  ids.add(question.id);

  if (!Array.isArray(question.must_hit_files) || question.must_hit_files.length === 0) {
    fail(`Question ${question.id} must define must_hit_files.`);
  }

  for (const relPath of [...question.must_hit_files, ...(question.secondary_files ?? [])]) {
    if (!exists(relPath)) {
      missingPaths.add(relPath);
    }
  }
}

for (const relPath of [dataset.map_paths.json, dataset.map_paths.markdown]) {
  if (!exists(relPath)) {
    missingPaths.add(relPath);
  }
}

for (const filePath of [BASELINE_PROMPT, TREATMENT_PROMPT]) {
  if (!fs.existsSync(filePath)) {
    missingPaths.add(path.relative(ROOT, filePath));
  }
}

if (missingPaths.size > 0) {
  fail(`Benchmark references missing paths:\n${[...missingPaths].sort().join('\n')}`);
}

console.log(JSON.stringify({
  benchmark_id: dataset.benchmark_id,
  question_count: dataset.questions.length,
  map_json: dataset.map_paths.json,
  map_markdown: dataset.map_paths.markdown,
  status: 'ok',
}, null, 2));
