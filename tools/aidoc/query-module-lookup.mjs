import { lookupChangedFiles, lookupModule, lookupRoutedSystem } from "./index.mjs";

function main(argv) {
  const rawArgs = argv.slice(2);
  const includeMetrics = rawArgs.includes("--with-metrics");
  const args = rawArgs.filter((value) => value !== "--with-metrics");
  const [command = "module", ...rest] = args;
  const rootDir = process.cwd();
  const tracker = includeMetrics
    ? {
        filesOpened: 0,
        bytesRead: 0
      }
    : undefined;

  let payload;
  if (command === "module") {
    const query = rest.join(" ").trim();
    payload = {
      queryType: "module",
      query,
      result: lookupModule(rootDir, query, { tracker })
    };
  } else if (command === "changed") {
    payload = {
      queryType: "changed",
      changedFiles: rest,
      result: lookupChangedFiles(rootDir, rest, { tracker })
    };
  } else if (command === "routed") {
    const routedSystem = rest.join(" ").trim();
    payload = {
      queryType: "routed",
      query: routedSystem,
      result: lookupRoutedSystem(rootDir, routedSystem, { tracker })
    };
  } else {
    throw new Error(`aidoc lookup: unknown command "${command}"`);
  }

  if (tracker) {
    payload.metrics = tracker;
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main(process.argv);
