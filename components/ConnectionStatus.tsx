'use client';

import { useEffect, useState } from 'react';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    function handleOffline() { setOnline(false); setRestored(false); }
    function handleOnline() {
      setOnline(true);
      setRestored(true);
      window.setTimeout(() => setRestored(false), 3500);
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (online && !restored) return null;
  return (
    <div className={online ? 'connectionStatus connectionRestored' : 'connectionStatus'} role="status" aria-live="polite">
      {online ? 'Connection restored. You can continue.' : 'You’re offline. We’ll reconnect when your connection returns.'}
    </div>
  );
}
