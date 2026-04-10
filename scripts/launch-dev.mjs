import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { buildLaunchChecks, buildViteCommand, getLaunchTarget } from './launch-dev-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const mode = process.argv[2] === 'visual' ? 'visual' : 'main';
const target = getLaunchTarget(mode);

function hasResolvablePackage(specifier) {
  try {
    require.resolve(specifier, { paths: [rootDir] });
    return true;
  } catch {
    return false;
  }
}

function exitWithIssues(issues) {
  console.error('');
  console.error('[launcher] Startup checks failed:');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  console.error('');
  console.error('[launcher] Fix the issues above and try again.');
  process.exit(1);
}

const issues = buildLaunchChecks(mode, {
  hasPackageJson: fs.existsSync(path.join(rootDir, 'package.json')),
  hasNodeModules: fs.existsSync(path.join(rootDir, 'node_modules')),
  hasVite: hasResolvablePackage('vite/package.json'),
  hasScenarioSelectPage: fs.existsSync(path.join(rootDir, 'scenario-select.html')),
});

if (issues.length > 0) {
  exitWithIssues(issues);
}

const viteBin = path.join(rootDir, 'node_modules', '.bin', 'vite.cmd');
if (!fs.existsSync(viteBin)) {
  exitWithIssues(['Missing local Vite binary at node_modules/.bin/vite.cmd. Run "npm install" first.']);
}

console.log(`[launcher] Starting ${mode === 'visual' ? 'scenario selector' : 'Opus World'}...`);
if (mode === 'visual') {
  console.log(`[launcher] Opening ${target}`);
}

const command = buildViteCommand(mode, viteBin);
const child = spawn(command.file, command.args, {
  cwd: rootDir,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error('');
  console.error('[launcher] Failed to start Vite.');
  if (error.code === 'EPERM') {
    console.error('[launcher] The current environment blocked process spawning (EPERM).');
    console.error('[launcher] Try running this script from a normal local terminal instead of a restricted sandbox.');
  } else {
    console.error(`[launcher] ${error.message}`);
  }
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
