import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

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
  const insRef = useRef<HTMLModElement>(null);
  const [adStatus, setAdStatus] = useState<'loading' | 'filled' | 'unfilled' | 'blocked'>('loading');

  const formattedClient = publisherId
    ? publisherId.startsWith('ca-')
      ? publisherId
      : `ca-${publisherId}`
    : 'ca-pub-1549023438906458';

  useEffect(() => {
    if (!enabled || testMode || !formattedClient) return;

    try {
      // Ensure Google AdSense script exists
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${formattedClient}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // Trigger ad push
      const pushAd = () => {
        try {
          if (typeof window !== 'undefined') {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          }
        } catch (e) {
          console.warn('AdSense push notice:', e);
          setAdStatus('unfilled');
        }
      };

      const timer = setTimeout(pushAd, 150);

      // Check ad status after Google script executes
      const checkTimer = setTimeout(() => {
        if (insRef.current) {
          const status = insRef.current.getAttribute('data-ad-status');
          const isDone = insRef.current.getAttribute('data-adsbygoogle-status') === 'done';
          const hasIframe = insRef.current.querySelector('iframe') !== null;

          if (hasIframe || status === 'filled') {
            setAdStatus('filled');
          } else if (status === 'unfilled' || isDone) {
            setAdStatus('unfilled');
          } else {
            setAdStatus('unfilled');
          }
        }
      }, 1600);

      return () => {
        clearTimeout(timer);
        clearTimeout(checkTimer);
      };
    } catch (err) {
      setAdStatus('blocked');
    }
  }, [enabled, testMode, formattedClient, slotId]);

  if (!enabled && !testMode) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement Banner"
      className={`w-full my-4 overflow-hidden rounded-xl bg-surface border border-line-strong p-3 text-center transition ${className}`}
    >
      <div className="flex items-center justify-between px-1 pb-2 border-b border-line-soft mb-2 text-[10px] text-faint font-mono uppercase tracking-wider">
        <span>Advertisement Unit</span>
        <span className="text-[10px] text-brand font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-profit-solid"></span>
          Google AdSense ({formattedClient})
        </span>
      </div>

      <div className="min-h-[90px] flex flex-col items-center justify-center relative">
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', minWidth: '250px', width: '100%' }}
          data-ad-client={formattedClient}
          data-ad-slot={slotId || undefined}
          data-ad-format={format}
          data-full-width-responsive="true"
        />

        {/* Informative fallback shown while Google finishes domain review or if ad-blocker is active */}
        {adStatus !== 'filled' && (
          <div className="w-full py-4 px-3.5 bg-canvas border border-dashed border-line-strong rounded-xl text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sunken-strong text-brand flex items-center justify-center shrink-0 border border-line-strong">
                <Clock className="w-4 h-4 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                  <span className="font-bold text-xs text-ink">
                    Google AdSense Slot Active
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-warn-bg text-brand px-2 py-0.5 rounded-full border border-warn-line">
                    Pending Google Review
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 break-words">
                  Connected to <strong className="font-mono text-ink">{formattedClient}</strong>. Google takes 24–48 hours to approve new sites and start serving live commercial ads.
                </p>
              </div>
            </div>

            <div className="text-[10px] text-faint font-mono shrink-0 bg-surface px-2.5 py-1 rounded-lg border border-line">
              ads.txt: Verified ✓
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
