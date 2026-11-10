import React, { useRef, useState, useEffect } from 'react';
import { Trade } from '../types/trade';
import { formatPrice, formatQuantity } from '../utils/formatters';
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  Calendar,
  Clock,
  Layers,
  Award,
} from 'lucide-react';

interface SocialTradeCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: Trade | null;
}

export const SocialTradeCardModal: React.FC<SocialTradeCardModalProps> = ({
  isOpen,
  onClose,
  trade,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'espresso' | 'alabaster' | 'charcoal'>('espresso');

  // Redraw canvas whenever trade or theme changes
  useEffect(() => {
    if (!isOpen || !trade || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensions: 1200 x 675 (16:9 ratio, crisp high-res)
    canvas.width = 1200;
    canvas.height = 675;

    // Theme backgrounds & colors
    let bgGradient: CanvasGradient;
    let textColor = '#ffffff';
    let subTextColor = '#d5c3b1';
    let cardBg = 'rgba(255, 255, 255, 0.06)';
    let borderColor = 'rgba(213, 195, 177, 0.2)';
    let accentColor = '#b45309';

    if (theme === 'espresso') {
      bgGradient = ctx.createLinearGradient(0, 0, 1200, 675);
      bgGradient.addColorStop(0, '#22160f');
      bgGradient.addColorStop(0.5, '#352115');
      bgGradient.addColorStop(1, '#1b110b');
      textColor = '#faf7f2';
      subTextColor = '#c7b39f';
      accentColor = '#f59e0b';
    } else if (theme === 'alabaster') {
      bgGradient = ctx.createLinearGradient(0, 0, 1200, 675);
      bgGradient.addColorStop(0, '#fcfaf7');
      bgGradient.addColorStop(0.5, '#f5efe6');
      bgGradient.addColorStop(1, '#ebe0d1');
      textColor = '#281d16';
      subTextColor = '#786455';
      cardBg = 'rgba(255, 255, 255, 0.8)';
      borderColor = 'rgba(120, 53, 15, 0.15)';
      accentColor = '#78350f';
    } else {
      bgGradient = ctx.createLinearGradient(0, 0, 1200, 675);
      bgGradient.addColorStop(0, '#121214');
      bgGradient.addColorStop(0.5, '#1e1e24');
      bgGradient.addColorStop(1, '#0d0d0f');
      textColor = '#f8fafc';
      subTextColor = '#94a3b8';
      cardBg = 'rgba(255, 255, 255, 0.04)';
      borderColor = 'rgba(255, 255, 255, 0.1)';
      accentColor = '#38bdf8';
    }

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1200, 675);

    // Decorative subtle geometric glow
    const radial = ctx.createRadialGradient(900, 200, 50, 900, 200, 500);
    const pnlPositive = trade.netPnl >= 0;
    if (pnlPositive) {
      radial.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
      radial.addColorStop(1, 'transparent');
    } else {
      radial.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      radial.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 1200, 675);

    // Top brand bar
    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TradePulse', 80, 85);

    ctx.fillStyle = accentColor;
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('VERIFIED EXECUTION JOURNAL', 240, 80);

    // Main Card Frame
    const cardX = 80;
    const cardY = 120;
    const cardW = 1040;
    const cardH = 475;
    const cardRadius = 24;

    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Symbol & Asset badge
    ctx.fillStyle = textColor;
    ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(trade.symbol, 130, 200);

    // Direction pill
    const dirIsLong = trade.direction === 'long';
    const pillBg = dirIsLong ? 'rgba(30, 107, 55, 0.9)' : 'rgba(185, 56, 41, 0.9)';
    ctx.beginPath();
    ctx.roundRect(320, 155, 110, 42, 12);
    ctx.fillStyle = pillBg;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(dirIsLong ? 'LONG ↑' : 'SHORT ↓', 338, 182);

    // Asset class
    ctx.fillStyle = subTextColor;
    ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${trade.assetClass.toUpperCase()} • ${trade.marketSession || 'NY Session'}`, 130, 235);

    // Big Net PnL section
    const pnlColor = pnlPositive ? '#22c55e' : '#ef4444';
    ctx.fillStyle = pnlColor;
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const pnlPrefix = pnlPositive ? '+' : '';
    const pnlStr = `${pnlPrefix}$${trade.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    ctx.fillText(pnlStr, 130, 335);

    // ROI & R-Multiple
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const roiStr = `${pnlPrefix}${trade.roi.toFixed(2)}% ROI`;
    const rrStr = trade.realizedRR !== 0 ? `  •  ${trade.realizedRR >= 0 ? '+' : ''}${trade.realizedRR}R Realized` : '';
    ctx.fillText(`${roiStr}${rrStr}`, 130, 385);

    // Divider line
    ctx.beginPath();
    ctx.moveTo(130, 420);
    ctx.lineTo(1020, 420);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4 Key Stats columns
    const cols = [
      { label: 'ENTRY PRICE', val: formatPrice(trade.entryPrice) },
      { label: 'EXIT PRICE', val: formatPrice(trade.exitPrice) },
      { label: 'POSITION SIZE', val: `${formatQuantity(trade.quantity, trade.assetClass)} units` },
      { label: 'SETUP STRATEGY', val: trade.strategy || 'Momentum' },
    ];

    cols.forEach((col, i) => {
      const colX = 130 + i * 230;
      ctx.fillStyle = subTextColor;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(col.label, colX, 465);

      ctx.fillStyle = textColor;
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(col.val, colX, 500);
    });

    // Bottom execution discipline tag
    const disciplineText = trade.mistake && trade.mistake !== 'Followed Plan'
      ? `Mistake: ${trade.mistake}`
      : 'Discipline: Followed Trading Plan';
    const disciplineColor = trade.mistake && trade.mistake !== 'Followed Plan' ? '#f59e0b' : '#22c55e';

    ctx.fillStyle = disciplineColor;
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`✓ ${disciplineText} • Emotion: ${trade.emotion}`, 130, 555);

    // Date watermark
    ctx.fillStyle = subTextColor;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Date: ${trade.date} ${trade.time || ''} • Powered by TradePulse`, 740, 555);
  }, [isOpen, trade, theme]);

  if (!isOpen || !trade) return null;

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `TradePulse_${trade.symbol}_${trade.date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyToClipboard = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (err) {
      console.warn('Clipboard write failed, downloading instead:', err);
      handleDownloadImage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-alt">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sunken text-brand border border-line-brand flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                Social Trade Card
                <span className="text-[10px] bg-profit-bg text-profit px-2 py-0.5 rounded-full font-mono font-medium border border-profit-line">
                  1200x675 HD
                </span>
              </h2>
              <p className="text-xs text-muted">
                Export or copy a clean trading review card for Discord, Twitter/X, or personal study.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-faint hover:text-ink hover:bg-sunken-strong rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Theme selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-soft">Card Styling:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme('espresso')}
                className={`px-3 py-1 text-xs rounded-xl font-medium transition cursor-pointer ${
                  theme === 'espresso'
                    ? 'bg-inverse text-white shadow-xs'
                    : 'bg-canvas text-ink-soft hover:bg-sunken-strong'
                }`}
              >
                Espresso Luxury
              </button>
              <button
                type="button"
                onClick={() => setTheme('alabaster')}
                className={`px-3 py-1 text-xs rounded-xl font-medium transition cursor-pointer ${
                  theme === 'alabaster'
                    ? 'bg-brand-solid text-white shadow-xs'
                    : 'bg-canvas text-ink-soft hover:bg-sunken-strong'
                }`}
              >
                Alabaster Warm
              </button>
              <button
                type="button"
                onClick={() => setTheme('charcoal')}
                className={`px-3 py-1 text-xs rounded-xl font-medium transition cursor-pointer ${
                  theme === 'charcoal'
                    ? 'bg-inverse text-white shadow-xs'
                    : 'bg-canvas text-ink-soft hover:bg-sunken-strong'
                }`}
              >
                Charcoal Dark
              </button>
            </div>
          </div>

          {/* Canvas Card Display */}
          <div className="rounded-2xl overflow-hidden border border-line shadow-md bg-inverse flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-auto max-h-[380px] object-contain block" />
          </div>

          {/* Trade Details summary */}
          <div className="bg-surface-alt border border-line-soft rounded-xl p-3 text-xs text-ink-soft flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>{trade.symbol}</strong> ({trade.direction.toUpperCase()}) • Net P&amp;L:{' '}
              <strong className={trade.netPnl >= 0 ? 'text-profit' : 'text-loss'}>
                {trade.netPnl >= 0 ? '+' : '-'}${Math.abs(trade.netPnl).toFixed(2)}
              </strong>
            </span>
            <span className="text-faint font-mono">
              Executed: {trade.date} {trade.time || ''}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface-alt">
          <span className="text-xs text-muted">Ready to share or archive</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="px-4 py-2 bg-surface hover:bg-canvas text-ink-soft border border-line-brand text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Image'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadImage}
              className="px-5 py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
