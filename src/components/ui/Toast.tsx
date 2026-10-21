'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';

// ── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default: 4000. Use 0 to persist until manually dismissed. */
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

// ── Variant Config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    bgClass: string;
    borderClass: string;
    iconClass: string;
    textClass: string;
    progressClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200/80',
    iconClass: 'text-emerald-600',
    textClass: 'text-emerald-900',
    progressClass: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200/80',
    iconClass: 'text-rose-600',
    textClass: 'text-rose-900',
    progressClass: 'bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200/80',
    iconClass: 'text-amber-600',
    textClass: 'text-amber-900',
    progressClass: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200/80',
    iconClass: 'text-blue-600',
    textClass: 'text-blue-900',
    progressClass: 'bg-blue-500',
  },
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;

// ── Single Toast Item ────────────────────────────────────────────────────────

function ToastItemComponent({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const config = VARIANT_CONFIG[item.variant];
  const Icon = config.icon;
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchOffsetRef = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss countdown
  useEffect(() => {
    if (item.duration <= 0) return;

    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafId = requestAnimationFrame(frame);
      }
    };
    let rafId = requestAnimationFrame(frame);

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(item.id), 280);
    }, item.duration);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [item.duration, item.id, onDismiss]);

  // Swipe-to-dismiss (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    touchOffsetRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !elementRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    // Only allow horizontal swipe (prevent interfering with scroll)
    if (Math.abs(dy) > Math.abs(dx)) return;

    touchOffsetRef.current = dx;
    elementRef.current.style.transform = `translateX(${dx}px)`;
    elementRef.current.style.opacity = `${Math.max(0.2, 1 - Math.abs(dx) / 250)}`;
  };

  const handleTouchEnd = () => {
    if (!elementRef.current) return;
    if (Math.abs(touchOffsetRef.current) > 100) {
      // Dismiss via swipe
      const direction = touchOffsetRef.current > 0 ? '120%' : '-120%';
      elementRef.current.style.transform = `translateX(${direction})`;
      elementRef.current.style.opacity = '0';
      setTimeout(() => onDismiss(item.id), 200);
    } else {
      // Snap back
      elementRef.current.style.transform = 'translateX(0)';
      elementRef.current.style.opacity = '1';
    }
    touchStartRef.current = null;
  };

  return (
    <div
      ref={elementRef}
      role="alert"
      aria-live="assertive"
      className={`
        relative overflow-hidden
        w-full max-w-sm
        ${config.bgClass} border ${config.borderClass}
        rounded-2xl shadow-toast
        transition-all duration-280 ease-out
        ${isExiting ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'}
        animate-toast-in
      `}
      style={{ willChange: 'transform, opacity' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-2.5 p-3.5 pr-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${config.iconClass}`}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </div>

        {/* Message */}
        <p className={`flex-1 text-[13px] leading-snug font-medium ${config.textClass} pr-1`}>
          {item.message}
        </p>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(item.id), 280);
          }}
          className={`
            shrink-0 p-1 -mr-1 -mt-0.5 rounded-lg
            ${config.iconClass} opacity-50 hover:opacity-100
            transition-opacity cursor-pointer
          `}
          aria-label="Tutup notifikasi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      {item.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/5">
          <div
            className={`h-full ${config.progressClass} opacity-40 transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Toast Container (Portal) ─────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const visible = toasts.slice(-MAX_VISIBLE);

  return createPortal(
    <div
      aria-label="Notifikasi"
      className="
        fixed z-[9999]
        bottom-24 sm:bottom-6
        left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6
        flex flex-col-reverse items-center sm:items-end gap-2.5
        w-[calc(100%-2rem)] sm:w-auto
        pointer-events-none
      "
    >
      {visible.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full sm:w-auto">
          <ToastItemComponent item={item} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`;
    const variant = options.variant ?? 'info';
    if (variant === 'success') {
      triggerHapticSuccess();
    } else if (variant === 'error' || variant === 'warning') {
      triggerHapticWarning();
    }

    const newToast: ToastItem = {
      id,
      message: options.message,
      variant,
      duration: options.duration ?? DEFAULT_DURATION,
      createdAt: Date.now(),
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback(
    (message: string, duration?: number) =>
      toast({ message, variant: 'success', duration }),
    [toast]
  );

  const error = useCallback(
    (message: string, duration?: number) =>
      toast({ message, variant: 'error', duration: duration ?? 5000 }),
    [toast]
  );

  const warning = useCallback(
    (message: string, duration?: number) =>
      toast({ message, variant: 'warning', duration }),
    [toast]
  );

  const info = useCallback(
    (message: string, duration?: number) =>
      toast({ message, variant: 'info', duration }),
    [toast]
  );

  const value: ToastContextValue = {
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
