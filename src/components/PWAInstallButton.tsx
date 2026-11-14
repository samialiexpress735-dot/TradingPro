import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, hide prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop install flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`bg-brand-solid hover:bg-brand-solid-hover text-white font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm shadow-brand-solid/20 active:scale-95 cursor-pointer ${
          compact ? 'h-9 px-3 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        title="Install TradePulse PWA on this device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`bg-surface hover:bg-surface-alt text-ink-soft border border-line font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
            compact ? 'h-9 px-3 text-xs' : 'px-3 py-2 text-xs'
          }`}
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-brand" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse/60 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="bg-surface border border-line rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sunken text-brand rounded-xl border border-line">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Install on iPhone / iPad</h3>
                    <p className="text-[11px] text-muted">Launch TradePulse like a native app</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-muted hover:text-ink p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-ink-soft">
                <div className="flex items-start gap-3 p-3 bg-surface-alt rounded-xl border border-line-soft">
                  <div className="p-1.5 bg-sunken-strong rounded-lg text-brand mt-0.5">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-ink block">Step 1</span>
                    <span>Tap the <strong>Share</strong> button in your Safari bottom toolbar.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-surface-alt rounded-xl border border-line-soft">
                  <div className="p-1.5 bg-profit-bg rounded-lg text-profit mt-0.5">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-ink block">Step 2</span>
                    <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-surface-alt rounded-xl border border-line-soft">
                  <div className="p-1.5 bg-sunken rounded-lg text-brand mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-ink block">Step 3</span>
                    <span>Confirm by tapping <strong>Add</strong> at the top right.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 bg-brand-solid hover:bg-brand-solid-hover text-white font-semibold text-xs rounded-xl transition shadow-md shadow-brand-solid/20 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for desktop browsers when prompt hasn't fired yet
  return (
    <button
      onClick={() => {
        alert('To install TradePulse: Click the install icon in your browser address bar (top right) or use Menu > Install.');
      }}
      className={`bg-surface hover:bg-surface-alt text-ink-soft border border-line font-medium rounded-xl flex items-center gap-1.5 transition hidden sm:flex shadow-xs cursor-pointer ${
        compact ? 'h-9 px-3 text-xs' : 'px-3 py-1.5 text-xs'
      }`}
      title="Install as Progressive Web App"
    >
      <Download className="w-3.5 h-3.5 text-brand" />
      <span>Install App</span>
    </button>
  );
};
