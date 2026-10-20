/**
 * Global UI Component Library — Sistem Pengajian Design System
 *
 * Barrel export file untuk komponen UI global yang menggantikan
 * elemen bawaan browser (alert, confirm, select) dengan komponen
 * kustom yang konsisten, mobile-first, dan accessible.
 *
 * @example
 * ```tsx
 * import { useToast } from '@/components/ui';
 * import { LoadingButton, CustomSelect, ConfirmModal } from '@/components/ui';
 * import { Skeleton, SkeletonCard, SkeletonPage } from '@/components/ui';
 * ```
 */

// Toast Notification System
export { ToastProvider, useToast } from './Toast';
export type { ToastVariant, ToastOptions, ToastItem } from './Toast';

// Confirmation Modal
export { default as ConfirmModal, useConfirm } from './ConfirmModal';
export type { ConfirmVariant, ConfirmModalOptions } from './ConfirmModal';

// Searchable Select / Bottom Sheet
export { default as CustomSelect } from './CustomSelect';
export type { SelectOption } from './CustomSelect';

// Loading Button
export { default as LoadingButton } from './LoadingButton';
export type { ButtonVariant, ButtonSize } from './LoadingButton';

// Skeleton Loaders
export {
  Skeleton,
  SkeletonLine,
  SkeletonCircle,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonStat,
  SkeletonPage,
} from './Skeleton';
