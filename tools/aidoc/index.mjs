import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const INDEX_PATH = path.join("docs", "ai", "index", "system-index.json");
const MANAGED_PREFIX = "[aidoc-sync]";
const MANAGED_SOURCE = "push-with-aidoc";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function ensureRelativePath(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

export function readSystemIndex(rootDir) {
  const filePath = ensureRelativePath(rootDir, INDEX_PATH);
  const json = readJson(filePath);

  if (!json || !Array.isArray(json.systems)) {
    throw new Error("aidoc index: system-index.json must contain a systems array");
  }

  return json;
}

export function analyzeChangedFiles(rootDir, changedFiles) {
  const systemIndex = readSystemIndex(rootDir);
  const normalized = changedFiles.map((file) => file.replace(/\\/g, "/"));
  const matchedSystems = [];
  const docPaths = [];

  for (const system of systemIndex.systems) {
    const trackedFiles = [
      system.standardDoc,
      system.systemReadme,
      ...system.sourceFiles,
      ...system.testFiles,
      ...system.sceneEntryFiles,
      ...system.integrationFiles,
      ...system.latestAidocs
    ];

    const isImpacted = normalized.some((file) => trackedFiles.includes(file));
    if (!isImpacted) continue;

    matchedSystems.push(system.key);
    docPaths.push(system.systemReadme, ...system.latestAidocs, ...system.integrationFiles);
  }

  const impactedSystems = uniqueSorted(matchedSystems);
  const docPathsToReview = uniqueSorted(docPaths);

  return {
    impactedSystems,
    docPathsToReview,
    requiresSystemAidocReview: impactedSystems.length > 0
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

    const pathFields = [
      system.standardDoc,
      system.aidocDir,
      system.systemReadme,
      ...system.sourceFiles,
      ...system.testFiles,
      ...system.sceneEntryFiles,
      ...system.integrationFiles,
      ...system.latestAidocs
    ];

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
