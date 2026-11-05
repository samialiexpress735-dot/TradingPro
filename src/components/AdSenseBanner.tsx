import React, { useEffect, useRef, useState } from 'react';
import { DollarSign } from 'lucide-react';

interface AdSenseBannerProps {
  publisherId?: string;
  slotId?: string;
  enabled?: boolean;
  testMode?: boolean;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  publisherId = 'pub-1549023438906458',
  slotId,
  enabled = true,
  testMode = false,
  format = 'auto',
  className = '',
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  // Clean publisher ID (ensure ca-pub- prefix)
  const formattedClient = publisherId
    ? publisherId.startsWith('ca-')
      ? publisherId
      : `ca-${publisherId}`
    : 'ca-pub-1549023438906458';

  useEffect(() => {
    if (!enabled || testMode || !formattedClient) return;

    try {
      // Check if adsbygoogle script is loaded in document.head
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${formattedClient}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // Initialize AdSense ad slot safely
      const pushAd = () => {
        try {
          if (typeof window !== 'undefined') {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            setAdLoaded(true);
          }
        } catch (e) {
          // Expected during initial review or ad-blocker presence
        }
      };

      const timer = setTimeout(pushAd, 200);
      return () => clearTimeout(timer);
    } catch (err) {
      console.warn('AdSense slot init:', err);
    }
  }, [enabled, testMode, formattedClient, slotId]);

  if (!enabled && !testMode) {
    return null;
  }

  // Live Production Ad Unit
  return (
    <aside
      aria-label="Advertisement Banner"
      className={`w-full my-4 overflow-hidden rounded-xl bg-white border border-[#ddcfbf] p-2 text-center transition ${className}`}
    >
      <div className="flex items-center justify-between px-2 pb-1.5 border-b border-[#f4eee6] mb-2 text-[10px] text-[#8c7462] font-mono uppercase tracking-wider">
        <span>Advertisement</span>
        <span className="text-[10px] text-[#92400e] font-semibold">TradePulse Partner</span>
      </div>

      <div className="min-h-[90px] flex items-center justify-center">
        {slotId ? (
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={formattedClient}
            data-ad-slot={slotId}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        ) : (
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={formattedClient}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        )}
      </div>
    </aside>
  );
};
