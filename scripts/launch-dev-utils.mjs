export function buildLaunchChecks(mode, env) {
  const issues = [];

  if (!env.hasPackageJson) {
    issues.push('Missing package.json in project root.');
  }

  if (!env.hasNodeModules) {
    issues.push('Missing node_modules. Run "npm install" first.');
  }

  if (!env.hasVite) {
    issues.push('Missing Vite dependency. Run "npm install" to restore dependencies.');
  }

  if (mode === 'visual' && !env.hasScenarioSelectPage) {
    issues.push('Missing scenario-select.html required by visual launchers.');
  }

  return issues;
}

export function getLaunchTarget(mode) {
  return mode === 'visual' ? '/scenario-select.html' : '/';
}

function resolveDevPort(defaultPort = 5173) {
  const rawPort = process.env.VITE_PORT;
  if (!rawPort) return defaultPort;

  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return defaultPort;
  }

  return parsed;
}

export function buildViteCommand(mode, viteBin) {
  const port = resolveDevPort();
  const target = getLaunchTarget(mode);
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const command = `${viteBin} --port ${port} --open${mode === 'visual' ? ` ${target}` : ''}`;

    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/c', command],
    };
  }

  return {
    file: viteBin,
    args: ['--port', String(port), '--open', ...(mode === 'visual' ? [target] : [])],
  };
}
