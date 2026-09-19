import Dexie, { type Table } from 'dexie';

export interface OfflineAttendanceItem {
  id?: number;
  sessionId: string;
  studentId: string;
  method: 'QR_SCAN_STUDENT' | 'CARD_SCAN_TEACHER' | 'MANUAL_TEACHER';
  status: 'HADIR' | 'TERLAMBAT' | 'SAKIT' | 'IZIN' | 'ALPA';
  notes?: string;
  timestamp: string;
  synced: boolean;
}

export class PengajianOfflineDatabase extends Dexie {
  attendanceQueue!: Table<OfflineAttendanceItem, number>;

  constructor() {
    super('PengajianOfflineDB');
    this.version(1).stores({
      attendanceQueue: '++id, sessionId, studentId, status, timestamp, synced',
    });
  }
}

export const offlineDb = typeof window !== 'undefined' ? new PengajianOfflineDatabase() : null;

/**
 * Menyimpan data absensi ke antrean offline IndexedDB jika jaringan terputus
 */
export async function queueOfflineAttendance(
  item: Omit<OfflineAttendanceItem, 'id' | 'synced'>
): Promise<number | null> {
  if (!offlineDb) return null;
  try {
    return await offlineDb.attendanceQueue.add({
      ...item,
      synced: false,
    });
  } catch (error) {
    console.error('Gagal menyimpan ke IndexedDB offline:', error);
    return null;
  }
}

/**
 * Mengambil seluruh data antrean offline yang belum tersinkronisasi
 */
export async function getUnsyncedAttendance(): Promise<OfflineAttendanceItem[]> {
  if (!offlineDb) return [];
  try {
    return await offlineDb.attendanceQueue.where('synced').equals(0).toArray();
  } catch (error) {
    console.error('Gagal membaca antrean IndexedDB:', error);
    return [];
  }
}

/**
 * Menandai antrean sebagai telah tersinkronisasi atau menghapusnya
 */
export async function clearSyncedAttendance(ids: number[]): Promise<void> {
  if (!offlineDb || ids.length === 0) return;
  try {
    await offlineDb.attendanceQueue.bulkDelete(ids);
  } catch (error) {
    console.error('Gagal membersihkan antrean sinkronisasi:', error);
  }
}
