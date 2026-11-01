import React, { useState, useMemo } from 'react';
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

    const width = 800;
    const height = 280;
    const padding = { top: 20, right: 30, bottom: 30, left: 60 };

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
  }, [data, viewMode, curveMode, startingBalance]);

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];

  const netGain = data.length > 0 ? data[data.length - 1].equity - startingBalance : 0;
  const isPositive = netGain >= 0;

  return (
    <div className="bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs relative overflow-hidden">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1e6b37] animate-pulse"></span>
            <h3 className="text-xs font-bold text-[#634832] uppercase tracking-wider">Equity Curve</h3>
            {totalDisciplineDelta > 0 && (
              <span className="text-[10px] font-mono font-bold bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb] px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                +${totalDisciplineDelta.toLocaleString()} Discipline Alpha
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold font-mono text-[#281d16] tracking-tight">
              ${(activePoint?.raw.equity ?? startingBalance).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-sm font-mono font-semibold px-2 py-0.5 rounded-md ${
                isPositive
                  ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                  : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
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
          <div className="flex items-center gap-1 bg-[#faf7f2] p-1 rounded-xl border border-[#e2d8cb] text-xs font-medium">
            <button
              onClick={() => setCurveMode('actual')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                curveMode === 'actual'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
              title="Show actual execution equity curve"
            >
              Actual
            </button>
            <button
              onClick={() => setCurveMode('disciplined')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                curveMode === 'disciplined'
                  ? 'bg-[#1e6b37] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
              title="What-if equity if all mistake losses were eliminated"
            >
              <span>Disciplined</span>
            </button>
            <button
              onClick={() => setCurveMode('compare')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                curveMode === 'compare'
                  ? 'bg-[#b45309] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
              title="Overlay both actual and disciplined curves"
            >
              Compare
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-[#f5ede4] p-1 rounded-xl border border-[#debfa8] text-xs font-medium">
            <button
              onClick={() => setViewMode('equity')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'equity'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
              }`}
            >
              Equity
            </button>
            <button
              onClick={() => setViewMode('pnl')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'pnl'
                  ? 'bg-[#78350f] text-white shadow-xs font-semibold'
                  : 'text-[#7d695b] hover:text-[#281d16]'
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
            <span className="w-3 h-1 bg-[#1e6b37] rounded-full inline-block"></span>
            <span className="text-[#281d16] font-semibold">Disciplined Curve (No Mistakes)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#78350f] rounded-full inline-block"></span>
            <span className="text-[#7d695b]">Actual Curve</span>
          </div>
          <span className="text-[#8c7462] ml-auto">
            Discipline Gap: <strong className="text-[#1e6b37]">+${totalDisciplineDelta.toFixed(2)}</strong>
          </span>
        </div>
      )}

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox="0 0 800 280"
          className="w-full h-56 sm:h-64 overflow-visible touch-pan-y"
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
              <stop offset="0%" stopColor="#1e6b37" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#1e6b37" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#1e6b37" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="underwaterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b93829" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#b93829" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = 20 + ratio * (280 - 50);
            const val = maxVal - ratio * (maxVal - minVal);
            return (
              <g key={ratio}>
                <line x1="60" y1={y} x2="770" y2={y} stroke="#ede6dc" strokeDasharray="3 3" strokeWidth="1" />
                <text x="52" y={y + 4} fill="#8c7462" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">
                  ${Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Baseline starting equity line */}
          <line
            x1="60"
            y1={baselineY}
            x2="770"
            y2={baselineY}
            stroke="#b09886"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text x="775" y={baselineY + 3} fill="#8c7462" fontSize="9" textAnchor="start" fontFamily="JetBrains Mono">
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
              stroke="#1e6b37"
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
              stroke={curveMode === 'compare' ? '#78350f' : isPositive ? '#1e6b37' : '#b93829'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive invisible hover columns & points */}
          {points.map((pt, i) => (
            <g key={i}>
              <rect
                x={pt.x - 15}
                y={20}
                width={30}
                height={230}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
              {/* Highlight circle on hover or at last point */}
              {(hoverIndex === i || (hoverIndex === null && i === points.length - 1)) && (
                <>
                  <line
                    x1={pt.x}
                    y1={20}
                    x2={pt.x}
                    y2={250}
                    stroke="#78350f"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={pt.x} cy={pt.y} r="6" fill="#ffffff" stroke="#78350f" strokeWidth="2.5" />
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#78350f" />
                  {curveMode === 'compare' && (
                    <circle cx={pt.x} cy={pt.discY} r="4" fill="#ffffff" stroke="#1e6b37" strokeWidth="2" />
                  )}
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Floating tooltip */}
        {activePoint && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs border-t border-[#ede6dc] pt-2.5 mt-1 text-[#7d695b] font-mono gap-1.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>Date: <strong className="text-[#281d16]">{activePoint.raw.date}</strong></span>
              {activePoint.raw.symbol && (
                <span>Trade: <strong className="text-[#78350f]">{activePoint.raw.symbol}</strong></span>
              )}
              {activePoint.raw.pnl !== undefined && activePoint.raw.pnl !== 0 && (
                <span>
                  P&amp;L:{' '}
                  <strong className={activePoint.raw.pnl >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'}>
                    {activePoint.raw.pnl >= 0 ? '+' : ''}${activePoint.raw.pnl.toFixed(2)}
                  </strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activePoint.raw.disciplinedEquity && curveMode !== 'actual' && (
                <span>
                  Disciplined Equity: <strong className="text-[#1e6b37]">${activePoint.raw.disciplinedEquity.toLocaleString()}</strong>
                </span>
              )}
              <span>Peak: <strong className="text-[#281d16]">${peakEquity.toLocaleString()}</strong></span>
              {activePoint.raw.drawdown > 0 && (
                <span className="text-[#b93829]">
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
