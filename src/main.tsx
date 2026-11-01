import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline caching and auto-updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('TradePulse PWA: New update available, updating...');
  },
  onOfflineReady() {
    console.log('TradePulse PWA: Service worker active, ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
