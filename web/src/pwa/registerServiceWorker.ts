import { registerSW } from 'virtual:pwa-register';

export type PwaState =
  | { kind: 'offline-ready' }
  | { kind: 'update-ready'; apply: () => Promise<void> }
  | { kind: 'registration-error'; message: string };

export function registerPlatformServiceWorker(
  onState: (state: PwaState) => void,
): void {
  const update = registerSW({
    immediate: true,
    onOfflineReady: () => onState({ kind: 'offline-ready' }),
    onNeedRefresh: () => onState({
      kind: 'update-ready',
      apply: () => update(true),
    }),
    onRegisterError: (error) => onState({
      kind: 'registration-error',
      message: String(error),
    }),
  });
}
