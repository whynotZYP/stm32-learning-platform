import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import { ProgressProvider } from './ProgressContext';
import { routes } from './router';

afterEach(cleanup);

function createMemoryRepository(): ProgressRepository {
  const state = createDefaultState('2026-07-19T00:00:00.000Z');
  return {
    async load() { return state; },
    async save() { return undefined; },
    async snapshot() { return state; },
    async replace() { return undefined; },
  };
}

const expectedHeadings = [
  ['/', '今天从这里开始'],
  ['/map', '24 周学习地图'],
  ['/week/4', '第 4 周'],
  ['/report', '知识掌握报告'],
] as const;

const unavailablePaths = ['/lesson/w04-gpio-output', '/not-a-route'] as const;
const invalidWeekPaths = ['/week/4e0', '/week/0x4'] as const;

describe('learning routes', () => {
  it.each(expectedHeadings)('renders %s with its named heading', async (path, heading) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
      <ProgressProvider repository={createMemoryRepository()}>
        <RouterProvider router={router} />
      </ProgressProvider>,
    );

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it.each(unavailablePaths)('shows a controlled unavailable page for %s', async (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<ProgressProvider repository={createMemoryRepository()}><RouterProvider router={router} /></ProgressProvider>);
    expect(await screen.findByRole('heading', { name: '这个页面暂未开放' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
  });

  it.each(invalidWeekPaths)('rejects non-canonical week parameters at %s', async (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<ProgressProvider repository={createMemoryRepository()}><RouterProvider router={router} /></ProgressProvider>);
    expect(await screen.findByRole('heading', { name: '没有找到这一周' })).toBeInTheDocument();
  });
});
