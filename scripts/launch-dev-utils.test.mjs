import { describe, expect, it } from 'vitest';
import { buildLaunchChecks, buildViteCommand, getLaunchTarget } from './launch-dev-utils.mjs';

describe('buildLaunchChecks', () => {
  it('reports missing dependencies for the main launcher', () => {
    const issues = buildLaunchChecks('main', {
      hasPackageJson: true,
      hasNodeModules: false,
      hasVite: false,
      hasScenarioSelectPage: true,
    });

    expect(issues).toEqual([
      'Missing node_modules. Run "npm install" first.',
      'Missing Vite dependency. Run "npm install" to restore dependencies.',
    ]);
  });

  it('reports the missing scenario page for the visual launcher', () => {
    const issues = buildLaunchChecks('visual', {
      hasPackageJson: true,
      hasNodeModules: true,
      hasVite: true,
      hasScenarioSelectPage: false,
    });

    expect(issues).toContain('Missing scenario-select.html required by visual-test.bat.');
  });
});

describe('getLaunchTarget', () => {
  it('returns the expected path for each launcher', () => {
    expect(getLaunchTarget('main')).toBe('/');
    expect(getLaunchTarget('visual')).toBe('/scenario-select.html');
  });
});

describe('buildViteCommand', () => {
  it('wraps vite.cmd in a cmd.exe invocation on Windows', () => {
    const command = buildViteCommand('visual', 'D:\\CC\\Twist-v1\\node_modules\\.bin\\vite.cmd');

    expect(command.file.toLowerCase()).toContain('cmd');
    expect(command.args.at(-1)).toContain('vite.cmd');
    expect(command.args.at(-1)).toContain('--open /scenario-select.html');
  });
});
