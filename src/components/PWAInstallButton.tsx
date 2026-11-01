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
        className={`bg-[#78350f] hover:bg-[#632909] text-white font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm shadow-[#78350f]/20 active:scale-95 cursor-pointer ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
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
          className={`bg-white hover:bg-[#fcfaf7] text-[#4a3b32] border border-[#e8dfd5] font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
            compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
          }`}
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#78350f]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#281d16]/60 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="bg-white border border-[#e8dfd5] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#e8dfd5] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#f5ede4] text-[#78350f] rounded-xl border border-[#e8dfd5]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#281d16]">Install on iPhone / iPad</h3>
                    <p className="text-[11px] text-[#7d695b]">Launch TradePulse like a native app</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#7d695b] hover:text-[#281d16] p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#4a3b32]">
                <div className="flex items-start gap-3 p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <div className="p-1.5 bg-[#f0e9df] rounded-lg text-[#78350f] mt-0.5">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#281d16] block">Step 1</span>
                    <span>Tap the <strong>Share</strong> button in your Safari bottom toolbar.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <div className="p-1.5 bg-[#edf7ed] rounded-lg text-[#1e6b37] mt-0.5">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#281d16] block">Step 2</span>
                    <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                  <div className="p-1.5 bg-[#f5ede4] rounded-lg text-[#92400e] mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#281d16] block">Step 3</span>
                    <span>Confirm by tapping <strong>Add</strong> at the top right.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 bg-[#78350f] hover:bg-[#632909] text-white font-semibold text-xs rounded-xl transition shadow-md shadow-[#78350f]/20 cursor-pointer"
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
      className={`bg-white hover:bg-[#fcfaf7] text-[#4a3b32] border border-[#e8dfd5] font-medium rounded-xl flex items-center gap-1.5 transition hidden sm:flex shadow-xs cursor-pointer ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
      title="Install as Progressive Web App"
    >
      <Download className="w-3.5 h-3.5 text-[#78350f]" />
      <span>Install App</span>
    </button>
  );
};
