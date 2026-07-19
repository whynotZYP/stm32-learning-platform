import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = process.cwd();

function workflow(name: string) {
  return parse(readFileSync(join(ROOT, '.github', 'workflows', name), 'utf8')) as {
    permissions?: Record<string, string>;
    jobs: Record<string, {
      needs?: string;
      steps: Array<{ run?: string; uses?: string; with?: Record<string, string>; env?: Record<string, string> }>;
    }>;
  };
}

function commands(document: ReturnType<typeof workflow>) {
  return Object.values(document.jobs).flatMap((job) => job.steps)
    .map((step) => step.run).filter((command): command is string => Boolean(command));
}

describe('release workflow contracts', () => {
  it('runs the deterministic web, content, browser, and host-C gates in CI', () => {
    const ci = workflow('ci.yml');
    const all = commands(ci).join('\n');
    for (const expected of [
      'npm ci', 'npm run validate:content', 'npm test', 'npm run typecheck',
      'npm run build', 'playwright install --with-deps chromium', 'npm run test:e2e',
    ]) expect(all).toContain(expected);
    expect(all).toContain('scripts/firmware/device-test-firmware.test.ts');
  });

  it('deploys only the tested subpath build through GitHub Pages', () => {
    const pages = workflow('pages.yml');
    expect(pages.permissions).toMatchObject({ contents: 'read', pages: 'write', 'id-token': 'write' });
    expect(pages.jobs.deploy.needs).toBe('build');
    const build = pages.jobs.build.steps;
    expect(build.find((step) => step.run === 'npm run build')?.env?.BASE_PATH)
      .toContain('github.event.repository.name');
    expect(build.find((step) => step.uses?.startsWith('actions/upload-pages-artifact'))?.with?.path).toBe('dist');
    expect(pages.jobs.deploy.steps.some((step) => step.uses?.startsWith('actions/deploy-pages'))).toBe(true);
  });
});
