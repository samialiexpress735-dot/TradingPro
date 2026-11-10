import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Small line under the value (gross P&L, W/L split, target hint...) */
  sub?: React.ReactNode;
  /** Icon shown top-right */
  icon?: React.ReactNode;
  /** Tailwind text color class for the value, e.g. "text-profit" */
  valueClassName?: string;
  title?: string;
}

/** One KPI tile. Replaces six hand-copied blocks in Dashboard. */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  icon,
  valueClassName = 'text-ink',
  title,
}) => (
  <div
    title={title}
    className="bg-surface border border-line rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between min-w-0"
  >
    <div className="flex items-center justify-between gap-2 text-muted text-[10px] sm:text-[11px] mb-1">
      <span className="truncate">{label}</span>
      {icon ? <span className="shrink-0 [&>svg]:w-3 [&>svg]:h-3 sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5">{icon}</span> : null}
    </div>
    <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight truncate ${valueClassName}`}>{value}</div>
    {sub ? <div className="text-[9px] sm:text-[10px] text-faint font-mono mt-1 truncate">{sub}</div> : null}
  </div>
);
