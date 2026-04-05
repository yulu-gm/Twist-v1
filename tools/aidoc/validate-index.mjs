import { validateSystemIndex } from "./index.mjs";

const result = validateSystemIndex(process.cwd());

if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("aidoc index validation passed");

