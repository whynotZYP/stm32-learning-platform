import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));
vi.mock('virtual:pwa-register', () => ({ registerSW }));

import { registerPlatformServiceWorker, type PwaState } from './registerServiceWorker';

describe('registerPlatformServiceWorker', () => {
  beforeEach(() => registerSW.mockReset());

  it('reports offline readiness, a user-controlled update, and registration errors', async () => {
    const update = vi.fn(async () => {});
    let callbacks: {
      onOfflineReady: () => void;
      onNeedRefresh: () => void;
      onRegisterError: (error: unknown) => void;
    } | undefined;
    registerSW.mockImplementation((options) => {
      callbacks = options;
      return update;
    });
    const states: PwaState[] = [];

    registerPlatformServiceWorker((state) => states.push(state));
    callbacks?.onOfflineReady();
    callbacks?.onNeedRefresh();
    callbacks?.onRegisterError(new Error('registration denied'));

    expect(states[0]).toEqual({ kind: 'offline-ready' });
    expect(states[1]?.kind).toBe('update-ready');
    expect(update).not.toHaveBeenCalled();
    if (states[1]?.kind === 'update-ready') await states[1].apply();
    expect(update).toHaveBeenCalledWith(true);
    expect(states[2]).toEqual({ kind: 'registration-error', message: 'Error: registration denied' });
    expect(registerSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }));
  });
});
