import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";

const QUERY_CLI_PATH = path.join("tools", "aidoc", "query-module-lookup.mjs");
const DIRECT_QUERY_CLI_PATH = path.join("tools", "aidoc", "query-project-manually.mjs");
const DEFAULT_OUTPUT_DIR = path.join("docs", "ai", "index", "benchmarks");
const EXCLUDED_DIRECT_PATH_PREFIXES = ["docs/ai/index/", "docs/ai/systems/"];
const PRIMARY_CHANGED_FILE = "src/game/map/world-grid.ts";
const DIRECT_VARIANT = "direct_project_read";

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function sorted(values) {
  return [...values].sort();
}

function median(values) {
  if (values.length === 0) return 0;
  const ordered = sorted(values);
  const mid = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 0) {
    return (ordered[mid - 1] + ordered[mid]) / 2;
  }
  return ordered[mid];
}

function percentile(values, q) {
  if (values.length === 0) return 0;
  const ordered = sorted(values);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.ceil(q * ordered.length) - 1));
  return ordered[index];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function geometricMean(values) {
  if (values.length === 0) return 0;
  const product = values.reduce((result, value) => result * value, 1);
  return product ** (1 / values.length);
}

function approx(value) {
  return Number(value.toFixed(3));
}

function execJsonCli(rootDir, relativeScriptPath, args) {
  const scriptPath = path.join(rootDir, relativeScriptPath);
  const output = execFileSync(process.execPath, [scriptPath, "--with-metrics", ...args], {
    cwd: rootDir,
    encoding: "utf8"
  });

  return JSON.parse(output);
}

function flattenRoutedSystems(result) {
  if (Array.isArray(result?.routedSystems)) {
    return result.routedSystems;
  }

  if (Array.isArray(result?.matches)) {
    return [...new Set(result.matches.flatMap((match) => match.routedSystems ?? []))];
  }

  return [];
}

function flattenRoutedDocuments(result) {
  if (Array.isArray(result?.routedDocuments)) {
    return result.routedDocuments;
  }

  if (Array.isArray(result?.matches)) {
    return result.matches.flatMap((match) => match.routedDocuments ?? []);
  }

  return [];
}

function arraysContain(values, expected) {
  return expected.every((value) => values.includes(value));
}

function createScenarios() {
  return [
    {
      id: "module_lookup",
      title: "Module Entry Lookup",
      prompt: "grid",
      runSkill(rootDir) {
        const payload = execJsonCli(rootDir, QUERY_CLI_PATH, ["module", "grid"]);
        return { result: payload.result, metrics: payload.metrics };
      },
      runDirect(rootDir) {
        const payload = execJsonCli(rootDir, DIRECT_QUERY_CLI_PATH, ["module", "grid"]);
        return { result: payload.result, metrics: payload.metrics };
      },
      isCorrect(result) {
        return (
          (result?.implementationEntryFiles ?? []).includes("src/game/map/world-grid.ts") &&
          (result?.keyTestFiles ?? []).includes("tests/domain/world-grid.test.ts")
        );
      }
    },
    {
      id: "changed_file_primary_routed_lookup",
      title: "Changed File Primary Routed Lookup",
      prompt: PRIMARY_CHANGED_FILE,
      runSkill(rootDir) {
        const payload = execJsonCli(rootDir, QUERY_CLI_PATH, ["changed", PRIMARY_CHANGED_FILE]);
        return { result: payload.result, metrics: payload.metrics };
      },
      runDirect(rootDir) {
        const payload = execJsonCli(rootDir, DIRECT_QUERY_CLI_PATH, ["changed", PRIMARY_CHANGED_FILE]);
        return { result: payload.result, metrics: payload.metrics };
      },
      isCorrect(result) {
        const routedSystems = flattenRoutedSystems(result);
        const routedDocs = flattenRoutedDocuments(result);
        return (
          arraysContain(routedSystems, ["地图系统"]) &&
          routedDocs.some((doc) => doc.ohGenDoc === "oh-gen-doc/地图系统.yaml")
        );
      }
    },
    {
      id: "routed_system_lookup",
      title: "Routed System Lookup",
      prompt: "地图系统",
      runSkill(rootDir) {
        const payload = execJsonCli(rootDir, QUERY_CLI_PATH, ["routed", "地图系统"]);
        return { result: payload.result, metrics: payload.metrics };
      },
      runDirect(rootDir) {
        const payload = execJsonCli(rootDir, DIRECT_QUERY_CLI_PATH, ["routed", "地图系统"]);
        return { result: payload.result, metrics: payload.metrics };
      },
      isCorrect(result) {
        return (
          result?.routedSystem === "地图系统" &&
          result?.ohGenDoc === "oh-gen-doc/地图系统.yaml" &&
          result?.ohCodeDesign === "oh-code-design/地图系统.yaml" &&
          result?.ohAcceptance === "oh-acceptance/地图系统.yaml" &&
          arraysContain(result?.codeDirectories ?? [], ["src/game/map/", "src/scenes/renderers/"])
        );
      }
    }
  ];
}

function runVariant(rootDir, scenario, variantName, runner, iterations, warmupIterations) {
  for (let index = 0; index < warmupIterations; index += 1) {
    runner(rootDir);
  }

  const runs = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    let result = null;
    let metrics = { filesOpened: 0, bytesRead: 0 };
    let error = "";

    try {
      const response = runner(rootDir);
      result = response.result;
      metrics = response.metrics ?? metrics;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    runs.push({
      iteration: index + 1,
      variant: variantName,
      wall_ms_to_first_correct_answer: approx(performance.now() - start),
      files_opened: metrics.filesOpened,
      bytes_read: metrics.bytesRead,
      answer_correct: error.length === 0 && scenario.isCorrect(result),
      error
    });
  }

  const wallValues = runs.map((run) => run.wall_ms_to_first_correct_answer);
  const filesValues = runs.map((run) => run.files_opened);
  const bytesValues = runs.map((run) => run.bytes_read);
  const accuracy = runs.filter((run) => run.answer_correct).length / runs.length;

  return {
    runs,
    medianWallMs: approx(median(wallValues)),
    p95WallMs: approx(percentile(wallValues, 0.95)),
    accuracy: approx(accuracy),
    filesOpenedAvg: approx(average(filesValues)),
    bytesReadAvg: approx(average(bytesValues))
  };
}

function aggregateVariantSummaries(scenarios, key) {
  const allRuns = scenarios.flatMap((scenario) => scenario.variants[key].runs);
  const wallValues = allRuns.map((run) => run.wall_ms_to_first_correct_answer);
  const filesValues = allRuns.map((run) => run.files_opened);
  const bytesValues = allRuns.map((run) => run.bytes_read);
  const accuracy = allRuns.filter((run) => run.answer_correct).length / Math.max(1, allRuns.length);

  return {
    medianWallMs: approx(median(wallValues)),
    p95WallMs: approx(percentile(wallValues, 0.95)),
    accuracy: approx(accuracy),
    filesOpenedAvg: approx(average(filesValues)),
    bytesReadAvg: approx(average(bytesValues))
  };
}

export function runAidocLookupBenchmark(rootDir, options = {}) {
  const iterations = Number(options.iterations ?? 7);
  const warmupIterations = Number(options.warmupIterations ?? 1);
  const minSpeedupRatio = Number(options.minSpeedupRatio ?? 1.05);
  const timestamp = options.timestamp ?? new Date().toISOString();

  const scenarios = createScenarios().map((scenario) => {
    const skill = runVariant(rootDir, scenario, "skill_query", scenario.runSkill, iterations, warmupIterations);
    const direct = runVariant(
      rootDir,
      scenario,
      DIRECT_VARIANT,
      scenario.runDirect,
      iterations,
      warmupIterations
    );
    const speedupRatio = direct.medianWallMs / Math.max(skill.medianWallMs, Number.EPSILON);

    return {
      id: scenario.id,
      title: scenario.title,
      prompt: scenario.prompt,
      variants: {
        skill_query: skill,
        [DIRECT_VARIANT]: direct
      },
      speedupRatio: approx(speedupRatio),
      pass: skill.accuracy >= direct.accuracy && skill.accuracy >= 1,
      faster: speedupRatio >= minSpeedupRatio
    };
  });

  const aggregateSkill = aggregateVariantSummaries(scenarios, "skill_query");
  const aggregateDirect = aggregateVariantSummaries(scenarios, DIRECT_VARIANT);
  const speedupRatio = geometricMean(
    scenarios.map((scenario) => scenario.speedupRatio).filter((value) => Number.isFinite(value) && value > 0)
  );
  const pass =
    aggregateSkill.accuracy >= aggregateDirect.accuracy &&
    aggregateSkill.accuracy >= 1 &&
    speedupRatio >= minSpeedupRatio;

  return {
    meta: {
      timestamp,
      rootDir: normalizePath(rootDir),
      iterations,
      warmupIterations,
      minSpeedupRatio,
      methodology: {
        skill_query: {
          entrypoint: normalizePath(QUERY_CLI_PATH),
          measurement: "Spawn the aidoc lookup CLI and measure end-to-end wall time plus reported query I/O."
        },
        direct_project_read: {
          entrypoint: normalizePath(DIRECT_QUERY_CLI_PATH),
          measurement:
            "Spawn a manual project-read CLI that scans project code and authoritative route-demand docs without using aidoc index files.",
          excludedPathPrefixes: EXCLUDED_DIRECT_PATH_PREFIXES
        },
        aggregate: {
          speedupRatio:
            "Geometric mean of per-scenario median speedup ratios so each scenario category is weighted evenly."
        }
      }
    },
    scenarios,
    aggregate: {
      skill_query: aggregateSkill,
      [DIRECT_VARIANT]: aggregateDirect,
      speedupRatio: approx(speedupRatio)
    },
    pass
  };
}

export function buildAidocBenchmarkMarkdown(report) {
  const lines = [
    "# AIDOC Lookup Benchmark",
    "",
    `- timestamp: ${report.meta.timestamp}`,
    `- iterations: ${report.meta.iterations}`,
    `- warmupIterations: ${report.meta.warmupIterations}`,
    `- minSpeedupRatio: ${report.meta.minSpeedupRatio}`,
    `- pass: ${report.pass}`,
    `- skill_query.entrypoint: ${report.meta.methodology.skill_query.entrypoint}`,
    `- direct_project_read.entrypoint: ${report.meta.methodology.direct_project_read.entrypoint}`,
    `- direct_project_read.excludedPathPrefixes: ${report.meta.methodology.direct_project_read.excludedPathPrefixes.join(", ")}`,
    `- aggregate.speedupRatio: ${report.meta.methodology.aggregate.speedupRatio}`,
    "",
    "## Aggregate",
    "",
    "| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| skill_query | ${report.aggregate.skill_query.medianWallMs} | ${report.aggregate.skill_query.p95WallMs} | ${report.aggregate.skill_query.accuracy} | ${report.aggregate.skill_query.filesOpenedAvg} | ${report.aggregate.skill_query.bytesReadAvg} |`,
    `| ${DIRECT_VARIANT} | ${report.aggregate[DIRECT_VARIANT].medianWallMs} | ${report.aggregate[DIRECT_VARIANT].p95WallMs} | ${report.aggregate[DIRECT_VARIANT].accuracy} | ${report.aggregate[DIRECT_VARIANT].filesOpenedAvg} | ${report.aggregate[DIRECT_VARIANT].bytesReadAvg} |`,
    "",
    `- speedupRatio: ${report.aggregate.speedupRatio}`,
    "",
    "## Scenarios",
    "",
    "| scenario | skill median ms | direct median ms | speedupRatio | pass | faster |",
    "| --- | ---: | ---: | ---: | --- | --- |"
  ];

  for (const scenario of report.scenarios) {
    lines.push(
      `| ${scenario.id} | ${scenario.variants.skill_query.medianWallMs} | ${scenario.variants[DIRECT_VARIANT].medianWallMs} | ${scenario.speedupRatio} | ${scenario.pass} | ${scenario.faster} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function sanitizeTimestamp(timestamp) {
  return timestamp.replace(/[:]/g, "-").replace(/\..+$/, "");
}

export function writeAidocBenchmarkArtifacts(rootDir, report, outputDir = DEFAULT_OUTPUT_DIR) {
  const outputDirectory = path.join(rootDir, outputDir);
  mkdirSync(outputDirectory, { recursive: true });

  const slug = sanitizeTimestamp(report.meta.timestamp);
  const latestJson = path.join(outputDirectory, "aidoc-lookup-benchmark.latest.json");
  const latestMarkdown = path.join(outputDirectory, "aidoc-lookup-benchmark.latest.md");
  const stampedJson = path.join(outputDirectory, `aidoc-lookup-benchmark.${slug}.json`);
  const stampedMarkdown = path.join(outputDirectory, `aidoc-lookup-benchmark.${slug}.md`);

  const markdown = buildAidocBenchmarkMarkdown(report);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  writeFileSync(latestJson, json, "utf8");
  writeFileSync(stampedJson, json, "utf8");
  writeFileSync(latestMarkdown, markdown, "utf8");
  writeFileSync(stampedMarkdown, markdown, "utf8");

  return {
    latestJson: normalizePath(path.relative(rootDir, latestJson)),
    latestMarkdown: normalizePath(path.relative(rootDir, latestMarkdown)),
    stampedJson: normalizePath(path.relative(rootDir, stampedJson)),
    stampedMarkdown: normalizePath(path.relative(rootDir, stampedMarkdown))
  };
}

function parseCliArgs(argv) {
  const parsed = {
    iterations: 7,
    warmupIterations: 1,
    minSpeedupRatio: 1.05,
    outputDir: DEFAULT_OUTPUT_DIR,
    timestamp: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--iterations" && argv[index + 1]) {
      parsed.iterations = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--warmup" && argv[index + 1]) {
      parsed.warmupIterations = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--min-speedup" && argv[index + 1]) {
      parsed.minSpeedupRatio = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--output-dir" && argv[index + 1]) {
      parsed.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--timestamp" && argv[index + 1]) {
      parsed.timestamp = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function main(argv) {
  const args = parseCliArgs(argv.slice(2));
  const rootDir = process.cwd();
  const report = runAidocLookupBenchmark(rootDir, args);
  const artifacts = writeAidocBenchmarkArtifacts(rootDir, report, args.outputDir);
  process.stdout.write(
    `${JSON.stringify(
      {
        pass: report.pass,
        speedupRatio: report.aggregate.speedupRatio,
        artifacts
      },
      null,
      2
    )}\n`
  );

  if (!report.pass) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  normalizePath(path.resolve(process.argv[1])) ===
    normalizePath(path.resolve(fileURLToPath(import.meta.url)))
) {
  main(process.argv);
}
