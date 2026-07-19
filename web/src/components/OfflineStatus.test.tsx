import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let reportState: ((state: import('../pwa/registerServiceWorker').PwaState) => void) | undefined;
vi.mock('../pwa/registerServiceWorker', () => ({
  registerPlatformServiceWorker: vi.fn((callback) => { reportState = callback; }),
}));

import { OfflineStatus } from './OfflineStatus';

describe('OfflineStatus', () => {
  beforeEach(() => {
    reportState = undefined;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => cleanup());

  it('distinguishes website offline state from a disconnected development board', () => {
    render(<OfflineStatus />);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));

    expect(screen.getByRole('status')).toHaveTextContent('网页已离线');
    expect(screen.getByRole('status')).toHaveTextContent('开发板串口需要单独重连');
  });

  it('waits for the learner to apply an available update', async () => {
    const apply = vi.fn(async () => {});
    render(<OfflineStatus />);
    reportState?.({ kind: 'update-ready', apply });

    const button = await screen.findByRole('button', { name: '更新网页' });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  });

  it('reports when the offline cache is ready without touching learner data', async () => {
    render(<OfflineStatus />);
    reportState?.({ kind: 'offline-ready' });
    expect(await screen.findByRole('status')).toHaveTextContent('离线学习已准备好');
  });
});
