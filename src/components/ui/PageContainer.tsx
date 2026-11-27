import React from 'react';
import { LAYOUT } from '@/lib/design-tokens';

export type PageContainerVariant = 'standard' | 'medium' | 'wide';

interface PageContainerProps {
  children: React.ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<PageContainerVariant, string> = {
  standard: LAYOUT.containerMobile,
  medium: LAYOUT.containerMedium,
  wide: LAYOUT.containerWide,
};

/**
 * Standar kontainer halaman `(protected)` agar padding tepi, max-width, dan jarak vertikal konsisten.
 */
export default function PageContainer({
  children,
  variant = 'standard',
  className = '',
}: PageContainerProps) {
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${className}`.trim()}>
      {children}
    </div>
  );
}
