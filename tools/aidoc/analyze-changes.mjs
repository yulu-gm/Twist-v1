import path from "node:path";
import { analyzeChangedFiles } from "./index.mjs";

const rootDir = process.cwd();
const changedFiles = process.argv.slice(2).map((file) =>
  path.relative(rootDir, path.resolve(rootDir, file)).replace(/\\/g, "/")
);

const result = analyzeChangedFiles(rootDir, changedFiles);
console.log(JSON.stringify(result, null, 2));

