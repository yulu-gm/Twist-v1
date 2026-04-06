import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  buildAidocBenchmarkMarkdown,
  runAidocLookupBenchmark
} from "../tools/aidoc/benchmark-lookup.mjs";

const rootDir = path.resolve(__dirname, "..");

describe("aidoc benchmark reporting", () => {
  it("builds a stable report shape for skill and direct lookups", () => {
    const report = runAidocLookupBenchmark(rootDir, {
      iterations: 1,
      warmupIterations: 0,
      timestamp: "2026-04-06T00:00:00.000Z"
    });

    expect(report.meta.timestamp).toBe("2026-04-06T00:00:00.000Z");
    expect(report.scenarios).toHaveLength(3);
    expect(report.meta.methodology.skill_query.entrypoint).toContain(
      "tools/aidoc/query-module-lookup.mjs"
    );
    expect(report.meta.methodology.direct_project_read.excludedPathPrefixes).toEqual([
      "docs/ai/index/",
      "docs/ai/systems/"
    ]);
    expect(report.aggregate.skill_query.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.aggregate.direct_project_read.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.aggregate.skill_query.filesOpenedAvg).toBeGreaterThan(0);
    expect(report.aggregate.skill_query.bytesReadAvg).toBeGreaterThan(0);
    expect(report.aggregate.direct_project_read.filesOpenedAvg).toBeGreaterThan(
      report.aggregate.skill_query.filesOpenedAvg
    );
    expect(report.aggregate.direct_project_read.bytesReadAvg).toBeGreaterThan(
      report.aggregate.skill_query.bytesReadAvg
    );
    expect(report.aggregate.speedupRatio).toBeGreaterThan(0);
    expect(report.pass).toEqual(expect.any(Boolean));
  });

  it("renders a markdown summary for benchmark output", () => {
    const report = runAidocLookupBenchmark(rootDir, {
      iterations: 1,
      warmupIterations: 0,
      timestamp: "2026-04-06T00:00:00.000Z"
    });

    const markdown = buildAidocBenchmarkMarkdown(report);

    expect(markdown).toContain("# AIDOC Lookup Benchmark");
    expect(markdown).toContain("skill_query");
    expect(markdown).toContain("direct_project_read");
    expect(markdown).toContain("speedupRatio");
    expect(markdown).toContain("excludedPathPrefixes");
  });
});
