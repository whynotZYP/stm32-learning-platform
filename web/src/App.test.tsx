import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('introduces the STM32 learning path in plain Chinese', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'STM32 系统学习平台' })).toBeInTheDocument();
    expect(screen.getByText('24 周，从零基础到能独立排查问题')).toBeInTheDocument();
  });

  it('shows all 24 weeks from validated content', () => {
    render(<App />);
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByText('第 24 周 · 总考核、补漏与后续路线')).toBeInTheDocument();
  });
});
