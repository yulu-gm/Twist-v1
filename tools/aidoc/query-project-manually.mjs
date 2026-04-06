import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROUTE_REGISTRY_PATH = path.join(
  ".agent",
  "skills",
  "route-demand",
  "references",
  "system-registry.md"
);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function uniqueInOrder(values) {
  return [...new Set(values)];
}

function createTracker() {
  return {
    filesOpened: 0,
    bytesRead: 0
  };
}

function trackedReadUtf8(rootDir, relativePath, tracker) {
  const normalized = normalizePath(relativePath);
  const absolute = path.join(rootDir, normalized);
  const content = readFileSync(absolute, "utf8");
  tracker.filesOpened += 1;
  tracker.bytesRead += Buffer.byteLength(content, "utf8");
  return content;
}

function splitList(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRouteRegistry(rootDir, tracker) {
  const content = trackedReadUtf8(rootDir, ROUTE_REGISTRY_PATH, tracker);
  const lines = content.split(/\r?\n/);
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith("| system |")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith("|")) break;
    if (/^\|\s*-+/.test(line)) continue;

    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length < 7) continue;

    rows.push({
      system: cells[0],
      ohGenDoc: cells[1],
      ohCodeDesign: cells[2],
      ohAcceptance: cells[3],
      codeDirectories: splitList(cells[4])
    });
  }

  return rows;
}

function walkFiles(rootDir, relativeDirectory) {
  const directory = path.join(rootDir, normalizePath(relativeDirectory));
  if (!existsSync(directory)) {
    return [];
  }

  const result = [];
  const queue = [directory];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const entry of readdirSync(current)) {
      const absolute = path.join(current, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        queue.push(absolute);
        continue;
      }
      if (stats.isFile()) {
        result.push(normalizePath(path.relative(rootDir, absolute)));
      }
    }
  }

  return result.sort();
}

function buildTerms(query) {
  const normalized = query.trim().toLowerCase();
  const terms = normalized
    .split(/[^a-z0-9]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalized.includes("grid")) {
    terms.push("map", "world");
  }

  return uniqueInOrder([normalized, ...terms]);
}

function scoreFile(relativePath, content, terms) {
  const normalizedPath = normalizePath(relativePath).toLowerCase();
  const basename = path.posix.basename(normalizedPath);
  const sourceBias = normalizedPath.startsWith("src/game/") ? 20 : 0;
  const rendererPenalty = normalizedPath.includes("/renderers/") ? -10 : 0;
  const testBias = normalizedPath.startsWith("tests/") ? 5 : 0;

  let score = sourceBias + rendererPenalty + testBias;
  for (const term of terms) {
    if (basename === `${term}.ts`) {
      score += 140;
    }
    if (basename === `${term}.test.ts`) {
      score += 120;
    }
    if (normalizedPath.includes(`/${term}.`)) {
      score += 90;
    }
    if (normalizedPath.includes(term)) {
      score += 40;
    }

    const hits = content.toLowerCase().split(term).length - 1;
    if (hits > 0) {
      score += Math.min(12, hits);
    }
  }

  return score;
}

function buildRoutedDocuments(rows) {
  return rows.map((row) => ({
    routedSystem: row.system,
    ohGenDoc: row.ohGenDoc,
    ohCodeDesign: row.ohCodeDesign,
    ohAcceptance: row.ohAcceptance
  }));
}

export function manualLookupModule(rootDir, query, tracker = createTracker()) {
  const files = [
    ...walkFiles(rootDir, "src"),
    ...walkFiles(rootDir, "tests")
  ];
  const terms = buildTerms(query);
  const ranked = files
    .map((relativePath) => ({
      relativePath,
      score: scoreFile(relativePath, trackedReadUtf8(rootDir, relativePath, tracker), terms)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath));

  const bestSource = ranked.find((entry) => entry.relativePath.startsWith("src/"));
  if (!bestSource) {
    throw new Error(`manual lookup: no source match for "${query}"`);
  }

  const sourceStem = path.posix.basename(bestSource.relativePath, path.posix.extname(bestSource.relativePath));
  const keyTests = ranked
    .filter(
      (entry) =>
        entry.relativePath.startsWith("tests/") &&
        (entry.relativePath.includes(sourceStem) || terms.some((term) => entry.relativePath.includes(term)))
    )
    .slice(0, 3)
    .map((entry) => entry.relativePath);

  const sceneEntryFiles = existsSync(path.join(rootDir, "src", "scenes", "GameScene.ts"))
    ? ["src/scenes/GameScene.ts"]
    : [];

  return {
    result: {
      query,
      implementationEntryFiles: [bestSource.relativePath],
      keyTestFiles: keyTests,
      sceneEntryFiles
    },
    metrics: tracker
  };
}

export function manualLookupChangedFiles(rootDir, changedFiles, tracker = createTracker()) {
  const rows = readRouteRegistry(rootDir, tracker);
  const normalizedChanged = changedFiles.map((value) => normalizePath(value));
  const matches = rows
    .map((row) => {
      const matchedFiles = normalizedChanged.filter((changedFile) =>
        row.codeDirectories.some((directory) => changedFile.startsWith(normalizePath(directory)))
      );

      if (matchedFiles.length === 0) {
        return null;
      }

      return {
        routedSystems: [row.system],
        routedDocuments: buildRoutedDocuments([row]),
        matchedFiles,
        codeDirectories: row.codeDirectories
      };
    })
    .filter(Boolean);

  return {
    result: {
      changedFiles: normalizedChanged,
      matches,
      routedSystems: uniqueInOrder(matches.flatMap((match) => match.routedSystems)),
      routedDocuments: buildRoutedDocuments(
        rows.filter((row) =>
          matches.some((match) => match.routedSystems.includes(row.system))
        )
      )
    },
    metrics: tracker
  };
}

export function manualLookupRoutedSystem(rootDir, routedSystem, tracker = createTracker()) {
  const rows = readRouteRegistry(rootDir, tracker);
  const row = rows.find((candidate) => candidate.system === routedSystem);

  if (!row) {
    throw new Error(`manual lookup: unknown routed system "${routedSystem}"`);
  }

  return {
    result: {
      routedSystem: row.system,
      ohGenDoc: row.ohGenDoc,
      ohCodeDesign: row.ohCodeDesign,
      ohAcceptance: row.ohAcceptance,
      codeDirectories: row.codeDirectories
    },
    metrics: tracker
  };
}

function main(argv) {
  const rawArgs = argv.slice(2);
  const includeMetrics = rawArgs.includes("--with-metrics");
  const args = rawArgs.filter((value) => value !== "--with-metrics");
  const [command = "module", ...rest] = args;
  const rootDir = process.cwd();
  const tracker = includeMetrics ? createTracker() : createTracker();

  let payload;
  if (command === "module") {
    payload = {
      queryType: "module",
      query: rest.join(" ").trim(),
      ...manualLookupModule(rootDir, rest.join(" ").trim(), tracker)
    };
  } else if (command === "changed") {
    payload = {
      queryType: "changed",
      changedFiles: rest,
      ...manualLookupChangedFiles(rootDir, rest, tracker)
    };
  } else if (command === "routed") {
    payload = {
      queryType: "routed",
      query: rest.join(" ").trim(),
      ...manualLookupRoutedSystem(rootDir, rest.join(" ").trim(), tracker)
    };
  } else {
    throw new Error(`manual lookup: unknown command "${command}"`);
  }

  if (!includeMetrics) {
    delete payload.metrics;
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (
  process.argv[1] &&
  normalizePath(path.resolve(process.argv[1])) ===
    normalizePath(path.resolve(fileURLToPath(import.meta.url)))
) {
  main(process.argv);
}
