export type SystemIndexEntry = {
  key: string;
  summary: string;
  standardDoc: string;
  aidocDir: string;
  systemReadme: string;
  sourceFiles: string[];
  testFiles: string[];
  sceneEntryFiles: string[];
  integrationFiles: string[];
  latestAidocs: string[];
};

export type SystemIndex = {
  systems: SystemIndexEntry[];
};

export type ChangeAnalysisResult = {
  impactedSystems: string[];
  docPathsToReview: string[];
  requiresSystemAidocReview: boolean;
};

export type ManagedCommitPayload = {
  summary: string;
  systems: string[];
  updatedDocs: string[];
};

export type ParsedManagedCommit = {
  managed: boolean;
  summary: string;
  systems: string[];
  updatedDocs: string[];
  source: string;
};

export function readSystemIndex(rootDir: string): SystemIndex;
export function analyzeChangedFiles(
  rootDir: string,
  changedFiles: string[]
): ChangeAnalysisResult;
export function buildManagedCommitMessage(payload: ManagedCommitPayload): string;
export function parseManagedCommitMessage(message: string): ParsedManagedCommit;
export function validateSystemIndex(rootDir: string): {
  ok: boolean;
  errors: string[];
};

