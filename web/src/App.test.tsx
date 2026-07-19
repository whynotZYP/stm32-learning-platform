import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('opens the local learning dashboard and its main navigation', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '今天从这里开始' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '知识报告' })).toHaveAttribute('href', '#/report');
  });
});
