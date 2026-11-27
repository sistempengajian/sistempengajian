'use client';

import { useEffect } from 'react';

let activeModalLocks = 0;
let previousBodyOverflow = '';

/**
 * Mengunci scroll body dan mengaktifkan isolasi BottomNav/PWA (`body.modal-open`)
 * dengan reference counter agar aman saat beberapa modal atau sheet dibuka bertumpuk.
 */
export function useBodyModalLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    if (activeModalLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      document.body.setAttribute('data-modal-open', 'true');
    }
    activeModalLocks += 1;

    return () => {
      activeModalLocks = Math.max(0, activeModalLocks - 1);
      if (activeModalLocks === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.classList.remove('modal-open');
        document.body.removeAttribute('data-modal-open');
      }
    };
  }, [isLocked]);
}
