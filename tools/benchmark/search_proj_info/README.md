# `search_proj_info` Benchmark

This benchmark measures whether the repo-local skill `search_proj_info` reduces search cost versus direct repo search.

The benchmark compares two arms:

- `baseline`: no skill, no `project-map/project-module-map.{json,md}` usage
- `treatment`: follow the skill workflow, read the module map first, then narrow search

The benchmark is designed around objective file-location tasks. A run is considered correct when the reported files include every `must_hit_file` for the question.

## Directory contents

- `questions.json`: benchmark dataset and golden answer keys
- `baseline.prompt.md`: prompt template for the baseline arm
- `treatment.prompt.md`: prompt template for the treatment arm
- `run-record.example.jsonl`: example result rows
- `scaffold-run.mjs`: generate an empty JSONL file to fill during benchmark runs
- `validate-benchmark.mjs`: validate dataset integrity and referenced paths
- `report-benchmark.mjs`: aggregate benchmark rows and print paired metrics

## Measurement principles

Both arms must satisfy the same stopping rule:

1. answer the same question
2. report files/modules in a structured JSON answer
3. stop only when the answer is sufficient to satisfy the gold key

Primary metrics:

- `latency_ms`
- `search_tokens`
- `total_tokens`

Secondary metrics:

- `answer_tokens`
- `num_search_ops`
- `num_files_opened`
- `num_repo_wide_searches`

## Recommended workflow

1. Validate the dataset:

```bash
npm run benchmark:search-proj-info:validate
```

2. Scaffold empty run logs:

```bash
npm run benchmark:search-proj-info:scaffold -- baseline tools/benchmark/search_proj_info/results/baseline.jsonl
npm run benchmark:search-proj-info:scaffold -- treatment tools/benchmark/search_proj_info/results/treatment.jsonl
```

3. Run each question in a fresh session and fill in:

- `latency_ms`
- `search_tokens`
- `answer_tokens`
- `total_tokens`
- `reported_files`
- `reported_modules`
- operation counts

4. Aggregate results:

```bash
npm run benchmark:search-proj-info:report -- \
  tools/benchmark/search_proj_info/results/baseline.jsonl \
  tools/benchmark/search_proj_info/results/treatment.jsonl
```

## Run record fields

Each JSONL row should include:

- `question_id`
- `arm`
- `run_id`
- `model`
- `reported_files`
- `reported_modules`
- `latency_ms`
- `search_tokens`
- `answer_tokens`
- `total_tokens`
- `num_search_ops`
- `num_files_opened`
- `num_repo_wide_searches`
- `used_map_json`
- `used_map_md`
- `notes`

Optional fields:

- `correct_override`: manual override if you intentionally want to replace auto-grading
- `error`: record runner failures or invalid outputs

## Fairness constraints

- Same model and temperature across both arms
- Same repo snapshot
- Fresh session per question
- Randomized question order
- At least 3 repetitions per question per arm
- Baseline may not read `project-map/project-module-map.json` or `.md`
- Treatment should read the map before widening search

## Limits

This benchmark is objective on file-location accuracy. It does not fully score explanation quality. If you need explanation quality later, add a second pass rubric; do not mix it into the primary time/token benchmark.
