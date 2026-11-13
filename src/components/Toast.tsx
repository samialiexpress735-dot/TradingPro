import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastHostProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

const STYLES = {
  success: { ring: 'border-profit-line', icon: 'text-profit', Icon: CheckCircle2 },
  error: { ring: 'border-loss-line', icon: 'text-loss', Icon: AlertCircle },
  info: { ring: 'border-line-brand', icon: 'text-brand', Icon: Info },
} as const;

export const ToastHost: React.FC<ToastHostProps> = ({ toast, onDismiss, durationMs = 6000 }) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.kind === 'error' ? durationMs + 3000 : durationMs);
    return () => clearTimeout(t);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;
  const { ring, icon, Icon } = STYLES[toast.kind];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-md" role="status" aria-live="polite">
      <div className={`flex items-center gap-3 rounded-xl bg-surface border ${ring} px-4 py-3 shadow-2xl`}>
        <Icon className={`w-4 h-4 shrink-0 ${icon}`} />
        <span className="flex-1 text-sm text-ink">{toast.text}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="text-xs font-bold text-brand hover:underline cursor-pointer px-1"
          >
            {toast.actionLabel}
          </button>
        )}
        <button onClick={onDismiss} className="text-faint hover:text-ink cursor-pointer" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
