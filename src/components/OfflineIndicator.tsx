import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-surface border border-profit-line px-3.5 py-2 text-xs font-medium text-profit shadow-xl animate-fade-in">
        <Wifi className="w-3.5 h-3.5 text-profit" />
        <span>Connected — Syncing journal data...</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-surface border border-line px-3.5 py-2 text-xs font-medium text-brand shadow-xl animate-fade-in">
      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
      <WifiOff className="w-3.5 h-3.5 text-brand" />
      <span>Offline Mode — Cached local data in use</span>
    </div>
  );
};
