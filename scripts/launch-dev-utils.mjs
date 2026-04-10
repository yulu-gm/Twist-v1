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
    issues.push('Missing scenario-select.html required by visual-test.bat.');
  }

  return issues;
}

export function getLaunchTarget(mode) {
  return mode === 'visual' ? '/scenario-select.html' : '/';
}

export function buildViteCommand(mode, viteBin) {
  const target = getLaunchTarget(mode);
  const command = `${viteBin} --open${mode === 'visual' ? ` ${target}` : ''}`;

  return {
    file: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/c', command],
  };
}
