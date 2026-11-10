import React, { useState, useEffect, useMemo } from 'react';
import { Trade, DailyReview } from '../types/trade';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Award,
  Sparkles,
  Save,
  BookOpen,
  Activity,
  Smile,
  ShieldAlert,
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  History,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchUserDailyReviews, upsertUserDailyReview } from '../lib/supabase';

interface DailyReviewViewProps {
  trades: Trade[];
  userId?: string;
  onNavigateToJournal?: (date: string) => void;
}

const SAMPLE_REVIEWS: DailyReview[] = [
  {
    id: 'rev-2026-10-24',
    date: '2026-10-24',
    grade: 'A',
    marketConditions: 'Trending Bullish',
    sleepQuality: 8,
    focusLevel: 9,
    rulesFollowedPct: 95,
    checklistCompleted: true,
    morningNotes: 'Tech momentum continuation. Watched NVDA 138 key breakout level with strict stop.',
    eveningNotes: 'Followed sizing limits, took partial profits at 2R. Zero FOMO trades.',
    keyTakeaway: 'Patience at the open pays dividends. Waiting for the 15-minute candle close prevented false breakout entries.',
    updatedAt: '2026-10-24T17:00:00Z',
  },
  {
    id: 'rev-2026-10-25',
    date: '2026-10-25',
    grade: 'B',
    marketConditions: 'Choppy / Range-Bound',
    sleepQuality: 6,
    focusLevel: 7,
    rulesFollowedPct: 80,
    checklistCompleted: true,
    morningNotes: 'Choppy overnight action. Kept size half standard.',
    eveningNotes: 'Took one premature entry on AAPL when volume died down around lunch time.',
    keyTakeaway: 'Do not trade the 11:30 - 13:30 NY lunch lull. Market dries up and whipsaws.',
    updatedAt: '2026-10-25T16:30:00Z',
  },
];

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({ trades, userId, onNavigateToJournal }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Load reviews from in-memory state and sync with Supabase
  const [reviews, setReviews] = useState<DailyReview[]>(SAMPLE_REVIEWS);

  // Load reviews from Supabase when userId is available
  useEffect(() => {
    if (!userId) return;
    let isCancelled = false;

    fetchUserDailyReviews(userId)
      .then((cloudReviews) => {
        if (!isCancelled && cloudReviews && cloudReviews.length > 0) {
          setReviews(cloudReviews);
        }
      })
      .catch((err) => {
        console.error('Failed to load reviews from Supabase:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  // Active review form state
  const currentReview = useMemo(() => {
    return reviews.find((r) => r.date === selectedDate);
  }, [reviews, selectedDate]);

  const [grade, setGrade] = useState<'A+' | 'A' | 'B' | 'C' | 'D' | 'F'>('A');
  const [marketConditions, setMarketConditions] = useState<DailyReview['marketConditions']>('Trending Bullish');
  const [sleepQuality, setSleepQuality] = useState<number>(8);
  const [focusLevel, setFocusLevel] = useState<number>(8);
  const [rulesFollowedPct, setRulesFollowedPct] = useState<number>(90);
  const [checklistCompleted, setChecklistCompleted] = useState<boolean>(true);
  const [morningNotes, setMorningNotes] = useState<string>('');
  const [eveningNotes, setEveningNotes] = useState<string>('');
  const [keyTakeaway, setKeyTakeaway] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Pre-flight checklist items state for the day
  const [prepNewsChecked, setPrepNewsChecked] = useState(true);
  const [prepLevelsIdentified, setPrepLevelsIdentified] = useState(true);
  const [prepMaxLossCommitted, setPrepMaxLossCommitted] = useState(true);
  const [prepAplusSetupOnly, setPrepAplusSetupOnly] = useState(true);

  // Sync state when selectedDate changes or currentReview changes
  useEffect(() => {
    if (currentReview) {
      setGrade(currentReview.grade);
      setMarketConditions(currentReview.marketConditions);
      setSleepQuality(currentReview.sleepQuality);
      setFocusLevel(currentReview.focusLevel);
      setRulesFollowedPct(currentReview.rulesFollowedPct);
      setChecklistCompleted(currentReview.checklistCompleted);
      setMorningNotes(currentReview.morningNotes);
      setEveningNotes(currentReview.eveningNotes);
      setKeyTakeaway(currentReview.keyTakeaway);
    } else {
      // Defaults for a new review
      setGrade('A');
      setMarketConditions('Trending Bullish');
      setSleepQuality(8);
      setFocusLevel(8);
      setRulesFollowedPct(90);
      setChecklistCompleted(true);
      setMorningNotes('');
      setEveningNotes('');
      setKeyTakeaway('');
    }
  }, [selectedDate, currentReview]);

  // Trades on selectedDate
  const daysTrades = useMemo(() => {
    return trades.filter((t) => (t.exitDate || t.date) === selectedDate && t.status === 'closed');
  }, [trades, selectedDate]);

  const daysPnL = useMemo(() => {
    return daysTrades.reduce((acc, t) => acc + t.netPnl, 0);
  }, [daysTrades]);

  const daysWins = useMemo(() => {
    return daysTrades.filter((t) => t.outcome === 'win').length;
  }, [daysTrades]);

  // Handle Save Review (syncs to Supabase if logged in)
  const handleSaveReview = async () => {
    const updatedReview: DailyReview = {
      id: currentReview?.id || `rev-${selectedDate}`,
      date: selectedDate,
      grade,
      marketConditions,
      sleepQuality,
      focusLevel,
      rulesFollowedPct,
      checklistCompleted,
      morningNotes,
      eveningNotes,
      keyTakeaway,
      updatedAt: new Date().toISOString(),
    };

    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.date === selectedDate);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedReview;
        return copy;
      }
      return [updatedReview, ...prev];
    });

    if (userId) {
      try {
        await upsertUserDailyReview(userId, updatedReview);
      } catch (err) {
        console.error('Failed to sync daily review to Supabase:', err);
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (grade === 'A+' || grade === 'A') {
      try {
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#78350f', '#1e6b37', '#92400e'],
        });
      } catch {
        // fallback
      }
    }
  };

  // Date step helper
  const handleStepDay = (deltaDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + deltaDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
    'A+': { bg: 'bg-profit-bg', text: 'text-profit', border: 'border-profit-line' },
    A: { bg: 'bg-profit-bg', text: 'text-profit', border: 'border-profit-line' },
    B: { bg: 'bg-[#eff6ff] dark:bg-[#12203a]', text: 'text-[#2563eb] dark:text-[#8db4ff]', border: 'border-[#bfdbfe] dark:border-[#25447a]' },
    C: { bg: 'bg-warn-bg-soft', text: 'text-accent', border: 'border-warn-line' },
    D: { bg: 'bg-warn-bg-soft', text: 'text-accent', border: 'border-warn-line' },
    F: { bg: 'bg-loss-bg', text: 'text-loss', border: 'border-loss-line' },
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="bg-surface border border-line rounded-3xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sunken text-brand border border-line-brand flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-bold text-ink tracking-tight">Daily Prep &amp; EOD Review</h2>
              <p className="text-[11px] sm:text-xs text-muted mt-0.5">
                Structure your morning preparation, track mental clarity, and grade daily discipline.
              </p>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 bg-surface-alt border border-line p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => handleStepDay(-1)}
              className="p-1.5 hover:bg-sunken-strong rounded-xl text-brand transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-surface border border-line-brand rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-ink focus:outline-none focus:border-brand flex-1 sm:flex-initial text-center"
            />
            <button
              onClick={() => handleStepDay(1)}
              className="p-1.5 hover:bg-sunken-strong rounded-xl text-brand transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1 text-xs font-semibold text-brand hover:bg-sunken-strong rounded-xl transition cursor-pointer shrink-0"
            >
              Today
            </button>
          </div>
        </div>

        {/* Day's Trading Link Bar */}
        <div className="mt-3.5 pt-3.5 border-t border-line-soft flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-faint font-medium">Session:</span>
            <span className="font-bold text-ink font-mono">{daysTrades.length} closed</span>
            <span className="text-[#d5c3b1]">•</span>
            <span>
              Net:{' '}
              <strong className={daysPnL >= 0 ? 'text-profit' : 'text-loss'}>
                {daysPnL >= 0 ? '+' : '-'}${Math.abs(daysPnL).toFixed(2)}
              </strong>
            </span>
            <span className="text-[#d5c3b1]">•</span>
            <span>
              WR:{' '}
              <strong className="text-brand">
                {daysTrades.length > 0 ? ((daysWins / daysTrades.length) * 100).toFixed(0) : 0}%
              </strong>
            </span>
          </div>

          {currentReview && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-faint text-[11px]">Logged Grade:</span>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono border ${
                  gradeColors[currentReview.grade]?.bg
                } ${gradeColors[currentReview.grade]?.text} ${gradeColors[currentReview.grade]?.border}`}
              >
                Grade: {currentReview.grade}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Review Grid: Morning Prep (Left) vs Evening Debrief (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Morning Prep Column */}
        <div className="bg-surface border border-line rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-warn-bg-soft text-accent rounded-xl border border-warn-line">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Morning Pre-Market Preparation</h3>
                <p className="text-[11px] text-faint">Mental baseline and execution prerequisites</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-faint uppercase tracking-wider bg-canvas px-2 py-1 rounded-md border border-line-soft">
              Phase 1
            </span>
          </div>

          {/* Biological & Mental State Sliders */}
          <div className="grid grid-cols-2 gap-4 bg-surface-alt border border-line-soft p-4 rounded-2xl">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-soft font-medium">Sleep Quality</span>
                <span className="font-bold text-brand font-mono">{sleepQuality} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={sleepQuality}
                onChange={(e) => setSleepQuality(Number(e.target.value))}
                className="w-full accent-brand-solid cursor-pointer"
              />
              <span className="text-[10px] text-faint block mt-0.5">
                {sleepQuality >= 8 ? 'Restful, clear mind' : sleepQuality >= 5 ? 'Moderate fatigue' : 'Sleep deprived'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-soft font-medium">Mental Focus</span>
                <span className="font-bold text-brand font-mono">{focusLevel} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={focusLevel}
                onChange={(e) => setFocusLevel(Number(e.target.value))}
                className="w-full accent-brand-solid cursor-pointer"
              />
              <span className="text-[10px] text-faint block mt-0.5">
                {focusLevel >= 8 ? 'High vigilance & calm' : focusLevel >= 5 ? 'Prone to distraction' : 'Agitated / emotional'}
              </span>
            </div>
          </div>

          {/* Pre-flight Checklist */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-ink block">Pre-Market Discipline Checklist:</span>
            <div className="space-y-2 bg-surface-alt border border-line-soft p-3.5 rounded-2xl">
              <label className="flex items-center gap-2.5 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepNewsChecked}
                  onChange={(e) => setPrepNewsChecked(e.target.checked)}
                  className="rounded accent-brand-solid"
                />
                <span>Economic calendar inspected (CPI, FOMC, NFP, Fed speeches)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepLevelsIdentified}
                  onChange={(e) => setPrepLevelsIdentified(e.target.checked)}
                  className="rounded accent-brand-solid"
                />
                <span>Major index levels marked (SPY, QQQ, VIX pivot points)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepMaxLossCommitted}
                  onChange={(e) => setPrepMaxLossCommitted(e.target.checked)}
                  className="rounded accent-brand-solid"
                />
                <span>Committed to Daily Max Loss cutoff threshold</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepAplusSetupOnly}
                  onChange={(e) => setPrepAplusSetupOnly(e.target.checked)}
                  className="rounded accent-brand-solid"
                />
                <span>Agreed to wait for primary playbook setups only</span>
              </label>
            </div>
          </div>

          {/* Morning Thesis */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Morning Market Thesis &amp; Focus List:
            </label>
            <textarea
              rows={3}
              value={morningNotes}
              onChange={(e) => setMorningNotes(e.target.value)}
              placeholder="e.g. Watching tech strength, NVDA 138 level, staying patient until initial 15-min candle settles..."
              className="w-full bg-surface-alt border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-brand resize-none"
            />
          </div>
        </div>

        {/* Evening Debrief Column */}
        <div className="bg-surface border border-line rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#eff6ff] dark:bg-[#12203a] text-[#2563eb] dark:text-[#8db4ff] rounded-xl border border-[#bfdbfe] dark:border-[#25447a]">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">End-of-Day (EOD) Debrief</h3>
                <p className="text-[11px] text-faint">Execution grading and continuous improvement</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-faint uppercase tracking-wider bg-canvas px-2 py-1 rounded-md border border-line-soft">
              Phase 2
            </span>
          </div>

          {/* Process Execution Letter Grade */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-ink">Daily Process Grade:</label>
              <span className="text-[10px] text-faint">Grade your plan adherence, not your P&amp;L!</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {(['A+', 'A', 'B', 'C', 'D', 'F'] as const).map((g) => {
                const isSelected = grade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`py-2 text-center rounded-xl font-bold font-mono text-sm transition cursor-pointer border ${
                      isSelected
                        ? `${gradeColors[g].bg} ${gradeColors[g].text} ${gradeColors[g].border} ring-2 ring-brand/20`
                        : 'bg-surface-alt text-muted border-line hover:bg-sunken-strong'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market Conditions */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1.5">Day's Market Environment:</label>
            <select
              value={marketConditions}
              onChange={(e) => setMarketConditions(e.target.value as DailyReview['marketConditions'])}
              className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand"
            >
              <option value="Trending Bullish">Trending Bullish (Clean directional upside)</option>
              <option value="Trending Bearish">Trending Bearish (Persistent selling pressure)</option>
              <option value="Choppy / Range-Bound">Choppy / Range-Bound (Whipsaws, false breaks)</option>
              <option value="High Volatility / News">High Volatility / News (Event-driven expansions)</option>
              <option value="Low Volume / Quiet">Low Volume / Quiet (Tight drift, low liquidity)</option>
            </select>
          </div>

          {/* Rules Adherence Slider */}
          <div className="bg-surface-alt border border-line-soft p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-ink-soft font-medium">Rules Followed Rate</span>
              <span className="font-bold text-profit font-mono">{rulesFollowedPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={rulesFollowedPct}
              onChange={(e) => setRulesFollowedPct(Number(e.target.value))}
              className="w-full accent-profit-solid cursor-pointer"
            />
          </div>

          {/* Key Takeaway & Lessons */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                Evening Reflection (What went well / Mistakes made):
              </label>
              <textarea
                rows={2}
                value={eveningNotes}
                onChange={(e) => setEveningNotes(e.target.value)}
                placeholder="Observed execution leaks, sizing mistakes, or positive milestones..."
                className="w-full bg-surface-alt border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:border-brand resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                One Golden Rule / Adjustment for Tomorrow:
              </label>
              <input
                type="text"
                value={keyTakeaway}
                onChange={(e) => setKeyTakeaway(e.target.value)}
                placeholder="e.g. Walk away after 2 consecutive losses. No revenge trading."
                className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs text-profit font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Review successfully saved!
              </span>
            ) : (
              <span className="text-[11px] text-faint">Last updated: {currentReview?.updatedAt ? new Date(currentReview.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not saved yet'}</span>
            )}

            <button
              type="button"
              onClick={handleSaveReview}
              className="px-5 py-2.5 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Day Review</span>
            </button>
          </div>
        </div>
      </div>

      {/* Review Archive / History Log */}
      <div className="bg-surface border border-line rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand" />
            <h3 className="text-base font-bold text-ink">Past Daily Review Archive</h3>
          </div>
          <span className="text-xs text-faint font-mono">{reviews.length} days logged</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((rev) => {
            const isCurrent = rev.date === selectedDate;
            const style = gradeColors[rev.grade] || gradeColors['B'];

            return (
              <div
                key={rev.id}
                onClick={() => setSelectedDate(rev.date)}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isCurrent
                    ? 'bg-surface-alt border-brand shadow-xs ring-1 ring-brand/20'
                    : 'bg-canvas border-line hover:border-accent'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-faint" />
                    {rev.date}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono border ${style.bg} ${style.text} ${style.border}`}
                  >
                    {rev.grade}
                  </span>
                </div>

                <div className="text-xs text-ink-soft space-y-1 mb-2">
                  <p className="line-clamp-2 italic text-ink-soft">
                    &ldquo;{rev.keyTakeaway || rev.eveningNotes || 'No notes entered.'}&rdquo;
                  </p>
                </div>

                <div className="pt-2 border-t border-line-soft flex items-center justify-between text-[11px] text-faint font-mono">
                  <span>{rev.marketConditions}</span>
                  <span>Rules: {rev.rulesFollowedPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
