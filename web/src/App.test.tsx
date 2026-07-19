import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('introduces the STM32 learning path in plain Chinese', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'STM32 绯荤粺瀛︿範骞冲彴' })).toBeInTheDocument();
    expect(screen.getByText('24 鍛紝浠庨浂鍩虹鍒拌兘鐙珛鎺掓煡闂')).toBeInTheDocument();
  });
});
