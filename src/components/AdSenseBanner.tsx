import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, DollarSign, ExternalLink, HelpCircle } from 'lucide-react';

interface AdSenseBannerProps {
  publisherId?: string;
  slotId?: string;
  enabled?: boolean;
  testMode?: boolean;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
  onOpenSetup?: () => void;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  publisherId,
  slotId,
  enabled = false,
  testMode = false,
  format = 'auto',
  className = '',
  onOpenSetup,
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // Clean publisher ID (ensure ca-pub- prefix)
  const formattedClient = publisherId
    ? publisherId.startsWith('ca-')
      ? publisherId
      : `ca-${publisherId}`
    : '';

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

      // Initialize AdSense ad slot
      const pushAd = () => {
        try {
          if (typeof window !== 'undefined') {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            setAdLoaded(true);
          }
        } catch (e) {
          console.warn('AdSense slot initialization:', e);
          setAdError(true);
        }
      };

      // Slight timeout to let DOM render
      const timer = setTimeout(pushAd, 150);
      return () => clearTimeout(timer);
    } catch (err) {
      console.warn('AdSense execution error:', err);
      setAdError(true);
    }
  }, [enabled, testMode, formattedClient, slotId]);

  // If ads are completely disabled and not in test mode, don't show empty spaces
  if (!enabled && !testMode) {
    return null;
  }

  // Preview / Test Mode or Setup prompt
  if (testMode || !formattedClient) {
    return (
      <aside aria-label="Advertisement Banner" className={`w-full my-4 rounded-xl border border-dashed border-[#ddcfbf] bg-[#faf6f0]/70 p-4 text-center transition ${className}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f0e7db] text-[#92400e] flex items-center justify-center font-bold text-sm shrink-0 border border-[#ddcfbf]">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-[#8c7462] bg-[#ede5d8] px-1.5 py-0.5 rounded">
                  Advertisement Slot
                </span>
                <span className="text-[10px] font-semibold text-[#2e7d32] bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                  {testMode ? 'Preview Mode Active' : 'Setup Required'}
                </span>
              </div>
              <p className="text-xs text-[#634832] mt-0.5">
                {formattedClient
                  ? `Google AdSense configured (${formattedClient}) • Live ads will populate once Google finishes domain review.`
                  : 'Earn passive revenue from your trading journal with Google AdSense banner and auto ads.'}
              </p>
            </div>
          </div>

          {onOpenSetup && (
            <button
              onClick={onOpenSetup}
              className="shrink-0 px-3 py-1.5 bg-[#92400e] hover:bg-[#78350f] text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{formattedClient ? 'Manage AdSense' : 'Connect AdSense'}</span>
            </button>
          )}
        </div>
      </aside>
    );
  }

  // Live Production Ad Unit
  return (
    <div
      ref={adRef}
      className={`w-full my-4 overflow-hidden rounded-xl bg-white border border-[#ddcfbf] p-2 text-center transition ${className}`}
    >
      <div className="flex items-center justify-between px-2 pb-1.5 border-b border-[#f4eee6] mb-2 text-[10px] text-[#8c7462] font-mono uppercase tracking-wider">
        <span>Advertisement</span>
        {testMode && <span className="text-[#92400e] font-semibold">Test Mode</span>}
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
    </div>
  );
};
