'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Trash2,
  Info,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalOptions {
  title: string;
  description: string;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  /** Show a loading spinner on the confirm button */
  isPending?: boolean;
}

interface ConfirmModalProps extends ConfirmModalOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Variant Config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  {
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    confirmBg: string;
    confirmHover: string;
    defaultConfirmText: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    confirmBg: 'bg-rose-600',
    confirmHover: 'hover:bg-rose-700 active:bg-rose-800',
    defaultConfirmText: 'Ya, Hapus',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    confirmBg: 'bg-amber-600',
    confirmHover: 'hover:bg-amber-700 active:bg-amber-800',
    defaultConfirmText: 'Ya, Lanjutkan',
  },
  info: {
    icon: ShieldAlert,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    confirmBg: 'bg-blue-600',
    confirmHover: 'hover:bg-blue-700 active:bg-blue-800',
    defaultConfirmText: 'Konfirmasi',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ConfirmModal({
  isOpen,
  title,
  description,
  variant = 'danger',
  confirmText,
  cancelText = 'Batal',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      // Focus the cancel button for safety (not the confirm)
      // but trap focus inside the modal
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onCancel();
      }
    },
    [isPending, onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !mounted) return null;

  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  const resolvedConfirmText = confirmText ?? config.defaultConfirmText;

  const modalContent = (
    <div
      className={`
        fixed inset-0 z-[9990] flex items-end sm:items-center justify-center
        transition-all duration-300
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-slate-900/60 backdrop-blur-sm
          transition-opacity duration-300
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={isPending ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        className={`
          relative z-10 w-full
          sm:max-w-sm
          bg-white
          sm:rounded-3xl rounded-t-3xl
          border border-slate-200/80
          shadow-modal
          transition-all duration-300 ease-out
          ${
            isVisible
              ? 'translate-y-0 scale-100 opacity-100'
              : 'translate-y-8 sm:translate-y-4 sm:scale-95 opacity-0'
          }
        `}
      >
        {/* Drag Handle (mobile bottom sheet) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-center">
          {/* Icon */}
          <div
            className={`
              w-12 h-12 rounded-2xl mx-auto flex items-center justify-center
              ${config.iconBg} ${config.iconColor}
              border border-current/10 shadow-2xs
            `}
          >
            <Icon className="w-6 h-6" />
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-slate-900 leading-tight"
            >
              {title}
            </h3>
            <p
              id="confirm-modal-desc"
              className="text-xs text-slate-500 leading-relaxed"
            >
              {description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="
                flex-1 py-2.5 sm:py-2.5 rounded-xl
                border border-slate-200 text-slate-600
                hover:bg-slate-100 active:bg-slate-200
                text-xs font-semibold transition-colors cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                min-h-[44px] sm:min-h-0
              "
            >
              {cancelText}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className={`
                flex-1 py-2.5 sm:py-2.5 rounded-xl
                ${config.confirmBg} ${config.confirmHover}
                text-white text-xs font-bold
                shadow-xs transition-all cursor-pointer
                active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-1.5
                min-h-[44px] sm:min-h-0
              `}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{resolvedConfirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Safe area padding for iOS */}
        <div className="sm:hidden pb-safe" />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ── Imperative Hook (optional convenience) ───────────────────────────────────

export interface UseConfirmReturn {
  isOpen: boolean;
  isPending: boolean;
  options: ConfirmModalOptions | null;
  open: (
    options: ConfirmModalOptions,
    onConfirm: () => void | Promise<void>
  ) => void;
  close: () => void;
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>;
  ConfirmModalComponent: () => React.ReactNode;
}

/**
 * Hook for imperative confirm modal usage.
 * 
 * @example
 * ```tsx
 * const { open, ConfirmModalComponent } = useConfirm();
 * 
 * const handleDelete = () => {
 *   open(
 *     { title: 'Hapus data?', description: '...', variant: 'danger' },
 *     async () => { await deleteAction(); }
 *   );
 * };
 * 
 * return <>{ConfirmModalComponent()}</>;
 * ```
 */
export function useConfirm(): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [options, setOptions] = useState<ConfirmModalOptions | null>(null);
  const onConfirmRef = useRef<(() => void | Promise<void>) | null>(null);

  const open = useCallback(
    (opts: ConfirmModalOptions, onConfirm: () => void | Promise<void>) => {
      setOptions(opts);
      onConfirmRef.current = onConfirm;
      setIsOpen(true);
      setIsPending(false);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setIsPending(false);
    // Delay clearing options to allow exit animation
    setTimeout(() => {
      setOptions(null);
      onConfirmRef.current = null;
    }, 350);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!onConfirmRef.current) return;
    try {
      setIsPending(true);
      await onConfirmRef.current();
      close();
    } catch {
      setIsPending(false);
    }
  }, [close]);

  const ConfirmModalComponent = useCallback(
    () =>
      options ? (
        <ConfirmModal
          isOpen={isOpen}
          title={options.title}
          description={options.description}
          variant={options.variant}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={close}
        />
      ) : null,
    [isOpen, isPending, options, handleConfirm, close]
  );

  return {
    isOpen,
    isPending,
    options,
    open,
    close,
    setIsPending,
    ConfirmModalComponent,
  };
}
