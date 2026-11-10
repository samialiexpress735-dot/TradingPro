import React, { useState, useMemo, useRef, useEffect } from 'react';
import { EquityPoint } from '../types/trade';
import { ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

interface EquityChartProps {
  data: EquityPoint[];
  startingBalance: number;
}

export const EquityChart: React.FC<EquityChartProps> = ({ data, startingBalance }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'equity' | 'pnl'>('equity');
  const [curveMode, setCurveMode] = useState<'actual' | 'disciplined' | 'compare'>('actual');

  // Render the SVG at its real pixel size (1 SVG unit = 1 CSS px) so it fills the card
  // at any width instead of being letterboxed, and text stays legible on phones.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 280 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = Math.max(260, Math.round(el.clientWidth));
      const h = w < 520 ? 230 : 290;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = size.w < 520
    ? { top: 16, right: 34, bottom: 26, left: 48 }
    : { top: 20, right: 40, bottom: 30, left: 60 };

  const finalPoint = data.length > 0 ? data[data.length - 1] : null;
  const totalDisciplineDelta = finalPoint ? finalPoint.disciplineDelta || 0 : 0;

  const {
    minVal,
    maxVal,
    pathD,
    areaD,
    disciplinedPathD,
    points,
    baselineY,
    peakEquity,
  } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        minVal: 0,
        maxVal: 1,
        pathD: '',
        areaD: '',
        disciplinedPathD: '',
        points: [],
        baselineY: 0,
        peakEquity: startingBalance,
      };
    }

    const actualVals = data.map((d) => (viewMode === 'equity' ? d.equity : d.equity - startingBalance));
    const discVals = data.map((d) =>
      viewMode === 'equity'
        ? d.disciplinedEquity ?? d.equity
        : (d.disciplinedEquity ?? d.equity) - startingBalance
    );

    const allValues = [...actualVals, ...(curveMode !== 'actual' ? discVals : [])];
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const peak = Math.max(...data.map((d) => d.equity));

    // Pad limits
    const range = Math.max(100, rawMax - rawMin);
    const min = rawMin - range * 0.08;
    const max = rawMax + range * 0.12;

    const width = size.w;
    const height = size.h;
    const padding = pad;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const scaleX = (i: number) => padding.left + (i / Math.max(1, data.length - 1)) * chartW;
    const scaleY = (v: number) => padding.top + chartH - ((v - min) / (max - min)) * chartH;

    const pts = data.map((d, i) => {
      const val = viewMode === 'equity' ? d.equity : d.equity - startingBalance;
      const discVal =
        viewMode === 'equity'
          ? d.disciplinedEquity ?? d.equity
          : (d.disciplinedEquity ?? d.equity) - startingBalance;

      return {
        x: scaleX(i),
        y: scaleY(val),
        discY: scaleY(discVal),
        raw: d,
        val,
        discVal,
      };
    });

    // Actual curve path
    let pD = '';
    pts.forEach((pt, i) => {
      if (i === 0) {
        pD += `M ${pt.x} ${pt.y}`;
      } else {
        const prev = pts[i - 1];
        const cp1x = prev.x + (pt.x - prev.x) / 2;
        const cp2x = prev.x + (pt.x - prev.x) / 2;
        pD += ` C ${cp1x} ${prev.y}, ${cp2x} ${pt.y}, ${pt.x} ${pt.y}`;
      }
    });

    // Disciplined curve path
    let dD = '';
    pts.forEach((pt, i) => {
      if (i === 0) {
        dD += `M ${pt.x} ${pt.discY}`;
      } else {
        const prev = pts[i - 1];
        const cp1x = prev.x + (pt.x - prev.x) / 2;
        const cp2x = prev.x + (pt.x - prev.x) / 2;
        dD += ` C ${cp1x} ${prev.discY}, ${cp2x} ${pt.discY}, ${pt.x} ${pt.discY}`;
      }
    });

    const baselineVal = viewMode === 'equity' ? startingBalance : 0;
    const baseY = Math.max(padding.top, Math.min(padding.top + chartH, scaleY(baselineVal)));
    const aD = `${pD} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;

    return {
      minVal: min,
      maxVal: max,
      pathD: pD,
      areaD: aD,
      disciplinedPathD: dD,
      points: pts,
      baselineY: baseY,
      peakEquity: peak,
    };
  }, [data, viewMode, curveMode, startingBalance, size.w, size.h]);

  const hitW = Math.max(8, Math.min(30, (size.w - pad.left - pad.right) / Math.max(1, points.length - 1)));
  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];

  const netGain = data.length > 0 ? data[data.length - 1].equity - startingBalance : 0;
  const isPositive = netGain >= 0;

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs relative overflow-hidden">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-profit-solid animate-pulse"></span>
            <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider">Equity Curve</h3>
            {totalDisciplineDelta > 0 && (
              <span className="text-[10px] font-mono font-bold bg-profit-bg text-profit border border-profit-line px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                +${totalDisciplineDelta.toLocaleString()} Discipline Alpha
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight">
              ${(activePoint?.raw.equity ?? startingBalance).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-sm font-mono font-semibold px-2 py-0.5 rounded-md ${
                isPositive
                  ? 'bg-profit-bg text-profit border border-profit-line'
                  : 'bg-loss-bg text-loss border border-loss-line'
              }`}
            >
              {isPositive ? '+' : ''}${netGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
              {((netGain / startingBalance) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* View mode & Curve filter toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Curve Filter: Actual vs Disciplined vs Compare */}
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-line text-xs font-medium">
            <button
              onClick={() => setCurveMode('actual')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                curveMode === 'actual'
                  ? 'bg-brand-solid text-white shadow-xs font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
              title="Show actual execution equity curve"
            >
              Actual
            </button>
            <button
              onClick={() => setCurveMode('disciplined')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                curveMode === 'disciplined'
                  ? 'bg-profit-solid text-white shadow-xs font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
              title="What-if equity if all mistake losses were eliminated"
            >
              <span>Disciplined</span>
            </button>
            <button
              onClick={() => setCurveMode('compare')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                curveMode === 'compare'
                  ? 'bg-accent text-white shadow-xs font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
              title="Overlay both actual and disciplined curves"
            >
              Compare
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-sunken p-1 rounded-xl border border-line-brand text-xs font-medium">
            <button
              onClick={() => setViewMode('equity')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'equity'
                  ? 'bg-brand-solid text-white shadow-xs font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Equity
            </button>
            <button
              onClick={() => setViewMode('pnl')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'pnl'
                  ? 'bg-brand-solid text-white shadow-xs font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              P&amp;L
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Legend if in compare mode */}
      {curveMode === 'compare' && (
        <div className="flex items-center gap-4 mb-2 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-profit-solid rounded-full inline-block"></span>
            <span className="text-ink font-semibold">Disciplined Curve (No Mistakes)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-brand-solid rounded-full inline-block"></span>
            <span className="text-muted">Actual Curve</span>
          </div>
          <span className="text-faint ml-auto">
            Discipline Gap: <strong className="text-profit">+${totalDisciplineDelta.toFixed(2)}</strong>
          </span>
        </div>
      )}

      {/* SVG Container */}
      <div ref={wrapRef} className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          width={size.w}
          height={size.h}
          role="img"
          aria-label="Equity curve chart"
          className="block max-w-full overflow-visible touch-pan-y"
          onMouseLeave={() => setHoverIndex(null)}
          onTouchMove={(e) => {
            if (!points || points.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.touches[0];
            if (!touch) return;
            const clientX = touch.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clientX / rect.width));
            const idx = Math.round(ratio * (points.length - 1));
            setHoverIndex(idx);
          }}
          onTouchEnd={() => {}}
        >
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--profit)" stopOpacity="0.25" />
              <stop offset="70%" stopColor="var(--profit)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--profit)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="underwaterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--loss)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = pad.top + ratio * (size.h - pad.top - pad.bottom);
            const val = maxVal - ratio * (maxVal - minVal);
            return (
              <g key={ratio}>
                <line x1={pad.left} y1={y} x2={size.w - pad.right} y2={y} stroke="var(--line-soft)" strokeDasharray="3 3" strokeWidth="1" />
                <text x={pad.left - 8} y={y + 4} fill="var(--faint)" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">
                  ${Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Baseline starting equity line */}
          <line
            x1={pad.left}
            y1={baselineY}
            x2={size.w - pad.right}
            y2={baselineY}
            stroke="var(--faint)"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text x={size.w - pad.right + 5} y={baselineY + 3} fill="var(--faint)" fontSize="9" textAnchor="start" fontFamily="JetBrains Mono">
            Base
          </text>

          {/* Area fill for actual */}
          {curveMode === 'actual' && areaD && (
            <path
              d={areaD}
              fill={isPositive ? 'url(#equityGrad)' : 'url(#underwaterGrad)'}
            />
          )}

          {/* Disciplined path if compare or disciplined */}
          {(curveMode === 'disciplined' || curveMode === 'compare') && disciplinedPathD && (
            <path
              d={disciplinedPathD}
              fill="none"
              stroke="var(--profit)"
              strokeWidth={curveMode === 'disciplined' ? '2.5' : '2'}
              strokeDasharray={curveMode === 'compare' ? '5 3' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Actual trend line */}
          {curveMode !== 'disciplined' && pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={curveMode === 'compare' ? 'var(--brand)' : isPositive ? 'var(--profit)' : 'var(--loss)'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive invisible hover columns & points */}
          {points.map((pt, i) => (
            <g key={i}>
              <rect
                x={pt.x - hitW / 2}
                y={pad.top}
                width={hitW}
                height={size.h - pad.top - pad.bottom}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
              {/* Highlight circle on hover or at last point */}
              {(hoverIndex === i || (hoverIndex === null && i === points.length - 1)) && (
                <>
                  <line
                    x1={pt.x}
                    y1={pad.top}
                    x2={pt.x}
                    y2={size.h - pad.bottom}
                    stroke="var(--brand)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={pt.x} cy={pt.y} r="6" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.5" />
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="var(--brand)" />
                  {curveMode === 'compare' && (
                    <circle cx={pt.x} cy={pt.discY} r="4" fill="var(--surface)" stroke="var(--profit)" strokeWidth="2" />
                  )}
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Floating tooltip */}
        {activePoint && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs border-t border-line-soft pt-2.5 mt-1 text-muted font-mono gap-1.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>Date: <strong className="text-ink">{activePoint.raw.date}</strong></span>
              {activePoint.raw.symbol && (
                <span>Trade: <strong className="text-brand">{activePoint.raw.symbol}</strong></span>
              )}
              {activePoint.raw.pnl !== undefined && activePoint.raw.pnl !== 0 && (
                <span>
                  P&amp;L:{' '}
                  <strong className={activePoint.raw.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                    {activePoint.raw.pnl >= 0 ? '+' : '-'}${Math.abs(activePoint.raw.pnl).toFixed(2)}
                  </strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activePoint.raw.disciplinedEquity && curveMode !== 'actual' && (
                <span>
                  Disciplined Equity: <strong className="text-profit">${activePoint.raw.disciplinedEquity.toLocaleString()}</strong>
                </span>
              )}
              <span>Peak: <strong className="text-ink">${peakEquity.toLocaleString()}</strong></span>
              {activePoint.raw.drawdown > 0 && (
                <span className="text-loss">
                  DD: -${activePoint.raw.drawdown.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
