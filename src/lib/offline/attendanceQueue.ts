import { offlineDb, OfflineAttendanceItem } from '@/lib/offline-db';
import { recordManualAttendance } from '@/app/(protected)/presensi/actions';
import { AttendanceStatus } from '@prisma/client';

export interface EnqueueAttendanceParams {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  method?: 'QR_SCAN_STUDENT' | 'CARD_SCAN_TEACHER' | 'MANUAL_TEACHER';
  notes?: string;
}

/**
 * Menyimpan mutasi presensi ke antrean offline IndexedDB
 */
export async function enqueueOfflineAttendance(
  params: EnqueueAttendanceParams
): Promise<number | null> {
  if (!offlineDb) return null;
  try {
    return await offlineDb.attendanceQueue.add({
      sessionId: params.sessionId,
      studentId: params.studentId,
      status: params.status,
      method: params.method || 'MANUAL_TEACHER',
      notes: params.notes,
      timestamp: new Date().toISOString(),
      synced: false,
    });
  } catch (error) {
    console.error('[OfflineQueue] Gagal menyimpan ke antrean offline:', error);
    return null;
  }
}

/**
 * Mengambil semua data absensi offline yang belum tersinkronisasi
 */
export async function getPendingAttendanceQueue(): Promise<OfflineAttendanceItem[]> {
  if (!offlineDb) return [];
  try {
    return await offlineDb.attendanceQueue.filter((item) => !item.synced).toArray();
  } catch (error) {
    console.error('[OfflineQueue] Gagal mengambil antrean:', error);
    return [];
  }
}

/**
 * Mengambil jumlah item dalam antrean yang belum tersinkronisasi
 */
export async function getPendingAttendanceCount(): Promise<number> {
  if (!offlineDb) return 0;
  try {
    return await offlineDb.attendanceQueue.filter((item) => !item.synced).count();
  } catch {
    return 0;
  }
}

/**
 * Menghapus item yang telah berhasil disinkronkan dari antrean
 */
export async function removeSyncedAttendanceItems(ids: number[]): Promise<void> {
  if (!offlineDb || ids.length === 0) return;
  try {
    await offlineDb.attendanceQueue.bulkDelete(ids);
  } catch (error) {
    console.error('[OfflineQueue] Gagal menghapus antrean tersinkronisasi:', error);
  }
}

/**
 * Memproses dan menyinkronkan seluruh antrean presensi yang tertunda ke server
 */
export async function processOfflineAttendanceQueue(): Promise<{
  successCount: number;
  failedCount: number;
  total: number;
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  const pendingItems = await getPendingAttendanceQueue();
  if (pendingItems.length === 0) {
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  let successCount = 0;
  let failedCount = 0;
  const successfulIds: number[] = [];

  for (const item of pendingItems) {
    try {
      await recordManualAttendance(
        item.sessionId,
        item.studentId,
        item.status as AttendanceStatus,
        item.notes
      );
      if (item.id !== undefined) {
        successfulIds.push(item.id);
      }
      successCount++;
    } catch (err) {
      console.error(`[OfflineQueue Sync] Gagal sinkron santri ${item.studentId}:`, err);
      failedCount++;
    }
  }

  if (successfulIds.length > 0) {
    await removeSyncedAttendanceItems(successfulIds);
  }

  return {
    successCount,
    failedCount,
    total: pendingItems.length,
  };
}
