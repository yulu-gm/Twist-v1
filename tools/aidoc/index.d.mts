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
  lookupAliases?: string[];
  sharedEntryFiles?: string[];
  routedSystems?: string[];
};

export type SystemIndex = {
  systems: SystemIndexEntry[];
};

export type LookupIoTracker = {
  filesOpened: number;
  bytesRead: number;
};

export type LookupOptions = {
  tracker?: LookupIoTracker;
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

export type RoutedSystemLookup = {
  routedSystem: string;
  ohGenDoc: string;
  ohCodeDesign: string;
  ohAcceptance: string;
  codeDirectories: string[];
};

export type RoutedDocumentLookup = {
  routedSystem: string;
  ohGenDoc: string;
  ohCodeDesign: string;
  ohAcceptance: string;
};

export type ModuleLookupResult = {
  query: string;
  matchedBy: "alias" | "key" | "path";
  matchedFields: string[];
  system: SystemIndexEntry;
  implementationEntryFiles: string[];
  keyTestFiles: string[];
  sceneEntryFiles: string[];
  routedSystems: string[];
  routedDocuments: RoutedDocumentLookup[];
  sharedEntryFiles: string[];
  integrationFiles: string[];
  latestAidocs: string[];
  lookupAliases: string[];
};

export type ChangedFileLookupMatch = ModuleLookupResult & {
  systemKey: string;
  matchedFiles: string[];
};

export type ChangedFileLookupResult = ChangeAnalysisResult & {
  matches: ChangedFileLookupMatch[];
};

export function readSystemIndex(rootDir: string, options?: LookupOptions): SystemIndex;
export function lookupModule(
  rootDir: string,
  query: string,
  options?: LookupOptions
): ModuleLookupResult;
export function analyzeChangedFiles(
  rootDir: string,
  changedFiles: string[],
  options?: LookupOptions
): ChangeAnalysisResult;
export function lookupChangedFiles(
  rootDir: string,
  changedFiles: string[],
  options?: LookupOptions
): ChangedFileLookupResult;
export function lookupRoutedSystem(
  rootDir: string,
  routedSystem: string,
  options?: LookupOptions
): RoutedSystemLookup;
export function buildManagedCommitMessage(payload: ManagedCommitPayload): string;
export function parseManagedCommitMessage(message: string): ParsedManagedCommit;
export function validateSystemIndex(rootDir: string): {
  ok: boolean;
  errors: string[];
};
