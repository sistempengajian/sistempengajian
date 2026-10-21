import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  /** Optional icon to display. Defaults to an Inbox icon if not provided. */
  icon?: React.ReactNode;
  /** Primary title message */
  title: string;
  /** Secondary explanatory description */
  description?: string;
  /** Label for the call-to-action button */
  actionLabel?: string;
  /** Callback triggered when the call-to-action button is clicked */
  onAction?: () => void;
  /** Additional custom classNames for the container */
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-xs
        p-8 sm:p-10 text-center flex flex-col items-center justify-center
        transition-all ${className}
      `}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-100/90 border border-slate-200/60 text-slate-400 flex items-center justify-center mb-1 shadow-2xs">
        {icon ? (
          icon
        ) : (
          <Inbox className="w-7 h-7 text-slate-400" aria-hidden="true" />
        )}
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <div className="pt-3">
          <button
            type="button"
            onClick={onAction}
            className="
              inline-flex items-center justify-center
              px-4 py-2.5 min-h-[44px] rounded-xl
              bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
              text-white text-xs font-semibold shadow-xs
              transition-all cursor-pointer
            "
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
