import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const INDEX_PATH = path.join("docs", "ai", "index", "system-index.json");
const ROUTE_REGISTRY_PATH = path.join(
  ".agent",
  "skills",
  "route-demand",
  "references",
  "system-registry.md"
);
const MANAGED_PREFIX = "[aidoc-sync]";
const MANAGED_SOURCE = "push-with-aidoc";

function trackRead(content, tracker) {
  if (!tracker) {
    return;
  }

  tracker.filesOpened += 1;
  tracker.bytesRead += Buffer.byteLength(content, "utf8");
}

function readUtf8(filePath, tracker) {
  const content = readFileSync(filePath, "utf8");
  trackRead(content, tracker);
  return content;
}

function readJson(filePath, tracker) {
  return JSON.parse(readUtf8(filePath, tracker));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function uniqueInOrder(values) {
  return [...new Set(values)];
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

function ensureRelativePath(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

function createLookupContext(rootDir, options = {}) {
  return {
    rootDir,
    tracker: options.tracker,
    systemIndex: null,
    routeRegistry: null
  };
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function normalizeQuery(value) {
  return normalizePath(value).toLowerCase();
}

function basename(value) {
  return path.posix.basename(normalizePath(value));
}

function getSystemSearchFields(system) {
  return uniqueSorted([
    system.key,
    system.summary,
    system.standardDoc,
    system.aidocDir,
    system.systemReadme,
    ...(system.lookupAliases ?? []),
    ...(system.sharedEntryFiles ?? []),
    ...(system.sourceFiles ?? []),
    ...(system.testFiles ?? []),
    ...(system.sceneEntryFiles ?? []),
    ...(system.integrationFiles ?? []),
    ...(system.latestAidocs ?? [])
  ]);
}

function getTrackedFiles(system) {
  return uniqueSorted([
    system.standardDoc,
    system.systemReadme,
    ...(system.sharedEntryFiles ?? []),
    ...(system.sourceFiles ?? []),
    ...(system.testFiles ?? []),
    ...(system.sceneEntryFiles ?? []),
    ...(system.integrationFiles ?? []),
    ...(system.latestAidocs ?? [])
  ]);
}

function scoreMatch(candidate, query) {
  const normalizedCandidate = normalizeQuery(candidate);
  const normalizedQuery = normalizeQuery(query);

  if (normalizedCandidate === normalizedQuery) {
    return 100;
  }

  if (basename(candidate).toLowerCase() === normalizedQuery) {
    return 90;
  }

  if (normalizedCandidate.endsWith(`/${normalizedQuery}`)) {
    return 85;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 60;
  }

  return 0;
}

function readRouteRegistryFromContext(context) {
  if (context.routeRegistry) {
    return context.routeRegistry;
  }

  const filePath = ensureRelativePath(context.rootDir, ROUTE_REGISTRY_PATH);
  const content = readUtf8(filePath, context.tracker);
  const lines = content.split(/\r?\n/);
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith("| system |")) {
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    if (!line.startsWith("|")) {
      break;
    }

    if (/^\|\s*-+/.test(line)) {
      continue;
    }

    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length < 7) {
      continue;
    }

    rows.push({
      system: cells[0],
      ohGenDoc: cells[1],
      ohCodeDesign: cells[2],
      ohAcceptance: cells[3],
      codeDirectories: splitList(cells[4]),
      defaultValidationLevel: cells[5],
      upstreamDependencies: splitList(cells[6])
    });
  }

  context.routeRegistry = rows;
  return rows;
}

function lookupRoutedSystemRecord(context, routedSystem) {
  const record = readRouteRegistryFromContext(context).find((row) => row.system === routedSystem);

  if (!record) {
    throw new Error(`aidoc lookup: unknown routed system "${routedSystem}"`);
  }

  return record;
}

function buildRoutedDocumentsFromContext(context, routedSystems) {
  return routedSystems.map((routedSystem) => {
    const record = lookupRoutedSystemRecord(context, routedSystem);
    return {
      routedSystem: record.system,
      ohGenDoc: record.ohGenDoc,
      ohCodeDesign: record.ohCodeDesign,
      ohAcceptance: record.ohAcceptance
    };
  });
}

function buildModuleLookupResult(context, system, query, matchedBy, matchedFields) {
  return {
    query,
    matchedBy,
    matchedFields,
    system,
    implementationEntryFiles: uniqueInOrder([
      ...(system.sharedEntryFiles ?? []),
      ...(system.sourceFiles ?? [])
    ]),
    keyTestFiles: uniqueInOrder(system.testFiles ?? []),
    sceneEntryFiles: uniqueInOrder(system.sceneEntryFiles ?? []),
    routedSystems: uniqueInOrder(system.routedSystems ?? []),
    routedDocuments: buildRoutedDocumentsFromContext(context, system.routedSystems ?? []),
    sharedEntryFiles: uniqueInOrder(system.sharedEntryFiles ?? []),
    integrationFiles: uniqueInOrder(system.integrationFiles ?? []),
    latestAidocs: uniqueInOrder(system.latestAidocs ?? []),
    lookupAliases: uniqueInOrder(system.lookupAliases ?? [])
  };
}

function findSystemMatch(system, query) {
  const normalizedQuery = normalizeQuery(query);
  let bestScore = 0;
  let matchedBy = "";

  for (const alias of system.lookupAliases ?? []) {
    const score = scoreMatch(alias, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      matchedBy = "alias";
    }
  }

  const keyScore = scoreMatch(system.key, normalizedQuery);
  if (keyScore > bestScore) {
    bestScore = keyScore;
    matchedBy = "key";
  }

  for (const field of getSystemSearchFields(system)) {
    const score = scoreMatch(field, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      matchedBy = field === system.key ? "key" : "path";
    }
  }

  if (bestScore === 0) {
    return null;
  }

  const matchedFields = getSystemSearchFields(system).filter((field) => {
    const normalizedField = normalizeQuery(field);
    return (
      normalizedField === normalizedQuery ||
      basename(field).toLowerCase() === normalizedQuery ||
      normalizedField.includes(normalizedQuery)
    );
  });

  return {
    matchedBy,
    matchedFields,
    score: bestScore
  };
}

function lookupChangedFilesMatch(context, changedFiles) {
  const systemIndex = readSystemIndexFromContext(context);
  const normalized = changedFiles.map((file) => normalizePath(file));

  return systemIndex.systems
    .map((system) => {
      const trackedFiles = getTrackedFiles(system);
      const matchedFiles = uniqueSorted(
        trackedFiles.filter((trackedFile) => normalized.includes(trackedFile))
      );

      if (matchedFiles.length === 0) {
        return null;
      }

      const lookup = buildModuleLookupResult(
        context,
        system,
        matchedFiles[0],
        "path",
        matchedFiles
      );

      return {
        systemKey: system.key,
        matchedFiles,
        ...lookup
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.systemKey.localeCompare(right.systemKey));
}

function readSystemIndexFromContext(context) {
  if (context.systemIndex) {
    return context.systemIndex;
  }

  const filePath = ensureRelativePath(context.rootDir, INDEX_PATH);
  const json = readJson(filePath, context.tracker);

  if (!json || !Array.isArray(json.systems)) {
    throw new Error("aidoc index: system-index.json must contain a systems array");
  }

  context.systemIndex = json;
  return json;
}

export function readSystemIndex(rootDir, options = {}) {
  return readSystemIndexFromContext(createLookupContext(rootDir, options));
}

export function lookupModule(rootDir, query, options = {}) {
  const context = createLookupContext(rootDir, options);
  const systemIndex = readSystemIndexFromContext(context);
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("aidoc lookup: module query must not be empty");
  }

  const matches = systemIndex.systems
    .map((system) => {
      const match = findSystemMatch(system, normalizedQuery);
      if (!match) return null;
      return {
        system,
        ...match
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.system.key.localeCompare(right.system.key);
    });

  const bestMatch = matches[0];

  if (!bestMatch) {
    throw new Error(`aidoc lookup: no module matched "${query}"`);
  }

  return buildModuleLookupResult(
    context,
    bestMatch.system,
    normalizedQuery,
    bestMatch.matchedBy,
    bestMatch.matchedFields
  );
}

function analyzeChangedFilesFromContext(context, changedFiles) {
  const systemIndex = readSystemIndexFromContext(context);
  const normalized = changedFiles.map((file) => normalizePath(file));
  const matchedSystems = [];
  const docPaths = [];

  for (const system of systemIndex.systems) {
    const trackedFiles = getTrackedFiles(system);
    const isImpacted = normalized.some((file) => trackedFiles.includes(file));
    if (!isImpacted) continue;

    matchedSystems.push(system.key);
    docPaths.push(system.systemReadme, ...(system.latestAidocs ?? []), ...(system.integrationFiles ?? []));
  }

  const impactedSystems = uniqueSorted(matchedSystems);
  const docPathsToReview = uniqueSorted(docPaths);

  return {
    impactedSystems,
    docPathsToReview,
    requiresSystemAidocReview: impactedSystems.length > 0
  };
}

export function analyzeChangedFiles(rootDir, changedFiles, options = {}) {
  return analyzeChangedFilesFromContext(createLookupContext(rootDir, options), changedFiles);
}

export function lookupChangedFiles(rootDir, changedFiles, options = {}) {
  const context = createLookupContext(rootDir, options);
  const analysis = analyzeChangedFilesFromContext(context, changedFiles);

  return {
    ...analysis,
    matches: lookupChangedFilesMatch(context, changedFiles)
  };
}

export function lookupRoutedSystem(rootDir, routedSystem, options = {}) {
  const context = createLookupContext(rootDir, options);
  const record = lookupRoutedSystemRecord(context, routedSystem);

  return {
    routedSystem: record.system,
    ohGenDoc: record.ohGenDoc,
    ohCodeDesign: record.ohCodeDesign,
    ohAcceptance: record.ohAcceptance,
    codeDirectories: record.codeDirectories
  };
}

export function buildManagedCommitMessage({ summary, systems, updatedDocs }) {
  const normalizedSystems = uniqueSorted(systems);
  const normalizedDocs = uniqueSorted(updatedDocs);

  return [
    `${MANAGED_PREFIX} ${summary}`,
    "",
    "AIDOC-Managed: true",
    `AIDOC-Systems: ${normalizedSystems.join(",")}`,
    `AIDOC-Index: ${INDEX_PATH.replace(/\\/g, "/")}`,
    `AIDOC-Updated: ${normalizedDocs.join(",")}`,
    `AIDOC-Source: ${MANAGED_SOURCE}`
  ].join("\n");
}

export function parseManagedCommitMessage(message) {
  const lines = message.split(/\r?\n/);
  const title = lines[0] ?? "";
  const match = title.match(/^\[aidoc-sync\]\s+(.+)$/);

  if (!match) {
    return {
      managed: false,
      summary: "",
      systems: [],
      updatedDocs: [],
      source: ""
    };
  }

  const trailers = new Map();
  for (const line of lines.slice(1)) {
    const trailerMatch = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!trailerMatch) continue;
    trailers.set(trailerMatch[1], trailerMatch[2]);
  }

  return {
    managed: trailers.get("AIDOC-Managed") === "true",
    summary: match[1],
    systems: (trailers.get("AIDOC-Systems") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    updatedDocs: (trailers.get("AIDOC-Updated") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    source: trailers.get("AIDOC-Source") ?? ""
  };
}

export function validateSystemIndex(rootDir) {
  const systemIndex = readSystemIndex(rootDir);
  const missing = [];

  for (const system of systemIndex.systems) {
    const requiredFields = [
      system.key,
      system.summary,
      system.standardDoc,
      system.aidocDir,
      system.systemReadme
    ];
    if (requiredFields.some((field) => typeof field !== "string" || field.length === 0)) {
      missing.push(`system ${system.key || "<unknown>"} has missing required fields`);
      continue;
    }

    const pathFields = getTrackedFiles(system).concat(system.aidocDir);

    for (const relativePath of pathFields) {
      if (!existsSync(ensureRelativePath(rootDir, relativePath))) {
        missing.push(`missing path: ${relativePath}`);
      }
    }
  }

  return {
    ok: missing.length === 0,
    errors: missing
  };
}
