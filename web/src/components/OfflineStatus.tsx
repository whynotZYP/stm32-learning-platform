import { useEffect, useRef, useState } from 'react';

import { registerPlatformServiceWorker, type PwaState } from '../pwa/registerServiceWorker';

export function OfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pwaState, setPwaState] = useState<PwaState>();
  const registered = useRef(false);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    if (!registered.current) {
      registered.current = true;
      registerPlatformServiceWorker(setPwaState);
    }
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  if (!online) {
    return <p className="offline-status" role="status">
      网页已离线：已缓存的课程、测验、笔记和模拟器仍可使用；开发板串口需要单独重连。
    </p>;
  }
  if (pwaState?.kind === 'update-ready') {
    return <p className="offline-status" role="status">
      网页有新版本。当前记录会保留，准备好后再
      <button type="button" onClick={() => { void pwaState.apply(); }}>更新网页</button>
    </p>;
  }
  if (pwaState?.kind === 'offline-ready') {
    return <p className="offline-status" role="status">离线学习已准备好。</p>;
  }
  if (pwaState?.kind === 'registration-error') {
    return <p className="offline-status offline-status--warning" role="status">
      离线缓存暂不可用，联网学习不受影响。
    </p>;
  }
  return null;
}
