import { whatsAppClient } from './WhatsAppClient';
import { SendMessageResult } from './types';
import {
  formatParentSalutation,
  formatTeacherSalutation,
  formatStudentSalutation,
  formatScheduleNotesBlock,
  formatScheduleClassBlock,
  formatScheduleMaterialsBlock,
  formatFamilyStudentMaterialsBlock,
} from './utils';
import {
  generateSubstituteRequestToken,
  generateDirectPresensiToken,
} from '@/lib/badalToken';
import {
  generateStudentAbsenceRequestToken,
  generateStudentDirectPresensiToken,
  generateTeacherLessonPlanToken,
} from '@/lib/studentAbsenceToken';

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
  parentGender?: string | null;
  relationshipType?: string | null;
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
  const sapaanOrtu = `*${formatParentSalutation(params.parentName, params.parentGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}.*`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'ATTENDANCE_ALERT',
    templateCode: 'ATTENDANCE_ALPA_MAGIC',
    message: '',
    templateVariables: {
      sapaan_ortu: sapaanOrtu,
      nama_santri: params.studentName,
      judul_pengajian: params.scheduleTitle,
      hari_tanggal: 'Hari Ini',
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
  parentGender?: string | null;
  relationshipType?: string | null;
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
  const sapaanOrtu = `*${formatParentSalutation(params.parentName, params.parentGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}.*`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'PARENT_TASK_PARAF',
    templateCode: 'PARENT_TASK_PARAF',
    message: '',
    templateVariables: {
      sapaan_ortu: sapaanOrtu,
      nama_santri: params.studentName,
      judul_tugas: params.taskTitle,
      hari_tanggal: 'Hari Ini',
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
 * 3. Pemicu Pengingat Jadwal Mengajar & Guru Badal ke Ustadz/Ustadzah
 */
export async function sendScheduleBadalNotification(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate?: string;
  materialTitle: string;
  generationName: string;
  className?: string;
  venueName: string;
  scheduleTime: string;
  isBadal?: boolean;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const detailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;
  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;
  const isBadalText = params.isBadal
    ? `\n*• Status Penugasan* _Guru Badal (Pengganti)_\n`
    : '';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate || 'Hari Ini',
      waktu_lengkap: params.scheduleTime,
      tempat_pengajian: params.venueName,
      kelas_block: formatScheduleClassBlock(params.className || params.generationName),
      materi_block: formatScheduleMaterialsBlock(params.materialTitle),
      is_badal_text: isBadalText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      dashboard_jadwal_url: detailUrl,
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
  parentGender?: string | null;
  relationshipType?: string | null;
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
  const sapaanOrtu = `*${formatParentSalutation(params.parentName, params.parentGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}.*`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'REPORT_CARD',
    templateCode: 'REPORT_CARD',
    message: '',
    templateVariables: {
      sapaan_ortu: sapaanOrtu,
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
      lencana_terbaru: params.latestBadge || 'Santri Berakhlak Mulia',
      url_rapor_lengkap: reportUrl,
    },
    referenceId: params.studentId,
  });
}

/**
 * 5. Pemicu Pengingat Jadwal H-1 untuk Santri & Wali Santri
 */
export async function sendScheduleReminderH1ToStudent(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  relationshipType?: string | null;
  isParent?: boolean;
  studentName: string;
  generationName: string;
  className?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  materialTitle: string;
  teacherName: string;
  teacherGender?: string | null;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  magicToken?: string;
  recipientUserId?: string;
  studentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  // ID Santri untuk token
  const effectiveStudentId = params.studentUserId || params.recipientUserId || params.scheduleId;
  const submitterUserId = params.recipientUserId || effectiveStudentId;
  const submitterRole = params.isParent ? 'PARENT' : 'STUDENT';

  // 1. Direct Presensi Santri
  const presensiToken = generateStudentDirectPresensiToken(params.scheduleId, effectiveStudentId);
  const directPresensiUrl = `${baseUrl}/auth/direct?target=presensi_santri&scheduleId=${params.scheduleId}&token=${presensiToken}`;

  // 2. Pengajuan Izin Santri Mandiri
  const absenceToken = generateStudentAbsenceRequestToken(
    params.scheduleId,
    effectiveStudentId,
    submitterUserId,
    submitterRole
  );
  const ajukanIzinUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;

  const classOrGen = params.className || params.generationName;

  // Title penerima dinamis (Santri -> Kak [Nama] *- [Kelas].*, Ortu -> Yth. Bapak/Ibu [Nama] *- Wali dari Ananda [Nama] ([Kelas]).*)
  const sapaanPenerima = params.isParent
    ? `Yth. *${formatParentSalutation(params.recipientName, params.recipientGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}${classOrGen ? ` (${classOrGen})` : ''}.*`
    : `${formatStudentSalutation(params.studentName)}${classOrGen ? ` *- ${classOrGen}.*` : ''}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const materiBlock = formatScheduleMaterialsBlock(params.materialTitle);

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_H1_STUDENT',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaanPenerima,
      nama_santri: params.studentName,
      jenjang_santri: classOrGen || '',
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      judul_materi: params.materialTitle,
      materi_block: materiBlock,
      nama_ustadz: sapaanUstadz,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 5.1. Pemicu Tautan Aksi Santri / Wali Santri H-1 (Pesan Terpisah: Pengajuan Izin / Sakit)
 */
export async function sendStudentActionLinkH1(params: {
  recipientPhone: string;
  recipientName?: string | null;
  recipientUserId?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  scheduleId: string;
  studentUserId?: string;
  isParent?: boolean;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const effectiveStudentId = params.studentUserId || params.recipientUserId || params.scheduleId;
  const submitterUserId = params.recipientUserId || effectiveStudentId;
  const submitterRole = params.isParent ? 'PARENT' : 'STUDENT';

  const absenceToken = generateStudentAbsenceRequestToken(
    params.scheduleId,
    effectiveStudentId,
    submitterUserId,
    submitterRole
  );
  const ajukanIzinUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName || 'Santri/Wali',
    recipientUserId: params.recipientUserId || undefined,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'STUDENT_ACTION_LINK_H1',
    message: '',
    templateVariables: {
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      url_ajukan_izin: ajukanIzinUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 6. Pemicu Pengingat Jadwal H-1 untuk Ustadz / Ustadzah Pengajar
 */
export async function sendScheduleReminderH1ToTeacher(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  generationName: string | string[];
  className?: string | string[];
  materialTitle: string;
  isBadal?: boolean;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  magicToken?: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;
  const isBadalText = params.isBadal
    ? `\n*• Status Penugasan* _Guru Badal (Pengganti)_\n`
    : '';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_H1_TEACHER',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      kelas_block: formatScheduleClassBlock(params.className || params.generationName),
      materi_block: formatScheduleMaterialsBlock(params.materialTitle),
      is_badal_text: isBadalText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 6.1. Pemicu Tautan Aksi Pengajar H-1 (Pesan Terpisah: Materi & Pengajuan Badal)
 */
export async function sendTeacherActionLinksH1(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  scheduleId: string;
  teacherUserId?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const teacherIdForToken = params.teacherUserId || params.scheduleId;
  const badalReqToken = generateSubstituteRequestToken(params.scheduleId, teacherIdForToken);
  const requestBadalUrl = `${baseUrl}/badal/ajukan/${badalReqToken}`;

  const teacherPlanToken = generateTeacherLessonPlanToken(params.scheduleId, teacherIdForToken);
  const lessonPlanUrl = `${baseUrl}/pengajar/sesi/${teacherPlanToken}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_ACTION_LINKS_H1',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      url_rencana_materi: lessonPlanUrl,
      url_ajukan_badal: requestBadalUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 6.2. Pemicu Pengingat Countdown 2 Jam untuk Pengajar (Pesan 1)
 */
export async function sendScheduleReminderCountdownTeacher(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  generationName: string | string[];
  className?: string | string[];
  materialTitle: string;
  isBadal?: boolean;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  magicToken?: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;
  const isBadalText = params.isBadal
    ? `\n*• Status Penugasan* _Guru Badal (Pengganti)_\n`
    : '';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_COUNTDOWN_TEACHER',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      kelas_block: formatScheduleClassBlock(params.className || params.generationName),
      materi_block: formatScheduleMaterialsBlock(params.materialTitle),
      is_badal_text: isBadalText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 6.3. Pemicu Tautan Akses Presensi Pengajar (-2 Jam Sesi, Pesan Terpisah)
 */
export async function sendTeacherPresensiLink2h(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  scheduleId: string;
  teacherUserId?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const teacherIdForToken = params.teacherUserId || params.scheduleId;
  const directPresensiToken = generateDirectPresensiToken(params.scheduleId, teacherIdForToken);
  const directPresensiUrl = `${baseUrl}/auth/direct?target=presensi&scheduleId=${params.scheduleId}&token=${directPresensiToken}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_PRESENSI_LINK_2H',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      url_absensi: directPresensiUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

export interface TeacherMultiScheduleItem {
  scheduleId: string;
  scheduleTitle: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName?: string;
  generationClassName?: string | string[];
  materialTitle: string;
  isBadal?: boolean;
}

/**
 * 6.4a. Pemicu Rangkuman Agenda Mengajar H-1 (Multi-Sesi Pengajar - Pesan 1: Info Jadwal)
 */
export async function sendTeacherMultiScheduleDigestH1(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  dayDate: string;
  organizationName: string;
  items: TeacherMultiScheduleItem[];
  magicToken?: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const schedulePortalUrl = `${baseUrl}/jadwal`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;

  // Format daftar sesi esok hari
  const daftarSesiRingkas = params.items
    .map((item, idx) => {
      const badalSuffix = item.isBadal
        ? `\n *• Status Penugasan :* _Guru Badal (Pengganti)_`
        : '';
      const jenjangStr = formatScheduleClassBlock(item.generationClassName || 'Umum');
      const materiStr = formatScheduleMaterialsBlock(item.materialTitle);
      return `*${idx + 1}. ${item.scheduleTitle.trim()}*
 *• Waktu :* \`\`\`${item.startTime} - ${item.endTime} WIB\`\`\`
 *• Tempat :* _${item.venueName}${item.organizationName ? ` (${item.organizationName})` : ''}_
 *• Jenjang :*${jenjangStr}
 *• Materi :*${materiStr}${badalSuffix}`;
    })
    .join('\n\n');

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_MULTI_SCHEDULE_DIGEST_H1',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      hari_tanggal: params.dayDate,
      jumlah_sesi: String(params.items.length),
      daftar_sesi_ringkas: daftarSesiRingkas,
      url_jadwal: schedulePortalUrl,
      nama_kelompok: params.organizationName || '',
    },
    magicToken: params.magicToken,
    referenceId: params.items[0]?.scheduleId,
  });
}

/**
 * 6.4b. Pemicu Tautan Aksi Mengajar & Badal H-1 (Multi-Sesi Pengajar - Pesan 2: Tautan Aksi)
 */
export async function sendTeacherMultiScheduleActionsH1(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  dayDate: string;
  items: TeacherMultiScheduleItem[];
  magicToken?: string;
  teacherUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();

  const daftarTautanAksi = params.items
    .map((item, idx) => {
      const teacherIdForToken = params.teacherUserId || item.scheduleId;
      const lessonPlanToken = generateTeacherLessonPlanToken(item.scheduleId, teacherIdForToken);
      const lessonPlanUrl = `${baseUrl}/pengajar/sesi/${lessonPlanToken}`;

      const badalToken = generateSubstituteRequestToken(item.scheduleId, teacherIdForToken);
      const requestBadalUrl = `${baseUrl}/badal/ajukan/${badalToken}`;

      return `*Sesi ${idx + 1}: ${item.scheduleTitle.trim()} (${item.startTime} WIB)*
*• Persiapan Materi:*
${lessonPlanUrl}
*• Berhalangan Mengajar ? Ajukan Badal:*
${requestBadalUrl}`;
    })
    .join('\n\n');

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_MULTI_SCHEDULE_ACTIONS_H1',
    message: '',
    templateVariables: {
      hari_tanggal: params.dayDate,
      daftar_tautan_aksi: daftarTautanAksi,
    },
    magicToken: params.magicToken,
    referenceId: params.items[0]?.scheduleId,
  });
}

/**
 * 6.5. Pemicu Permohonan Delegasi Guru Badal (Ke Calon Badal & PJ Wilayah)
 */
export async function sendSubstituteRequestInvitationNotification(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  isPj: boolean;
  scheduleTitle: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  generationClassName: string;
  materialTitle: string;
  requesterName: string;
  reason: string;
  confirmToken: string;
  requestId: string;
  recipientUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const confirmUrl = `${baseUrl}/badal/konfirmasi/${params.confirmToken}`;
  const sapaanUstadz = formatTeacherSalutation(params.recipientName, params.recipientGender);
  const sapaan = params.isPj
    ? `*${sapaanUstadz}* *- PJ Wilayah.*`
    : `*${sapaanUstadz}* *- Calon Guru Badal.*`;
  const peranText = params.isPj
    ? 'Terdapat permohonan pendelegasian'
    : 'Anda diajukan sebagai calon penerima';

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SUBSTITUTE_REQUEST_INVITATION',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaan,
      peran_penerima_text: peranText,
      judul_sesi: params.scheduleTitle,
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName,
      jenjang_kelas: params.generationClassName,
      judul_materi: params.materialTitle,
      nama_pemohon: params.requesterName,
      alasan_berhalangan: params.reason,
      url_konfirmasi_badal: confirmUrl,
    },
    magicToken: `SUB_INVITE_${params.requestId}_${params.recipientUserId}`,
    referenceId: params.requestId,
  });
}

/**
 * 6.6. Pemicu Hasil Konfirmasi Badal (Ke Pengajar Pemohon)
 */
export async function sendSubstituteDecisionNotification(params: {
  requesterPhone: string;
  requesterName: string;
  requesterGender?: string | null;
  isApproved: boolean;
  scheduleTitle: string;
  dayDate: string;
  substituteName?: string;
  approverName: string;
  notes?: string | null;
  organizationName: string;
  requestToken?: string;
  requestId: string;
  requesterUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const sapaanUstadz = formatTeacherSalutation(params.requesterName, params.requesterGender);
  const sapaan = `*${sapaanUstadz}* *- Pengajar Pemohon Badal.*`;

  if (params.isApproved) {
    const catatanStr = params.notes ? `\n*• Pesan Badal* _${params.notes.trim()}_\n` : '';

    return whatsAppClient.sendMessage({
      to: params.requesterPhone,
      recipientName: params.requesterName,
      recipientUserId: params.requesterUserId,
      messageType: 'SCHEDULE_REMINDER',
      templateCode: 'SUBSTITUTE_REQUEST_APPROVED',
      message: '',
      templateVariables: {
        sapaan_pemohon: sapaan,
        judul_sesi: params.scheduleTitle,
        hari_tanggal: params.dayDate,
        nama_badal: params.substituteName || 'Ustadz Badal',
        nama_penyetuju: params.approverName,
        catatan_persetujuan: catatanStr,
        nama_kelompok: params.organizationName,
      },
      magicToken: `SUB_DECISION_${params.requestId}_APPROVED`,
      referenceId: params.requestId,
    });
  } else {
    const reapplyUrl = params.requestToken
      ? `${baseUrl}/badal/ajukan/${params.requestToken}`
      : `${baseUrl}/jadwal`;

    return whatsAppClient.sendMessage({
      to: params.requesterPhone,
      recipientName: params.requesterName,
      recipientUserId: params.requesterUserId,
      messageType: 'SCHEDULE_REMINDER',
      templateCode: 'SUBSTITUTE_REQUEST_REJECTED',
      message: '',
      templateVariables: {
        sapaan_pemohon: sapaan,
        judul_sesi: params.scheduleTitle,
        hari_tanggal: params.dayDate,
        nama_penyetuju: params.approverName,
        catatan_penolakan: params.notes || 'Belum bersedia / berhalangan hadir',
        url_ajukan_badal_ulang: reapplyUrl,
        nama_kelompok: params.organizationName,
      },
      magicToken: `SUB_DECISION_${params.requestId}_REJECTED`,
      referenceId: params.requestId,
    });
  }
}

/**
 * 7. Pemicu Pengingat Jadwal Hari-H (Countdown 2 Jam Sebelum Sesi)
 */
export async function sendScheduleReminderCountdown(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  relationshipType?: string | null;
  isParent?: boolean;
  studentName: string;
  generationName?: string | null;
  className?: string | null;
  scheduleTitle?: string;
  dayDate?: string;
  startTime: string;
  endTime?: string;
  venueName: string;
  organizationName?: string;
  materialTitle: string;
  teacherName: string;
  teacherGender?: string | null;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  magicToken?: string;
  recipientUserId?: string;
  studentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  // ID Santri untuk token
  const effectiveStudentId = params.studentUserId || params.recipientUserId || params.scheduleId;
  const submitterUserId = params.recipientUserId || effectiveStudentId;
  const submitterRole = params.isParent ? 'PARENT' : 'STUDENT';

  // 1. Direct Presensi Santri
  const presensiToken = generateStudentDirectPresensiToken(params.scheduleId, effectiveStudentId);
  const directPresensiUrl = `${baseUrl}/auth/direct?target=presensi_santri&scheduleId=${params.scheduleId}&token=${presensiToken}`;

  // 2. Pengajuan Izin Santri Mandiri
  const absenceToken = generateStudentAbsenceRequestToken(
    params.scheduleId,
    effectiveStudentId,
    submitterUserId,
    submitterRole
  );
  const ajukanIzinUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;

  const classOrGen = params.className || params.generationName;

  // Title penerima dinamis
  const sapaanPenerima = params.isParent
    ? `Yth. *${formatParentSalutation(params.recipientName, params.recipientGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}${classOrGen ? ` (${classOrGen})` : ''}.*`
    : `${formatStudentSalutation(params.studentName)}${classOrGen ? ` *- ${classOrGen}.*` : ''}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const materiBlock = formatScheduleMaterialsBlock(params.materialTitle);

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_COUNTDOWN',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaanPenerima,
      nama_santri: params.studentName,
      jenjang_santri: classOrGen || '',
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate || 'Hari Ini',
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime || params.startTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      judul_materi: params.materialTitle,
      materi_block: materiBlock,
      nama_ustadz: sapaanUstadz,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 7.1. Pemicu Tautan Aksi Santri / Wali Santri -2 Jam (Pesan Terpisah: Presensi & Izin/Sakit)
 */
export async function sendStudentActionLinks2h(params: {
  recipientPhone: string;
  recipientName?: string | null;
  recipientUserId?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  scheduleId: string;
  studentUserId?: string;
  isParent?: boolean;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const effectiveStudentId = params.studentUserId || params.recipientUserId || params.scheduleId;
  const submitterUserId = params.recipientUserId || effectiveStudentId;
  const submitterRole = params.isParent ? 'PARENT' : 'STUDENT';

  // 1. Direct Presensi Santri
  const presensiToken = generateStudentDirectPresensiToken(params.scheduleId, effectiveStudentId);
  const directPresensiUrl = `${baseUrl}/auth/direct?target=presensi_santri&scheduleId=${params.scheduleId}&token=${presensiToken}`;

  // 2. Pengajuan Izin Santri Mandiri
  const absenceToken = generateStudentAbsenceRequestToken(
    params.scheduleId,
    effectiveStudentId,
    submitterUserId,
    submitterRole
  );
  const ajukanIzinUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName || 'Santri/Wali',
    recipientUserId: params.recipientUserId || undefined,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'STUDENT_ACTION_LINKS_2H',
    message: '',
    templateVariables: {
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      url_presensi: directPresensiUrl,
      url_ajukan_izin: ajukanIzinUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 8. Pemicu Pemberitahuan Perubahan Jadwal Darurat di Hari-H
 */
export async function sendScheduleChangeEmergencyAlert(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  relationshipType?: string | null;
  isParent?: boolean;
  isStudent?: boolean;
  organizationName: string;
  scheduleTitle: string;
  changeDescription: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  teacherName: string;
  notes?: string | null;
  scheduleId: string;
  recipientUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  let sapaanPenerima = `*${params.recipientName}* *- Peserta Sesi.*`;
  if (params.isParent) {
    sapaanPenerima = `*${formatParentSalutation(params.recipientName, params.recipientGender, params.relationshipType)}* *- Wali Santri.*`;
  } else if (params.isStudent) {
    sapaanPenerima = `*${formatStudentSalutation(params.recipientName)}* *- Santri.*`;
  }

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_CHANGE_EMERGENCY',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaanPenerima,
      nama_kelompok: params.organizationName,
      judul_sesi: params.scheduleTitle,
      status_perubahan_keterangan: params.changeDescription,
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_ustadz: params.teacherName,
      catatan_tambahan: formatScheduleNotesBlock(params.notes),
      url_jadwal: scheduleDetailUrl,
    },
    referenceId: params.scheduleId,
  });
}

/**
 * 9. Pemicu Permohonan Izin Santri Mandiri (Ke Ortu, Wali Kelas, dan PJ Wilayah)
 */
export async function sendStudentAbsenceRequestInvitationNotification(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  relationshipType?: string | null;
  approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
  studentName: string;
  className: string;
  scheduleTitle: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  absenceType: 'IZIN' | 'SAKIT';
  reasonNotes: string;
  hasAttachment?: boolean;
  confirmToken: string;
  requestId: string;
  recipientUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const confirmUrl = `${baseUrl}/izin/konfirmasi/${params.confirmToken}`;

  let sapaan = `*${params.recipientName}*`;
  let peranText = 'Terdapat permohonan konfirmasi';

  if (params.approverRole === 'PARENT') {
    sapaan = `*${formatParentSalutation(params.recipientName, params.recipientGender, params.relationshipType)}* *- Wali Santri.*`;
    peranText = 'Sebagai Orang Tua/Wali Santri, Anda menerima';
  } else if (params.approverRole === 'HOMEROOM_TEACHER') {
    sapaan = `*${formatTeacherSalutation(params.recipientName, params.recipientGender)}* *- Wali Kelas.*`;
    peranText = 'Sebagai Wali Kelas, Anda menerima';
  } else if (params.approverRole === 'PJ') {
    sapaan = `*${formatTeacherSalutation(params.recipientName, params.recipientGender)}* *- PJ Wilayah.*`;
    peranText = 'Sebagai PJ Wilayah, Anda menerima';
  }

  const jenisIzinText = params.absenceType === 'SAKIT' ? 'Izin Sakit' : 'Izin Berhalangan';
  const lampiranText = params.hasAttachment
    ? '\n*• Lampiran* _Terlampir bukti surat/foto pada sistem_\n'
    : '';

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'STUDENT_ABSENCE_REQUEST_INVITATION',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaan,
      peran_penerima_text: peranText,
      nama_santri: params.studentName,
      nama_kelas: params.className,
      judul_sesi: params.scheduleTitle,
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName,
      jenis_izin_text: jenisIzinText,
      catatan_alasan: params.reasonNotes,
      lampiran_text: lampiranText,
      url_konfirmasi_izin: confirmUrl,
    },
    magicToken: `STU_ABS_INVITE_${params.requestId}_${params.recipientUserId}`,
    referenceId: params.requestId,
  });
}

/**
 * 10. Pemicu Hasil Konfirmasi Izin Santri (Ke Santri / Ortu)
 */
export async function sendStudentAbsenceDecisionNotification(params: {
  recipientPhone: string;
  recipientName: string;
  recipientGender?: string | null;
  relationshipType?: string | null;
  isParent?: boolean;
  studentName: string;
  scheduleTitle: string;
  dayDate: string;
  absenceType: 'IZIN' | 'SAKIT';
  approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
  approverName: string;
  notes?: string | null;
  currentApprovedCount: number;
  totalRequiredApprovals?: number;
  isFullyApproved: boolean;
  organizationName: string;
  requestId: string;
  recipientUserId?: string;
}): Promise<SendMessageResult> {
  const sapaan = params.isParent
    ? `*${formatParentSalutation(params.recipientName, params.recipientGender, params.relationshipType)}* *- Wali dari Ananda ${params.studentName}.*`
    : `*${formatStudentSalutation(params.studentName)}* *- Santri.*`;

  let peranPenyetujuText = 'Pihak Terkait';
  if (params.approverRole === 'PARENT') {
    peranPenyetujuText = 'Orang Tua';
  } else if (params.approverRole === 'HOMEROOM_TEACHER') {
    peranPenyetujuText = 'Wali Kelas';
  } else if (params.approverRole === 'PJ') {
    peranPenyetujuText = 'PJ Wilayah';
  }

  const catatanStr = params.notes ? `\n*• Pesan / Doa* _${params.notes.trim()}_\n` : '';
  const statusText = params.isFullyApproved
    ? 'Disetujui Penuh (Minimal 2 Konfirmasi Tercapai). Status presensi sesi ini otomatis diperbarui menjadi Izin/Sakit.'
    : `Menunggu (${params.currentApprovedCount}/${params.totalRequiredApprovals || 2} Persetujuan).`;

  const jenisIzinText = params.absenceType === 'SAKIT' ? 'Sakit' : 'Izin';

  return whatsAppClient.sendMessage({
    to: params.recipientPhone,
    recipientName: params.recipientName,
    recipientUserId: params.recipientUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'STUDENT_ABSENCE_DECISION_NOTIFICATION',
    message: '',
    templateVariables: {
      sapaan_penerima: sapaan,
      nama_santri: params.studentName,
      judul_sesi: params.scheduleTitle,
      hari_tanggal: params.dayDate,
      jenis_izin: jenisIzinText,
      peran_penyetuju: peranPenyetujuText,
      nama_penyetuju: params.approverName,
      catatan_penyetuju: catatanStr,
      status_persetujuan_text: statusText,
      nama_kelompok: params.organizationName,
    },
    magicToken: `STU_ABS_DECISION_${params.requestId}_${params.approverRole}_${params.recipientUserId}`,
    referenceId: params.requestId,
  });
}

/**
 * 14. Pemicu Pengingat Pengajar: Presensi Belum Dibuka / Diisi Setelah 30 Menit Sesi Dimulai
 */
export async function sendTeacherAttendanceReminder30m(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  scheduleId: string;
  teacherUserId?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const teacherIdForToken = params.teacherUserId || params.scheduleId;
  const directPresensiToken = generateDirectPresensiToken(params.scheduleId, teacherIdForToken);
  const directPresensiUrl = `${baseUrl}/auth/direct?target=presensi&scheduleId=${params.scheduleId}&token=${directPresensiToken}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar Sesi.*`;
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_ATTENDANCE_REMINDER_30M',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle,
      hari_tanggal: 'Hari Ini',
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName,
      url_presensi: directPresensiUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 15. Pemicu Pengingat Pengajar: Jurnal Penilaian Santri Belum Diisi Setelah 30 Menit Sesi Dimulai
 */
export async function sendTeacherJournalReminder30m(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle: string;
  materialTitle: string;
  presentCount: number;
  venueName: string;
  organizationName: string;
  scheduleId: string;
  teacherUserId?: string;
  magicToken?: string;
  scheduleTime?: string;
  startTime?: string;
  endTime?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const teacherIdForToken = params.teacherUserId || params.scheduleId;
  const directPresensiToken = generateDirectPresensiToken(params.scheduleId, teacherIdForToken);
  const directJournalUrl = `${baseUrl}/auth/direct?target=presensi&scheduleId=${params.scheduleId}&tab=evaluation&token=${directPresensiToken}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar Sesi.*`;
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const waktuSesi =
    params.scheduleTime ||
    (params.startTime && params.endTime ? `${params.startTime} - ${params.endTime} WIB` : 'Sesi Ini');

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'TEACHER_JOURNAL_REMINDER_30M',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle,
      hari_tanggal: 'Hari Ini',
      waktu_lengkap: waktuSesi,
      judul_materi: params.materialTitle,
      jumlah_hadir: params.presentCount,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName,
      url_jurnal: directJournalUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

export interface FamilyDigestStudentItem {
  studentId: string;
  studentName: string;
  generationName: string;
  className?: string | null;
  scheduleTitle: string;
  startTime: string;
  endTime: string;
  venueName: string;
  materialTitle: string;
  teacherName: string;
  absenceUrl?: string;
  scheduleUrl?: string;
}

/**
 * 12. Pemicu Pengingat Jadwal H-1 Multi-Santri untuk Orang Tua (Family Schedule Digest)
 */
export async function sendFamilyScheduleReminderH1(params: {
  parentPhone: string;
  parentName: string;
  parentGender?: string | null;
  relationshipType?: string | null;
  dayDate: string;
  organizationName: string;
  students: FamilyDigestStudentItem[];
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  primaryScheduleId: string;
  familyActionUrl?: string;
  magicToken?: string;
  parentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const sapaanOrtu = `*${formatParentSalutation(params.parentName, params.parentGender, params.relationshipType)}* *- Wali Santri ${params.organizationName}.*`;

  const studentListText = params.students
    .map((s, idx) => {
      const classOrGen = s.className ? `${s.className}` : `${s.generationName}`;
      const timeStr = s.endTime ? `${s.startTime} - ${s.endTime} WIB` : `${s.startTime} WIB`;
      const materiBlock = formatFamilyStudentMaterialsBlock(s.materialTitle, '   ');
      return `${idx + 1}. *${s.studentName}* *- ${classOrGen}.*\n   *• Waktu* \`\`\`${timeStr}\`\`\`\n   *• Tempat* _${s.venueName}_\n   *• Materi*${materiBlock}\n   *• Pengajar* _${s.teacherName}_`;
    })
    .join('\n\n');

  const actionUrl =
    params.familyActionUrl ||
    (params.students[0]?.scheduleUrl || `${baseUrl}/jadwal/${params.primaryScheduleId}`);

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_FAMILY_DIGEST',
    message: '',
    templateVariables: {
      sapaan_ortu: sapaanOrtu,
      hari_tanggal: params.dayDate,
      nama_kelompok: params.organizationName,
      daftar_santri_ringkas: studentListText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
    },
    magicToken: params.magicToken,
    referenceId: params.primaryScheduleId,
  });
}

/**
 * 12.1. Pemicu Tautan Aksi Keluarga H-1 (Pesan Terpisah: Konfirmasi Izin / Sakit Ananda)
 */
export async function sendFamilyActionLinkH1(params: {
  parentPhone: string;
  parentName?: string | null;
  parentUserId?: string | null;
  dayDate: string;
  primaryScheduleId: string;
  familyActionUrl?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const actionUrl =
    params.familyActionUrl || `${baseUrl}/jadwal/${params.primaryScheduleId}`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName || 'Wali Santri',
    recipientUserId: params.parentUserId || undefined,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'FAMILY_ACTION_LINK_H1',
    message: '',
    templateVariables: {
      hari_tanggal: params.dayDate,
      url_aksi_keluarga: actionUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.primaryScheduleId,
  });
}

/**
 * 13. Pemicu Pengingat Countdown 2 Jam Multi-Santri untuk Orang Tua
 */
export async function sendFamilyScheduleReminderCountdown(params: {
  parentPhone: string;
  parentName: string;
  parentGender?: string | null;
  relationshipType?: string | null;
  dayDate?: string;
  organizationName?: string;
  students: Array<{
    studentName: string;
    generationName: string;
    className?: string | null;
    scheduleTitle: string;
    startTime: string;
    venueName: string;
    materialTitle: string;
    teacherName: string;
  }>;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  primaryScheduleId: string;
  familyActionUrl?: string;
  magicToken?: string;
  parentUserId?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const sapaanOrtu = `*${formatParentSalutation(params.parentName, params.parentGender, params.relationshipType)}* *- Wali Santri.*`;

  const studentListText = params.students
    .map((s, idx) => {
      const classOrGen = s.className ? `${s.className}` : `${s.generationName}`;
      const materiBlock = formatFamilyStudentMaterialsBlock(s.materialTitle, '   ');
      return `${idx + 1}. *${s.studentName}* *- ${classOrGen}.*\n   *• Waktu* \`\`\`${s.startTime} WIB\`\`\`\n   *• Tempat* _${s.venueName}_\n   *• Materi*${materiBlock}\n   *• Pengajar* _${s.teacherName}_`;
    })
    .join('\n\n');

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName,
    recipientUserId: params.parentUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_FAMILY_COUNTDOWN',
    message: '',
    templateVariables: {
      sapaan_ortu: sapaanOrtu,
      hari_tanggal: params.dayDate || '',
      nama_kelompok: params.organizationName || 'Kelompok',
      daftar_santri_ringkas: studentListText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
    },
    magicToken: params.magicToken,
    referenceId: params.primaryScheduleId,
  });
}

/**
 * 13.1. Pemicu Tautan Aksi Keluarga -2 Jam (Pesan Terpisah: Presensi & Izin/Sakit Ananda)
 */
export async function sendFamilyActionLinks2h(params: {
  parentPhone: string;
  parentName?: string | null;
  parentUserId?: string | null;
  dayDate?: string;
  primaryScheduleId: string;
  familyActionUrl?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const actionUrl =
    params.familyActionUrl || `${baseUrl}/jadwal/${params.primaryScheduleId}`;

  return whatsAppClient.sendMessage({
    to: params.parentPhone,
    recipientName: params.parentName || 'Wali Santri',
    recipientUserId: params.parentUserId || undefined,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'FAMILY_ACTION_LINKS_2H',
    message: '',
    templateVariables: {
      hari_tanggal: params.dayDate || 'Hari Ini',
      url_aksi_keluarga: actionUrl,
    },
    magicToken: params.magicToken,
    referenceId: params.primaryScheduleId,
  });
}

/**
 * 14. Pemicu Pengingat Terpadu untuk Pengajar yang Merangkap Wali Santri
 */
export async function sendUnifiedTeacherParentReminder(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  generationName: string | string[];
  className?: string | string[];
  materialTitle: string;
  isBadal?: boolean;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  scheduleTitle?: string;
  magicToken?: string;
  teacherUserId?: string;
  students: Array<{
    studentName: string;
    generationName: string;
    className?: string | null;
    startTime: string;
    endTime: string;
    venueName: string;
    materialTitle: string;
  }>;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;
  const isBadalText = params.isBadal
    ? `\n*• Status Penugasan* _Guru Badal (Pengganti)_\n`
    : '';

  const studentListText = params.students
    .map((s, idx) => {
      const classOrGen = s.className ? `${s.className}` : `${s.generationName}`;
      const materiBlock = formatFamilyStudentMaterialsBlock(s.materialTitle, '   ');
      return `${idx + 1}. *${s.studentName}* *- ${classOrGen}.*\n   *• Waktu* \`\`\`${s.startTime} - ${s.endTime} WIB\`\`\`\n   *• Tempat* _${s.venueName}_\n   *• Materi*${materiBlock}`;
    })
    .join('\n\n');

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_UNIFIED_TEACHER_PARENT',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      kelas_block: formatScheduleClassBlock(params.className || params.generationName),
      materi_block: formatScheduleMaterialsBlock(params.materialTitle),
      is_badal_text: isBadalText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
      daftar_santri_ringkas: studentListText,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * 15. Pemicu Pengingat Mengajar Disertai Dispensasi Sesi Santri yang Bentrok
 */
export async function sendTeacherWithDispensationReminder(params: {
  teacherPhone: string;
  teacherName: string;
  teacherGender?: string | null;
  scheduleTitle?: string;
  dayDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  generationName: string | string[];
  className?: string | string[];
  materialTitle: string;
  isBadal?: boolean;
  notes?: string | null;
  teacherBroadcastNote?: string | null;
  scheduleId: string;
  magicToken?: string;
  teacherUserId?: string;
  studentScheduleTitle: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${params.scheduleId}`;

  const sapaanUstadz = formatTeacherSalutation(params.teacherName, params.teacherGender);
  const titleUstadz = params.teacherGender === 'FEMALE' ? 'Ustadzah' : 'Ustadz';
  const sapaanUstadzHeader = `*${sapaanUstadz}* *- Pengajar.*`;
  const isBadalText = params.isBadal
    ? `\n*• Status Penugasan* _Guru Badal (Pengganti)_\n`
    : '';

  return whatsAppClient.sendMessage({
    to: params.teacherPhone,
    recipientName: params.teacherName,
    recipientUserId: params.teacherUserId,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'SCHEDULE_REMINDER_TEACHER_WITH_DISPENSATION',
    message: '',
    templateVariables: {
      sapaan_ustadz: sapaanUstadzHeader,
      title_ustadz: titleUstadz,
      judul_sesi: params.scheduleTitle && params.scheduleTitle.trim() ? params.scheduleTitle.trim() : 'Pengajian Rutin',
      hari_tanggal: params.dayDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName || '',
      kelas_block: formatScheduleClassBlock(params.className || params.generationName),
      materi_block: formatScheduleMaterialsBlock(params.materialTitle),
      is_badal_text: isBadalText,
      catatan_tambahan: formatScheduleNotesBlock(params.notes, params.teacherBroadcastNote),
      url_jadwal: scheduleDetailUrl,
      sesi_santri_bentrok: params.studentScheduleTitle,
    },
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
  });
}

/**
 * Pemicu Notifikasi Pengingat Jadwal H-1 ke Grup WhatsApp Jenjang
 */
export async function sendGroupScheduleReminderH1(params: {
  groupId: string;
  groupName?: string | null;
  recipientGreeting?: string;
  generationName?: string;
  scheduleTitle: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  organizationName: string;
  teachersName?: string;
  materialsBlock?: string;
  detailBlock?: string;
  teacherNote?: string | null;
  scheduleId: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const urlJadwal = `${baseUrl}/jadwal/${params.scheduleId}`;

  const catatanTambahan = params.teacherNote?.trim()
    ? `\n\n*Catatan Pengajar:*\n_${params.teacherNote.trim()}_`
    : '';

  const sapaanPenerima =
    params.recipientGreeting ||
    (params.generationName ? `Jenjang *${params.generationName}*` : '');

  return whatsAppClient.sendMessage({
    to: params.groupId,
    recipientName: params.groupName || `Grup ${params.generationName || 'Pengajian'}`,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'GROUP_SCHEDULE_REMINDER_H1',
    message: '',
    magicToken: params.magicToken,
    referenceId: params.scheduleId,
    templateVariables: {
      sapaan_penerima: sapaanPenerima,
      nama_jenjang: params.generationName || '',
      judul_sesi: params.scheduleTitle,
      hari_tanggal: params.scheduleDate,
      waktu_mulai: params.startTime,
      waktu_selesai: params.endTime,
      nama_tempat: params.venueName,
      nama_kelompok: params.organizationName,
      nama_ustadz: params.teachersName || 'Pengajar Terjadwal',
      materi_block: params.materialsBlock || '',
      detail_blok: params.detailBlock ? `\n${params.detailBlock}` : '',
      catatan_tambahan: catatanTambahan,
      url_jadwal: urlJadwal,
    },
  });
}

/**
 * Pemicu Rangkuman Jadwal Pengajian 1 Pekan ke Depan ke Grup WhatsApp Jenjang
 */
export async function sendGroupWeeklyScheduleDigest(params: {
  groupId: string;
  groupName?: string | null;
  recipientGreeting?: string;
  generationName?: string;
  weekPeriodText: string;
  organizationName: string;
  weeklySessionsListText: string;
  referenceId?: string;
  magicToken?: string;
}): Promise<SendMessageResult> {
  const baseUrl = getBaseAppUrl();
  const urlJadwal = `${baseUrl}/jadwal`;

  const sapaanPenerima =
    params.recipientGreeting ||
    (params.generationName ? `Jenjang *${params.generationName}*` : '');

  return whatsAppClient.sendMessage({
    to: params.groupId,
    recipientName: params.groupName || `Grup ${params.generationName || 'Pengajian'}`,
    messageType: 'SCHEDULE_REMINDER',
    templateCode: 'GROUP_WEEKLY_SCHEDULE_DIGEST',
    message: '',
    magicToken: params.magicToken,
    referenceId: params.referenceId || `weekly_${Date.now()}`,
    templateVariables: {
      sapaan_penerima: sapaanPenerima,
      nama_jenjang: params.generationName || '',
      periode_minggu: params.weekPeriodText,
      nama_kelompok: params.organizationName,
      daftar_sesi_pekanan: params.weeklySessionsListText,
      url_jadwal: urlJadwal,
    },
  });
}

