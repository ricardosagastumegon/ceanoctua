import { useEffect, useState } from 'react';

/**
 * Fixed top banner that appears when the browser loses connectivity.
 * Vanishes automatically when the connection comes back.
 */
export function NetworkBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] bg-rust px-4 py-1.5 text-center text-xs font-semibold text-white shadow-md"
    >
      ⚠ Sin conexión. Los cambios se guardarán cuando vuelvas a estar en línea.
    </div>
  );
}
