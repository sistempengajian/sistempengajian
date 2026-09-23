'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import {
  ChildDevelopmentReport,
  ChildSelectorItem,
  StudentProfile,
  AttendanceAnalytics,
  AttendanceHeatmapDay,
  AttendanceHeatmapSession,
  AbsenceRecordItem,
  CurriculumMasteryAnalytics,
  CurriculumCategoryMastery,
  ScheduledMaterialOccurrence,
  ScheduledMaterialChecklistItem,
  ScheduledMaterialProgressItem,
  RecentMilestoneItem,
  NeedsAttentionItem,
  CharacterAnalytics,
  CharacterTrendPoint,
  FeedbackTagCount,
  TeacherNoteFeedItem,
  AssignmentAnalytics,
  GamificationSummary,
} from './types';

/**
 * Mengelompokkan materi ke dalam kategori standar berdasarkan kata kunci judul
 */
function categorizeMaterialTitle(title: string): string {
  const lower = title.toLowerCase();
  if (
    lower.includes('surat') ||
    lower.includes('qur') ||
    lower.includes('tajwid') ||
    lower.includes('juz') ||
    lower.includes('makhraj') ||
    lower.includes('tilawah') ||
    lower.includes('tahsin') ||
    lower.includes('tahfidz')
  ) {
    return "Al-Qur'an & Tahfidz";
  }
  if (
    lower.includes('hadits') ||
    lower.includes('hadis') ||
    lower.includes('arbain') ||
    lower.includes('bukhari') ||
    lower.includes('muslim') ||
    lower.includes('sunan')
  ) {
    return 'Hadits & Sunnah';
  }
  if (
    lower.includes('doa') ||
    lower.includes('dzikir') ||
    lower.includes('wirid') ||
    lower.includes('harian')
  ) {
    return 'Doa & Dzikir Harian';
  }
  if (
    lower.includes('fiqih') ||
    lower.includes('sholat') ||
    lower.includes('shalat') ||
    lower.includes('wudhu') ||
    lower.includes('thaharah') ||
    lower.includes('puasa') ||
    lower.includes('zakat') ||
    lower.includes('ibadah')
  ) {
    return 'Fiqih & Ibadah';
  }
  if (
    lower.includes('pegon') ||
    lower.includes('khot') ||
    lower.includes('tulis') ||
    lower.includes('arab') ||
    lower.includes('makna')
  ) {
    return 'Pegon & Literasi';
  }
  if (
    lower.includes('akhlak') ||
    lower.includes('karim') ||
    lower.includes('mandiri') ||
    lower.includes('faqih') ||
    lower.includes('alim') ||
    lower.includes('januari') ||
    lower.includes('februari') ||
    lower.includes('maret') ||
    lower.includes('april') ||
    lower.includes('mei') ||
    lower.includes('juni') ||
    lower.includes('juli') ||
    lower.includes('agustus') ||
    lower.includes('september') ||
    lower.includes('oktober') ||
    lower.includes('november') ||
    lower.includes('desember')
  ) {
    return 'Materi Wajib Bulanan';
  }
  return 'Materi Umum / Karakter';
}

/**
 * Menghitung tanggal rentang waktu (start & end) berdasarkan filter periode
 */
function getPeriodDateRange(period: string): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  if (period === 'THIS_MONTH') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (period === 'LAST_MONTH') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }
  if (period === 'LAST_3_MONTHS') {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (period === 'THIS_SEMESTER') {
    const isSemesterGanjil = now.getMonth() >= 6;
    return {
      startDate: isSemesterGanjil
        ? new Date(now.getFullYear(), 6, 1)
        : new Date(now.getFullYear(), 0, 1),
      endDate: isSemesterGanjil
        ? new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        : new Date(now.getFullYear(), 5, 30, 23, 59, 59, 999),
    };
  }
  return { startDate: null, endDate: null }; // 'ALL'
}

/**
 * Mengambil daftar santri yang dapat diakses oleh user aktif
 */
export async function getAccessibleStudents(
  currentUserId: string,
  preferredRole?: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN'
): Promise<{
  students: ChildSelectorItem[];
  defaultStudentId: string | null;
  userRoleCategory: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
  availableRoles: Array<{
    id: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
    label: string;
    description: string;
  }>;
}> {
  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      roles: true,
      generation: true,
      children: {
        include: {
          student: {
            include: {
              generation: true,
            },
          },
        },
      },
      homeroomClasses: {
        include: {
          generation: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User tidak ditemukan.');
  }

  const roleCodes = user.roles.map((r) => r.role);
  const isParent = roleCodes.includes('ORANG_TUA');
  const isTeacher = roleCodes.includes('WALI_KELAS') || roleCodes.includes('PENGAJAR');
  const isStudent = roleCodes.includes('SANTRI');
  const isAdmin =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  const availableRoles: Array<{
    id: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
    label: string;
    description: string;
  }> = [];

  if (isStudent) {
    availableRoles.push({
      id: 'SANTRI',
      label: 'Santri (Rapor Saya)',
      description: 'Melihat perkembangan dan capaian belajar pribadi',
    });
  }
  if (isParent && user.children.length > 0) {
    availableRoles.push({
      id: 'ORANG_TUA',
      label: 'Orang Tua (Rapor Anak)',
      description: 'Melihat rapor perkembangan ananda',
    });
  }
  if (isTeacher && user.homeroomClasses.length > 0) {
    availableRoles.push({
      id: 'PENGAJAR',
      label: 'Wali Kelas / Pengajar',
      description: 'Melihat rapor santri di kelas binaan',
    });
  }
  if (isAdmin && user.organizationId) {
    availableRoles.push({
      id: 'ADMIN',
      label: 'Pengurus / Admin',
      description: 'Melihat rekap rapor santri di kelompok binaan',
    });
  }

  // Tentukan role yang aktif: gunakan preferredRole jika valid
  let effectiveRole: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
  if (preferredRole && availableRoles.some((r) => r.id === preferredRole)) {
    effectiveRole = preferredRole;
  } else if (isStudent && !isParent && !isTeacher) {
    effectiveRole = 'SANTRI';
  } else if (availableRoles.length > 0) {
    effectiveRole = availableRoles[0].id;
  } else if (isStudent) {
    effectiveRole = 'SANTRI';
  } else {
    effectiveRole = 'ORANG_TUA';
  }

  let resultStudents: ChildSelectorItem[] = [];
  const userRoleCategory: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN' = effectiveRole;

  if (effectiveRole === 'SANTRI') {
    const sClass = await prisma.class.findFirst({
      where: {
        organizationId: user.organizationId || undefined,
        generationId: user.generationId || undefined,
      },
      select: { name: true },
    });
    resultStudents.push({
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      generationName: user.generation?.name || 'Santri',
      className: sClass?.name || null,
    });
  } else if (effectiveRole === 'ORANG_TUA' && user.children.length > 0) {
    for (const rel of user.children) {
      const s = rel.student;
      const childClass = await prisma.class.findFirst({
        where: {
          organizationId: s.organizationId || undefined,
          generationId: s.generationId || undefined,
        },
        select: { name: true },
      });

      resultStudents.push({
        id: s.id,
        fullName: s.fullName,
        avatarUrl: s.avatarUrl,
        generationName: s.generation?.name || 'Santri',
        className: childClass?.name || null,
      });
    }
  } else if (effectiveRole === 'PENGAJAR' && user.homeroomClasses.length > 0) {
    const orgIds = user.homeroomClasses.map((c) => c.organizationId);
    const genIds = user.homeroomClasses.map((c) => c.generationId);

    const students = await prisma.user.findMany({
      where: {
        organizationId: { in: orgIds },
        generationId: { in: genIds },
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
      },
      include: {
        generation: true,
      },
      orderBy: { fullName: 'asc' },
      take: 60,
    });

    for (const s of students) {
      const cls = user.homeroomClasses.find(
        (c) => c.organizationId === s.organizationId && c.generationId === s.generationId
      );
      resultStudents.push({
        id: s.id,
        fullName: s.fullName,
        avatarUrl: s.avatarUrl,
        generationName: s.generation?.name || 'Santri',
        className: cls?.name || null,
      });
    }
  } else if (effectiveRole === 'ADMIN' && user.organizationId) {
    const students = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
      },
      include: {
        generation: true,
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    });

    for (const s of students) {
      const cls = await prisma.class.findFirst({
        where: {
          organizationId: s.organizationId || undefined,
          generationId: s.generationId || undefined,
        },
        select: { name: true },
      });
      resultStudents.push({
        id: s.id,
        fullName: s.fullName,
        avatarUrl: s.avatarUrl,
        generationName: s.generation?.name || 'Santri',
        className: cls?.name || null,
      });
    }
  }

  return {
    students: resultStudents,
    defaultStudentId: resultStudents[0]?.id || null,
    userRoleCategory,
    availableRoles,
  };
}

/**
 * Mengambil laporan perkembangan anak lengkap
 */
export async function getChildDevelopmentReport(
  studentId: string,
  period: string = 'THIS_MONTH'
): Promise<ChildDevelopmentReport> {
  const { startDate, endDate } = getPeriodDateRange(period);

  // 1. Ambil data profil santri
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      organization: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
      generation: true,
      gamification: true,
      badges: {
        include: { badge: true },
        orderBy: { unlockedAt: 'desc' },
      },
    },
  });

  if (!student) {
    throw new Error('Data santri tidak ditemukan.');
  }

  // 2. Ambil data kelas & wali kelas
  const studentClass = await prisma.class.findFirst({
    where: {
      organizationId: student.organizationId || undefined,
      generationId: student.generationId || undefined,
    },
    include: {
      homeroomTeacher: true,
    },
  });

  const studentProfile: StudentProfile = {
    id: student.id,
    fullName: student.fullName,
    avatarUrl: student.avatarUrl,
    gender: student.gender,
    organizationName: student.organization?.name || 'Lembaga Pengajian',
    generationName: student.generation?.name || 'Caberawit',
    generationColor: student.generation?.color || '#0d9488',
    className: studentClass?.name || null,
    homeroomTeacher: studentClass?.homeroomTeacher
      ? {
        id: studentClass.homeroomTeacher.id,
        fullName: studentClass.homeroomTeacher.fullName,
        phoneNumber: studentClass.homeroomTeacher.phoneNumber,
      }
      : null,
  };

  // 3. Rekap Presensi & Kehadiran
  const now = new Date();
  const scheduleConditions: any[] = [
    { status: { not: 'CANCELLED' } },
    {
      OR: [
        { status: { in: ['COMPLETED', 'ACTIVE'] } },
        { startTime: { lte: now } },
      ],
    },
  ];
  if (startDate) {
    scheduleConditions.push({ startTime: { gte: startDate } });
  }
  if (endDate) {
    scheduleConditions.push({ startTime: { lte: endDate } });
  }

  const attendanceWhere: any = {
    studentId,
    session: {
      schedule: {
        AND: scheduleConditions,
      },
    },
  };

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: attendanceWhere,
    include: {
      session: {
        include: {
          schedule: {
            select: { id: true, title: true, startTime: true, status: true },
          },
        },
      },
      absenceConfirmation: {
        select: { parentNotes: true, status: true },
      },
    },
    orderBy: {
      session: {
        schedule: {
          startTime: 'asc',
        },
      },
    },
  });

  let onTime = 0;
  let late = 0;
  let permission = 0;
  let sick = 0;
  let absent = 0;

  const heatmapDaysMap: Record<string, AttendanceHeatmapDay> = {};
  const absenceHistory: AbsenceRecordItem[] = [];
  const checkInMinutes: number[] = [];

  for (const rec of attendanceRecords) {
    const rawDate = rec.session?.schedule?.startTime || rec.createdAt;
    const dateObj = new Date(rawDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const sessionTitle = rec.session?.schedule?.title || 'Pengajian Rutin';

    if (rec.status === 'HADIR') onTime++;
    else if (rec.status === 'TERLAMBAT') late++;
    else if (rec.status === 'IZIN') permission++;
    else if (rec.status === 'SAKIT') sick++;
    else if (rec.status === 'ALPA') absent++;

    if (rec.checkInTime) {
      const d = new Date(rec.checkInTime);
      checkInMinutes.push(d.getHours() * 60 + d.getMinutes());
    }

    const sessionItem: AttendanceHeatmapSession = {
      id: rec.id,
      sessionTitle,
      status: rec.status,
      checkInTime: rec.checkInTime
        ? new Date(rec.checkInTime).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
      method: rec.method,
    };

    if (!heatmapDaysMap[dateStr]) {
      heatmapDaysMap[dateStr] = {
        date: dateStr,
        status: rec.status,
        sessionTitle,
        checkInTime: sessionItem.checkInTime,
        method: rec.method,
        sessions: [sessionItem],
      };
    } else {
      const existing = heatmapDaysMap[dateStr];
      existing.sessions = existing.sessions || [];
      existing.sessions.push(sessionItem);

      // Prioritas status kalender: HADIR > TERLAMBAT > IZIN > SAKIT > ALPA
      const statusPriority: Record<string, number> = {
        HADIR: 5,
        TERLAMBAT: 4,
        IZIN: 3,
        SAKIT: 2,
        ALPA: 1,
      };
      if ((statusPriority[rec.status] || 0) > (statusPriority[existing.status] || 0)) {
        existing.status = rec.status;
      }
      existing.sessionTitle = `${existing.sessions.length} Sesi (${existing.sessions.map((s) => s.sessionTitle).join(', ')})`;
    }

    if (rec.status === 'IZIN' || rec.status === 'SAKIT' || rec.status === 'ALPA') {
      absenceHistory.push({
        id: rec.id,
        date: dateStr,
        status: rec.status,
        sessionTitle,
        reason: rec.absenceConfirmation?.parentNotes || rec.notes || null,
      });
    }
  }

  const totalSessions = onTime + late + permission + sick + absent;
  const attended = onTime + late;
  const attendancePercentage =
    totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  let averageCheckInTime: string | null = null;
  if (checkInMinutes.length > 0) {
    const avgMin = Math.round(
      checkInMinutes.reduce((a, b) => a + b, 0) / checkInMinutes.length
    );
    const h = String(Math.floor(avgMin / 60)).padStart(2, '0');
    const m = String(avgMin % 60).padStart(2, '0');
    averageCheckInTime = `${h}:${m} WIB`;
  }

  let currentStreak = 0;
  const sortedDates = Object.keys(heatmapDaysMap).sort().reverse();
  for (const d of sortedDates) {
    const status = heatmapDaysMap[d].status;
    if (status === 'HADIR' || status === 'TERLAMBAT') {
      currentStreak++;
    } else {
      break;
    }
  }

  const attendanceAnalytics: AttendanceAnalytics = {
    totalSessions,
    attended,
    onTime,
    late,
    permission,
    sick,
    absent,
    percentage: attendancePercentage,
    currentStreak,
    bestStreak: Math.max(currentStreak, student.gamification?.highestStreakDays || 0),
    averageCheckInTime,
    heatmapDays: Object.values(heatmapDaysMap),
    absenceHistory: absenceHistory.reverse(),
  };

  // 4. Penguasaan Materi & Capaian Kurikulum
  // Ambil progres checklist santri (difilter berdasarkan rentang waktu jika ada)
  const progressWhere: any = { studentId };
  if (startDate || endDate) {
    progressWhere.evaluatedAt = {};
    if (startDate) progressWhere.evaluatedAt.gte = startDate;
    if (endDate) progressWhere.evaluatedAt.lte = endDate;
  }

  const studentProgress = await prisma.materialChecklistProgress.findMany({
    where: progressWhere,
    include: {
      checklistItem: {
        include: {
          material: {
            select: { id: true, title: true, description: true },
          },
        },
      },
    },
    orderBy: { evaluatedAt: 'desc' },
  });

  const completedChecklistIds = new Set(
    studentProgress.filter((p) => p.isCompleted).map((p) => p.checklistItemId)
  );

  // Ambil kelas yang terasosiasi dengan santri
  const matchingClasses = await prisma.class.findMany({
    where: {
      OR: [
        {
          generationId: student.generationId || undefined,
          organizationId: student.organizationId || undefined,
        },
        ...(studentClass?.id ? [{ id: studentClass.id }] : []),
      ],
    },
    select: { id: true },
  });
  const studentClassIds = matchingClasses.map((c) => c.id);

  // Query jadwal santri yang sesuai dengan periode terpilih
  const scheduleWhere: any = {
    AND: [
      { OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }] },
      {
        OR: [
          ...(studentClassIds.length > 0
            ? [
              { classId: { in: studentClassIds } },
              { targetClasses: { some: { classId: { in: studentClassIds } } } },
            ]
            : []),
          ...(student.generationId
            ? [{ targetGenerations: { some: { generationId: student.generationId } } }]
            : []),
          {
            classId: null,
            targetClasses: { none: {} },
            targetGenerations: { none: {} },
            organizationId: {
              in: [
                student.organizationId,
                student.organization?.parentId,
                student.organization?.parent?.parentId,
              ].filter(Boolean) as string[],
            },
          },
        ],
      },
    ],
  };

  if (startDate) {
    scheduleWhere.AND.push({ startTime: { gte: startDate } });
  }
  if (endDate) {
    scheduleWhere.AND.push({ startTime: { lte: endDate } });
  }

  const relevantSchedules = await prisma.schedule.findMany({
    where: scheduleWhere,
    include: {
      scheduleMaterials: {
        include: {
          material: {
            include: {
              checklistItems: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  // Agregasi materi yang terdaftar di jadwal santri
  const scheduledMaterialsMap = new Map<
    string,
    {
      material: any;
      occurrences: ScheduledMaterialOccurrence[];
    }
  >();

  for (const sch of relevantSchedules) {
    const formattedDate = new Date(sch.startTime).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime =
      new Date(sch.startTime).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';

    for (const sm of sch.scheduleMaterials) {
      if (!sm.material || !sm.material.isActive) continue;
      const existing = scheduledMaterialsMap.get(sm.material.id);
      const occ: ScheduledMaterialOccurrence = {
        scheduleId: sch.id,
        scheduleTitle: sch.title,
        date: formattedDate,
        time: formattedTime,
      };

      if (existing) {
        existing.occurrences.push(occ);
      } else {
        scheduledMaterialsMap.set(sm.material.id, {
          material: sm.material,
          occurrences: [occ],
        });
      }
    }
  }

  // Jika belum ada jadwal yang memiliki scheduleMaterials pada periode ini, fallback ke materi jenjang santri
  if (scheduledMaterialsMap.size === 0 && student.generationId) {
    const fallbackMaterials = await prisma.material.findMany({
      where: {
        targetGenerationId: student.generationId,
        isActive: true,
      },
      include: {
        checklistItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { title: 'asc' },
    });

    for (const mat of fallbackMaterials) {
      scheduledMaterialsMap.set(mat.id, {
        material: mat,
        occurrences: [],
      });
    }
  }

  // Bangun ScheduledMaterialProgressItem
  const allMaterialItems: ScheduledMaterialProgressItem[] = [];
  for (const [matId, entry] of scheduledMaterialsMap.entries()) {
    const { material, occurrences } = entry;
    const catName = categorizeMaterialTitle(material.title);

    let completedCount = 0;
    const mappedChecklistItems: ScheduledMaterialChecklistItem[] = (
      material.checklistItems || []
    ).map((item: any) => {
      const prog = studentProgress.find((p) => p.checklistItemId === item.id);
      const isCompleted = prog?.isCompleted || completedChecklistIds.has(item.id);
      if (isCompleted) completedCount++;

      return {
        id: item.id,
        itemTitle: item.itemTitle,
        targetType: item.pointsWeight >= 20 ? 'Target Utama' : 'Sub-Capaian',
        isCompleted,
        score: prog?.score || null,
        pointsWeight: item.pointsWeight || 10,
      };
    });

    const totalItems = mappedChecklistItems.length;
    const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    allMaterialItems.push({
      id: matId,
      title: material.title,
      category: catName,
      description: material.description,
      totalItems,
      completedItems: completedCount,
      percentage,
      isScheduledInPeriod: occurrences.length > 0,
      schedules: occurrences,
      checklistItems: mappedChecklistItems,
    });
  }

  // Kelompokkan materi ke dalam kategori Bidang Studi
  const categoryMap = new Map<
    string,
    { total: number; completed: number; materials: ScheduledMaterialProgressItem[] }
  >();

  for (const matItem of allMaterialItems) {
    const catName = matItem.category;
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { total: 0, completed: 0, materials: [] });
    }
    const cat = categoryMap.get(catName)!;
    cat.total += matItem.totalItems;
    cat.completed += matItem.completedItems;
    cat.materials.push(matItem);
  }

  const categories: CurriculumCategoryMastery[] = Array.from(categoryMap.entries()).map(
    ([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      materials: data.materials,
    })
  );

  let totalChecklistItems = 0;
  let completedItems = 0;
  for (const cat of categories) {
    totalChecklistItems += cat.total;
    completedItems += cat.completed;
  }
  const masteryPercentage =
    totalChecklistItems > 0
      ? Math.round((completedItems / totalChecklistItems) * 100)
      : 0;

  // Milestone tuntas terbaru (maksimal 6)
  const recentMilestones: RecentMilestoneItem[] = studentProgress
    .filter((p) => p.isCompleted)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      materialTitle: p.checklistItem.material.title,
      itemTitle: p.checklistItem.itemTitle,
      targetType: p.checklistItem.pointsWeight >= 20 ? 'Target Utama' : 'Sub-Capaian',
      score: p.score,
      evaluatedAt: new Date(p.evaluatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      pointsWeight: p.checklistItem.pointsWeight,
    }));

  // Materi yang memerlukan perhatian / pendampingan di rumah (yang memiliki catatan umpan balik)
  const needsAttentionItems: NeedsAttentionItem[] = studentProgress
    .filter((p) => p.teacherFeedback && p.teacherFeedback.trim() !== '')
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      materialTitle: p.checklistItem.material.title,
      itemTitle: p.checklistItem.itemTitle,
      teacherFeedback: p.teacherFeedback || '',
      score: p.score,
      evaluatedAt: new Date(p.evaluatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    }));

  const curriculumAnalytics: CurriculumMasteryAnalytics = {
    totalChecklistItems,
    completedItems,
    masteryPercentage,
    categories,
    recentMilestones,
    needsAttentionItems,
  };

  // 5. Evaluasi Karakter & Adab Sesi
  const evalScheduleConditions: any[] = [{ status: { not: 'CANCELLED' } }];
  if (startDate) evalScheduleConditions.push({ startTime: { gte: startDate } });
  if (endDate) evalScheduleConditions.push({ startTime: { lte: endDate } });

  const evaluationWhere: any = {
    studentId,
    schedule: {
      AND: evalScheduleConditions,
    },
  };

  const evaluations = await prisma.studentEvaluation.findMany({
    where: evaluationWhere,
    include: {
      schedule: {
        include: {
          teachers: {
            where: { isPrimary: true },
            include: { teacher: { select: { fullName: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let totalAdab = 0;
  let totalKeaktifan = 0;
  const trendHistory: CharacterTrendPoint[] = [];
  const tagCounts: Record<string, number> = {};
  const teacherNotesFeed: TeacherNoteFeedItem[] = [];

  for (const ev of evaluations) {
    totalAdab += ev.adabScore;
    totalKeaktifan += ev.keaktifanScore;

    const dateStr = new Date(ev.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
    const sessionTitle = ev.schedule?.title || 'Pengajian Rutin';

    trendHistory.push({
      date: dateStr,
      sessionTitle,
      adabScore: ev.adabScore,
      keaktifanScore: ev.keaktifanScore,
    });

    // Ekstrak tag dan catatan guru dari teacherPrivateNote
    if (ev.teacherPrivateNote && ev.teacherPrivateNote.trim() !== '') {
      let rawNote = ev.teacherPrivateNote;
      const tags: string[] = [];

      const tagMatch = rawNote.match(/\[Tags:\s*([^\]]+)\]/);
      if (tagMatch && tagMatch[1]) {
        const parsed = tagMatch[1].split(',').map((t) => t.trim());
        tags.push(...parsed);
        parsed.forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
        rawNote = rawNote.replace(/\[Tags:\s*[^\]]+\]/, '').trim();
      }

      teacherNotesFeed.push({
        id: ev.id,
        date: new Date(ev.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        sessionTitle,
        teacherName:
          ev.schedule?.teachers[0]?.teacher?.fullName || 'Ustadz / Pembina',
        note: rawNote || 'Santri mengikuti pengajian dengan baik dan tertib.',
        tags,
      });
    }
  }

  const evaluatedSessionsCount = evaluations.length;
  const averageAdab =
    evaluatedSessionsCount > 0 ? Math.round(totalAdab / evaluatedSessionsCount) : 85;
  const averageKeaktifan =
    evaluatedSessionsCount > 0
      ? Math.round(totalKeaktifan / evaluatedSessionsCount)
      : 85;

  const feedbackTags: FeedbackTagCount[] = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const characterAnalytics: CharacterAnalytics = {
    averageAdab,
    averageKeaktifan,
    evaluatedSessionsCount,
    trendHistory,
    feedbackTags,
    teacherNotesFeed: teacherNotesFeed.reverse(),
  };

  // 6. Portofolio Tugas Mandiri & Paraf Orang Tua
  const studentOrgIds = [
    student.organizationId,
    student.organization?.parentId,
  ].filter(Boolean) as string[];

  const assignmentsWhere: any = {
    organizationId: { in: studentOrgIds },
  };
  if (startDate || endDate) {
    assignmentsWhere.createdAt = {};
    if (startDate) assignmentsWhere.createdAt.gte = startDate;
    if (endDate) assignmentsWhere.createdAt.lte = endDate;
  }

  const rawAssignments = await prisma.assignment.findMany({
    where: assignmentsWhere,
    include: {
      submissions: {
        where: { studentId },
        include: {
          parentVerification: true,
        },
        take: 1,
      },
    },
  });

  const totalAssignments = rawAssignments.length;
  let completedAssignments = 0;
  let verifiedByParentCount = 0;

  for (const a of rawAssignments) {
    const sub = a.submissions[0];
    if (sub && (sub.status === 'GRADED' || sub.status === 'SUBMITTED')) {
      completedAssignments++;
    }
    if (sub?.parentVerification?.isVerifiedByParent) {
      verifiedByParentCount++;
    }
  }

  const assignmentAnalytics: AssignmentAnalytics = {
    totalAssignments,
    completedAssignments,
    verifiedByParentCount,
    percentage:
      totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 100,
  };

  // 7. Gamifikasi & Lencana Prestasi
  const gamificationSummary: GamificationSummary = {
    points: student.gamification?.totalPoints || 0,
    level: student.gamification?.level || 1,
    badges: student.badges.map((b) => ({
      id: b.badge.id,
      name: b.badge.name,
      description: b.badge.criteriaDescription,
      iconName: b.badge.iconName,
      earnedAt: new Date(b.unlockedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    })),
  };

  return {
    student: studentProfile,
    period,
    attendance: attendanceAnalytics,
    curriculum: curriculumAnalytics,
    character: characterAnalytics,
    assignments: assignmentAnalytics,
    gamification: gamificationSummary,
  };
}
