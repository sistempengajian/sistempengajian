'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import {
  getPendingAttendanceCount,
  processOfflineAttendanceQueue,
} from './attendanceQueue';

interface UseOfflineAttendanceSyncOptions {
  onSyncComplete?: () => void;
  autoSyncIntervalMs?: number;
}

/**
 * Hook untuk memantau status koneksi online/offline dan menyinkronkan
 * antrean presensi IndexedDB secara otomatis saat jaringan kembali terhubung.
 */
export function useOfflineAttendanceSync(options: UseOfflineAttendanceSyncOptions = {}) {
  const { onSyncComplete, autoSyncIntervalMs = 15000 } = options;
  const toast = useToast();

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingAttendanceCount();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    try {
      isSyncingRef.current = true;
      setIsSyncing(true);

      const count = await getPendingAttendanceCount();
      if (count === 0) {
        setPendingCount(0);
        return;
      }

      toast.info(`Koneksi pulih: Menyinkronkan ${count} data presensi tertunda...`);

      const result = await processOfflineAttendanceQueue();
      await refreshPendingCount();

      if (result.successCount > 0) {
        toast.success(
          `Sukses menyinkronkan ${result.successCount} data presensi ke server.`
        );
        onSyncComplete?.();
      }

      if (result.failedCount > 0) {
        toast.warning(
          `${result.failedCount} data presensi gagal disinkronkan. Akan dicoba lagi nanti.`
        );
      }
    } catch (err) {
      console.error('[useOfflineAttendanceSync] Error during sync:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [toast, onSyncComplete, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Polling ringan untuk memeriksa antrean dan koneksi
    const interval = setInterval(() => {
      refreshPendingCount();
      if (navigator.onLine && !isSyncingRef.current) {
        getPendingAttendanceCount().then((cnt) => {
          if (cnt > 0) {
            syncNow();
          }
        });
      }
    }, autoSyncIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount, autoSyncIntervalMs]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
    refreshPendingCount,
  };
}
