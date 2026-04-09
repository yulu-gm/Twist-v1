import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, 'tools', 'benchmark', 'search_proj_info');
const QUESTIONS_PATH = path.join(BENCH_DIR, 'questions.json');

function resolveUserPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
}

function usage() {
  console.log('Usage: node tools/benchmark/search_proj_info/scaffold-run.mjs <baseline|treatment> <output.jsonl>');
}

const [, , arm, outputPath] = process.argv;

if (!arm || !outputPath) {
  usage();
  process.exit(1);
}

if (!['baseline', 'treatment'].includes(arm)) {
  console.error(`Invalid arm: ${arm}`);
  usage();
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
const records = dataset.questions.map((question, index) => ({
  question_id: question.id,
  arm,
  run_id: `${arm}-template-${String(index + 1).padStart(3, '0')}`,
  model: '',
  reported_modules: [],
  reported_files: [],
  latency_ms: null,
  search_tokens: null,
  answer_tokens: null,
  total_tokens: null,
  num_search_ops: 0,
  num_files_opened: 0,
  num_repo_wide_searches: 0,
  used_map_json: arm === 'treatment',
  used_map_md: false,
  notes: `Question: ${question.prompt}`,
}));

const outFullPath = resolveUserPath(outputPath);
fs.mkdirSync(path.dirname(outFullPath), { recursive: true });
fs.writeFileSync(outFullPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
const printablePath = path.isAbsolute(outputPath) ? outFullPath : path.relative(ROOT, outFullPath);
console.log(`Wrote ${records.length} scaffold rows to ${printablePath}`);
