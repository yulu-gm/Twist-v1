import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, 'tools', 'benchmark', 'search_proj_info');
const QUESTIONS_PATH = path.join(BENCH_DIR, 'questions.json');

function resolveUserPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function loadRecords(filePath) {
  const fullPath = resolveUserPath(filePath);
  const text = fs.readFileSync(fullPath, 'utf8').trim();
  if (!text) return [];

  if (filePath.endsWith('.json')) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.records ?? [];
  }

  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function normalizePathList(list) {
  return new Set((Array.isArray(list) ? list : []).map((item) => String(item)));
}

function gradeRecord(record, questionsById) {
  const question = questionsById.get(record.question_id);
  if (!question) {
    return { strict_correct: false, must_hit_recall: 0, question_missing: true };
  }

  const reported = normalizePathList(record.reported_files);
  const mustHit = question.must_hit_files;
  const hitCount = mustHit.filter((file) => reported.has(file)).length;
  const mustHitRecall = mustHit.length === 0 ? 1 : hitCount / mustHit.length;
  const strictCorrect = typeof record.correct_override === 'boolean'
    ? record.correct_override
    : hitCount === mustHit.length;

  return {
    strict_correct: strictCorrect,
    must_hit_recall: mustHitRecall,
    question_missing: false,
  };
}

function summarizeArm(records) {
  const graded = records.filter((record) => !record.question_missing);
  const strictCorrects = graded.filter((record) => record.strict_correct);
  const ratio = graded.length === 0 ? null : strictCorrects.length / graded.length;

  const metric = (key, input = graded) => median(input.map((record) => toNumber(record[key])).filter((value) => value !== null));

  return {
    runs: graded.length,
    strict_accuracy: ratio,
    median_latency_ms: metric('latency_ms'),
    median_search_tokens: metric('search_tokens'),
    median_answer_tokens: metric('answer_tokens'),
    median_total_tokens: metric('total_tokens'),
    median_num_search_ops: metric('num_search_ops'),
    median_num_files_opened: metric('num_files_opened'),
    median_num_repo_wide_searches: metric('num_repo_wide_searches'),
    median_must_hit_recall: median(graded.map((record) => record.must_hit_recall)),
  };
}

function perQuestionMedian(records, key) {
  const grouped = new Map();
  for (const record of records) {
    const list = grouped.get(record.question_id) ?? [];
    const value = toNumber(record[key]);
    if (value !== null) list.push(value);
    grouped.set(record.question_id, list);
  }

  const result = new Map();
  for (const [questionId, values] of grouped.entries()) {
    const value = median(values);
    if (value !== null) result.set(questionId, value);
  }
  return result;
}

function pairedDelta(baselineRecords, treatmentRecords, key) {
  const baseline = perQuestionMedian(baselineRecords, key);
  const treatment = perQuestionMedian(treatmentRecords, key);
  const deltas = [];
  const savings = [];

  for (const [questionId, baseValue] of baseline.entries()) {
    const treatmentValue = treatment.get(questionId);
    if (treatmentValue === undefined) continue;
    deltas.push(treatmentValue - baseValue);
    if (baseValue !== 0) {
      savings.push(1 - treatmentValue / baseValue);
    }
  }

  return {
    pairs: deltas.length,
    median_delta: median(deltas),
    median_saving_ratio: median(savings),
  };
}

const inputFiles = process.argv.slice(2);
if (inputFiles.length === 0) {
  console.error('Usage: node tools/benchmark/search_proj_info/report-benchmark.mjs <results-a.jsonl> <results-b.jsonl> ...');
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
const questionsById = new Map(dataset.questions.map((question) => [question.id, question]));

const records = inputFiles.flatMap(loadRecords).map((record) => ({
  ...record,
  ...gradeRecord(record, questionsById),
}));

const arms = new Map();
for (const record of records) {
  const list = arms.get(record.arm) ?? [];
  list.push(record);
  arms.set(record.arm, list);
}

const baselineRecords = arms.get('baseline') ?? [];
const treatmentRecords = arms.get('treatment') ?? [];

const output = {
  benchmark_id: dataset.benchmark_id,
  inputs: inputFiles,
  arms: Object.fromEntries([...arms.entries()].map(([arm, armRecords]) => [arm, summarizeArm(armRecords)])),
  paired: {
    latency_ms: pairedDelta(baselineRecords, treatmentRecords, 'latency_ms'),
    search_tokens: pairedDelta(baselineRecords, treatmentRecords, 'search_tokens'),
    total_tokens: pairedDelta(baselineRecords, treatmentRecords, 'total_tokens'),
    num_search_ops: pairedDelta(baselineRecords, treatmentRecords, 'num_search_ops'),
    num_repo_wide_searches: pairedDelta(baselineRecords, treatmentRecords, 'num_repo_wide_searches'),
  },
};

console.log(JSON.stringify(output, null, 2));
