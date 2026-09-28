import { whatsAppClient } from './WhatsAppClient';
import { SendMessageResult } from './types';

function getBaseAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * 1. Pemicu Notifikasi Alpa Santri + Magic Link Izin ke Orang Tua
 */
export async function sendAbsenceAlertNotification(params: {
  parentPhone: string;
  parentName: string;
  studentName: string;
  scheduleTitle: string;
  scheduleTime: string;
  venueName: string;
  magicToken: string;
  organizationName: string;
  attendanceRecordId: string;
  parentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const magicLink = `${baseUrl}/izin/konfirmasi/${params.magicToken}`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'ATTENDANCE_ALERT',
    templateCode: 'ATTENDANCE_ALPA_MAGIC',
    message: '', // Will be resolved by template
    templateVariables: {
      nama_ortu: params.parentName,
      nama_santri: params.studentName,
      judul_pengajian: params.scheduleTitle,
      waktu_sesi: params.scheduleTime,
      tempat_pengajian: params.venueName,
      magic_link_izin: magicLink,
      nama_kelompok: params.organizationName,
    },
    magicToken: params.magicToken,
    referenceId: params.attendanceRecordId,
  });
}

/**
 * 2. Pemicu Notifikasi Permintaan Paraf Tugas ke Orang Tua
 */
export async function sendParentTaskVerificationNotification(params: {
  parentPhone: string;
  parentName: string;
  studentName: string;
  taskTitle: string;
  pointsReward: number;
  parentBonusPoints?: number;
  magicToken: string;
  teacherName?: string;
  organizationName?: string;
  submissionId: string;
  parentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const magicLink = `${baseUrl}/tugas/paraf/${params.magicToken}`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'PARENT_TASK_PARAF',
    templateCode: 'PARENT_TASK_PARAF',
    message: '',
    templateVariables: {
      nama_ortu: params.parentName,
      nama_santri: params.studentName,
      judul_tugas: params.taskTitle,
      poin_tugas: params.pointsReward,
      magic_link_paraf: magicLink,
      bonus_poin: params.parentBonusPoints || 10,
      nama_wali_kelas: params.teacherName || 'Pengajar',
      nama_kelompok: params.organizationName || 'Kelompok Pengajian',
    },
    magicToken: params.magicToken,
    referenceId: params.submissionId,
  });
}

/**
 * 3. Pemicu Pengingat Jadwal Mengajar & Guru Badal ke Ustadz
 */
export async function sendScheduleBadalNotification(params: {
  teacherPhone: string;
  teacherName: string;
  materialTitle: string;
  generationName: string;
  className?: string;
  venueName: string;
  scheduleTime: string;
  isBadal?: boolean;
  scheduleId: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const dashboardUrl = `${baseUrl}/jadwal`;

  const isBadalText = params.isBadal
    ? '\n⚠️ *Status: Ustadz ditugaskan sebagai Guru Badal (Pengganti) untuk sesi ini.*\n'
    : '';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER',
    message: '',
    templateVariables: {
      nama_ustadz: params.teacherName,
      judul_materi: params.materialTitle,
      tingkat_jenjang: params.generationName,
      nama_kelas: params.className ? `(${params.className})` : '',
      tempat_pengajian: params.venueName,
      waktu_lengkap: params.scheduleTime,
      is_badal_text: isBadalText,
      dashboard_jadwal_url: dashboardUrl,
    },
    referenceId: params.scheduleId,
  });
}

/**
 * 4. Pemicu Pengiriman Rapor Perkembangan Santri ke WhatsApp Orang Tua
 */
export async function sendStudentDevelopmentReport(params: {
  parentPhone: string;
  parentName: string;
  studentName: string;
  monthName: string;
  attendanceRate: number;
  totalAttended: number;
  onTimeCount: number;
  lateCount: number;
  streakDays: number;
  completedMaterials: number;
  totalMaterials: number;
  adabScore: number;
  keaktifanScore: number;
  rankPosition: number;
  regionName: string;
  latestBadge?: string;
  studentId: string;
  parentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const reportUrl = `${baseUrl}/laporan`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'REPORT_CARD',
    templateCode: 'REPORT_CARD',
    message: '',
    templateVariables: {
      nama_ortu: params.parentName,
      nama_santri: params.studentName,
      nama_bulan: params.monthName,
      persentase_hadir: params.attendanceRate,
      total_hadir: params.totalAttended,
      tepat_waktu: params.onTimeCount,
      terlambat: params.lateCount,
      streak_hari: params.streakDays,
      materi_tuntas: params.completedMaterials,
      total_materi: params.totalMaterials,
      nilai_adab: params.adabScore,
      nilai_keaktifan: params.keaktifanScore,
      posisi_rank: params.rankPosition,
      nama_wilayah: params.regionName,
      lencana_terbaru: params.latestBadge || 'Santri Berakhlak Mulia ⭐',
      url_rapor_lengkap: reportUrl,
    },
    referenceId: params.studentId,
  });
}
