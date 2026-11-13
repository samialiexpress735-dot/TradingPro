import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Edit2, Check, X, DollarSign, Percent } from 'lucide-react';
import { DailyLossLimitState, LossLimitType } from '../hooks/useDailyLossLimit';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CardProps {
  limit: DailyLossLimitState;
}

export const DailyLossLimitCard: React.FC<CardProps> = ({ limit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftType, setDraftType] = useState<LossLimitType>(limit.limitType);
  const [draftValue, setDraftValue] = useState<string>(limit.limitValue > 0 ? String(limit.limitValue) : '');

  const startEditing = () => {
    setDraftType(limit.limitType);
    setDraftValue(limit.limitValue > 0 ? String(limit.limitValue) : '');
    setIsEditing(true);
  };

  const save = () => {
    const parsed = parseFloat(draftValue);
    if (!isNaN(parsed) && parsed > 0 && !(draftType === 'percent' && parsed > 100)) {
      limit.setLimit(draftType, parsed);
    }
    setIsEditing(false);
  };

  const isBreached = limit.status === 'breached';
  const isWarning = limit.status === 'warning';
  const isCaution = limit.status === 'caution';

  const barColor = isBreached ? 'bg-loss-solid' : isWarning || isCaution ? 'bg-accent' : 'bg-profit-solid';
  const shell = isBreached
    ? 'bg-loss-bg border-loss-line'
    : isWarning
      ? 'bg-warn-bg-soft border-warn-line'
      : 'bg-surface border-line';

  return (
    <div className={`${shell} border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isBreached ? 'bg-loss-solid text-white' : 'bg-sunken text-brand'
            }`}
          >
            {isBreached ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink">Daily Loss Limit</h3>
            <p className="text-[11px] text-faint truncate">
              {limit.status === 'off'
                ? 'Set a max loss for the day to protect your account'
                : limit.limitType === 'percent'
                  ? `${limit.limitValue}% of start-of-day balance (${money(limit.limitAmount)})`
                  : `Fixed ${money(limit.limitAmount)} per day`}
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="px-2.5 py-1.5 bg-surface-alt hover:bg-sunken text-brand text-xs font-semibold rounded-lg border border-line-brand flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            {limit.status === 'off' ? 'Set limit' : 'Edit'}
          </button>
        )}
      </div>

      {isEditing && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line-brand overflow-hidden">
            <button
              type="button"
              onClick={() => setDraftType('dollar')}
              className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer ${
                draftType === 'dollar' ? 'bg-brand-solid text-white' : 'bg-surface text-ink-soft'
              }`}
              aria-label="Limit in dollars"
            >
              <DollarSign className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setDraftType('percent')}
              className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer ${
                draftType === 'percent' ? 'bg-brand-solid text-white' : 'bg-surface text-ink-soft'
              }`}
              aria-label="Limit as percent of balance"
            >
              <Percent className="w-3 h-3" />
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            placeholder={draftType === 'dollar' ? 'e.g. 100' : 'e.g. 2'}
            autoFocus
            className="w-28 text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-line-brand focus:border-brand outline-hidden text-ink font-mono"
          />
          <button
            type="button"
            onClick={save}
            className="p-1.5 bg-brand-solid hover:bg-brand-solid-hover text-white rounded-lg cursor-pointer"
            aria-label="Save daily loss limit"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-1.5 bg-surface hover:bg-sunken text-faint border border-line rounded-lg cursor-pointer"
            aria-label="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {limit.status !== 'off' && (
            <button
              type="button"
              onClick={() => {
                limit.clearLimit();
                setIsEditing(false);
              }}
              className="text-[11px] font-semibold text-loss hover:underline cursor-pointer ml-1"
            >
              Remove limit
            </button>
          )}
        </div>
      )}

      {limit.status !== 'off' && (
        <>
          <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
            <span className={limit.todayPnl < 0 ? 'text-loss font-bold' : 'text-profit font-bold'}>
              Today: {limit.todayPnl >= 0 ? '+' : '-'}
              {money(Math.abs(limit.todayPnl))}
            </span>
            <span className="text-faint">
              {isBreached ? 'Limit reached' : `${money(limit.remaining)} left`}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-sunken-strong overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, limit.usedPct)}%` }}
            />
          </div>

          {isBreached && (
            <p className="text-xs font-semibold text-loss leading-relaxed">
              You have hit your daily loss limit. Stop trading for today and review what happened in your journal.
            </p>
          )}
          {isWarning && (
            <p className="text-xs font-semibold text-brand leading-relaxed">
              You have used {Math.round(limit.usedPct)}% of today&apos;s limit. Consider reducing size or stopping.
            </p>
          )}
        </>
      )}
    </div>
  );
};

interface BannerProps {
  limit: DailyLossLimitState;
  dismissedDay: string | null;
  onDismiss: () => void;
}

/** Shown on every tab once the daily loss limit is hit. */
export const DailyLossLimitBanner: React.FC<BannerProps> = ({ limit, dismissedDay, onDismiss }) => {
  if (limit.status !== 'breached' || dismissedDay === limit.todayKey) return null;

  return (
    <div
      role="alert"
      className="bg-loss-bg border-2 border-loss-line rounded-xl p-3 sm:p-4 mb-4 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-loss-solid text-white flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-loss block">
            Daily loss limit reached
          </span>
          <p className="text-xs font-semibold text-ink">
            Down {money(limit.lossToday)} today (limit {money(limit.limitAmount)}). Step away and review.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-faint hover:text-ink transition cursor-pointer shrink-0"
        aria-label="Dismiss for today"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
