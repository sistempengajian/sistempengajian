'use server';

import prisma from '@/lib/prisma';
import {
  AnalyticsScopeType,
  AnalyticsPeriod,
  AnalyticsFilterOptions,
  AnalyticsDashboardData,
  AnalyticsSummaryKPI,
  AttendanceTrendItem,
  CurriculumCategoryMastery,
  CharacterDimensionScore,
  BenchmarkComparisonItem,
  PerformerStudentItem,
  StudentSelectorItem,
  ScopeFilterOption,
  ParentEngagementSummary,
  ParentVerificationItem,
} from './types';
import { classifyCurriculumCategory } from '@/lib/curriculumClassification';
import { parseAssignmentConfig } from '@/lib/assignmentConfig';

// Helper: Cek apakah sebuah tugas benar-benar ditujukan untuk santri tertentu
function isAssignmentForStudent(
  assignment: {
    id: string;
    organizationId: string;
    classId?: string | null;
    materialId?: string | null;
    attachmentUrl?: string | null;
    class?: { id: string; generationId?: string | null } | null;
    material?: { id: string; targetGenerationId?: string | null } | null;
    submissions: { studentId: string; status: string; parentVerification?: any }[];
  },
  student: {
    id: string;
    organizationId?: string | null;
    generationId?: string | null;
  }
): boolean {
  // 1. Jika santri sudah memiliki submission di tugas ini
  if (assignment.submissions.some((sub) => sub.studentId === student.id)) {
    return true;
  }

  const config = parseAssignmentConfig(assignment.attachmentUrl);

  // 2. Sasaran spesifik santri
  if (config.targetStudentIds && config.targetStudentIds.length > 0) {
    return config.targetStudentIds.includes(student.id);
  }

  // 3. Sasaran spesifik jenjang/generasi di config
  if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
    if (!student.generationId) return false;
    return config.targetGenerationIds.includes(student.generationId);
  }

  // 4. Sasaran jenjang dari class tugas
  if (assignment.class?.generationId) {
    if (!student.generationId) return false;
    return assignment.class.generationId === student.generationId;
  }

  // 5. Sasaran jenjang dari material tugas
  if (assignment.material?.targetGenerationId) {
    if (!student.generationId) return false;
    return assignment.material.targetGenerationId === student.generationId;
  }

  // 6. Jika tugas bersifat umum organisasi tanpa pembatasan jenjang
  if (
    !assignment.classId &&
    !assignment.materialId &&
    !config.targetGenerationIds?.length &&
    !config.targetStudentIds?.length
  ) {
    if (assignment.organizationId && student.organizationId) {
      return assignment.organizationId === student.organizationId;
    }
    return true;
  }

  return false;
}


// Helper: Hitung batas tanggal berdasarkan periode
function getPeriodDateRange(period: AnalyticsPeriod): {
  startDate: Date | undefined;
  endDate: Date | undefined;
  periodLabel: string;
  dateRangeLabel: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  if (period === 'THIS_MONTH') {
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return {
      startDate,
      endDate,
      periodLabel: 'Bulan Ini',
      dateRangeLabel: monthName,
    };
  }

  if (period === 'LAST_MONTH') {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const lastMonthDate = new Date(year, month - 1, 1);
    const monthName = lastMonthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return {
      startDate,
      endDate,
      periodLabel: 'Bulan Lalu',
      dateRangeLabel: monthName,
    };
  }

  if (period === 'THIS_SEMESTER') {
    // Semester Ganjil: Juli - Des (6-11), Genap: Jan - Jun (0-5)
    const isGenap = month < 6;
    const startMonth = isGenap ? 0 : 6;
    const endMonth = isGenap ? 5 : 11;
    const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    const semName = isGenap
      ? `Semester Genap ${year}`
      : `Semester Ganjil ${year}/${year + 1}`;
    return {
      startDate,
      endDate,
      periodLabel: 'Semester Ini',
      dateRangeLabel: semName,
    };
  }

  // ALL (1 Tahun terakhir)
  const startDate = new Date(year - 1, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    startDate,
    endDate,
    periodLabel: 'Semua Periode',
    dateRangeLabel: '1 Tahun Terakhir',
  };
}

// 1. Ambil opsi filter sesuai hak akses user (RBAC)
export async function getAnalyticsFilterOptions(
  userId: string
): Promise<AnalyticsFilterOptions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      organization: {
        include: {
          parent: {
            include: { parent: true },
          },
          children: true,
        },
      },
      homeroomClasses: true,
    },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const roleCodes = user.roles.map((r) => r.role);
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isWaliKelas = roleCodes.includes('WALI_KELAS');
  const isPengajar = roleCodes.includes('PENGAJAR');

  if (!isAdmin && !isPjDaerah && !isPjDesa && !isPjKelompok && !isWaliKelas && !isPengajar) {
    throw new Error('Anda tidak memiliki wewenang mengakses modul analitika.');
  }

  // Tentukan cakupan skop yang diizinkan
  let allowedScopeTypes: AnalyticsScopeType[] = [];
  if (isAdmin || isPjDaerah) {
    allowedScopeTypes = ['DAERAH', 'DESA', 'KELOMPOK', 'GENERATION', 'CLASS', 'CUSTOM'];
  } else if (isPjDesa) {
    allowedScopeTypes = ['DESA', 'KELOMPOK', 'GENERATION', 'CLASS', 'CUSTOM'];
  } else if (isPjKelompok) {
    allowedScopeTypes = ['KELOMPOK', 'GENERATION', 'CLASS', 'CUSTOM'];
  } else {
    allowedScopeTypes = ['CLASS', 'GENERATION', 'CUSTOM'];
  }

  // Ambil organisasi dalam skop user
  let allowedOrgIds: string[] = [];
  if (isAdmin || isPjDaerah) {
    const allOrgs = await prisma.organization.findMany({ select: { id: true } });
    allowedOrgIds = allOrgs.map((o) => o.id);
  } else if (isPjDesa && user.organizationId) {
    // Desa user + seluruh kelompok binaannya
    const childKelompoks = await prisma.organization.findMany({
      where: { parentId: user.organizationId },
      select: { id: true },
    });
    allowedOrgIds = [user.organizationId, ...childKelompoks.map((k) => k.id)];
  } else if (isPjKelompok && user.organizationId) {
    allowedOrgIds = [user.organizationId];
  } else {
    // Wali Kelas / Guru: dari kelas binaan
    if (user.homeroomClasses.length > 0) {
      allowedOrgIds = Array.from(new Set(user.homeroomClasses.map((c) => c.organizationId)));
    } else if (user.organizationId) {
      allowedOrgIds = [user.organizationId];
    }
  }

  // Fetch daftar organisasi terstruktur
  const [allOrgsRaw, generationsRaw, classesRaw] = await Promise.all([
    prisma.organization.findMany({
      where: allowedOrgIds.length > 0 ? { id: { in: allowedOrgIds } } : {},
      orderBy: { name: 'asc' },
    }),
    prisma.generation.findMany({
      orderBy: { minAge: 'asc' },
    }),
    prisma.class.findMany({
      where: {
        ...(allowedOrgIds.length > 0 ? { organizationId: { in: allowedOrgIds } } : {}),
        ...(isWaliKelas && !isAdmin && !isPjDaerah && !isPjDesa && !isPjKelompok
          ? { homeroomTeacherId: userId }
          : {}),
      },
      include: {
        organization: true,
        generation: true,
      },
      orderBy: [{ generation: { minAge: 'asc' } }, { name: 'asc' }],
    }),
  ]);

  const daerahs: ScopeFilterOption[] = allOrgsRaw
    .filter((o) => o.type === 'DAERAH')
    .map((o) => ({ id: o.id, name: o.name, type: 'DAERAH', subtitle: 'Tingkat Daerah' }));

  const desas: ScopeFilterOption[] = allOrgsRaw
    .filter((o) => o.type === 'DESA')
    .map((o) => ({ id: o.id, name: o.name, type: 'DESA', subtitle: 'Tingkat Desa' }));

  const kelompoks: ScopeFilterOption[] = allOrgsRaw
    .filter((o) => o.type === 'KELOMPOK')
    .map((o) => ({ id: o.id, name: o.name, type: 'KELOMPOK', subtitle: 'Tingkat Kelompok' }));

  const generations: ScopeFilterOption[] = generationsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    type: 'GENERATION',
    subtitle: `Usia ${g.minAge}-${g.maxAge} tahun`,
  }));

  const classes: ScopeFilterOption[] = classesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    type: 'CLASS',
    subtitle: `${c.generation.name} - ${c.organization.name}`,
  }));

  // Fetch santri dalam cakupan untuk pemilih multi-siswa kustom
  const studentsRaw = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      roles: { some: { role: 'SANTRI' } },
      ...(allowedOrgIds.length > 0 ? { organizationId: { in: allowedOrgIds } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      gender: true,
      organization: { select: { name: true } },
      generation: { select: { name: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  const availableStudents: StudentSelectorItem[] = studentsRaw.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    gender: s.gender,
    className: s.generation?.name || 'Santri',
    generationName: s.generation?.name || '-',
    organizationName: s.organization?.name || '-',
  }));

  // Tentukan default scope
  let defaultScope: { type: AnalyticsScopeType; id: string; name: string } = {
    type: 'CLASS',
    id: classes[0]?.id || '',
    name: classes[0]?.name || 'Kelas Binaan',
  };

  if (isPjDaerah && daerahs.length > 0) {
    defaultScope = { type: 'DAERAH', id: daerahs[0].id, name: daerahs[0].name };
  } else if (isPjDesa && desas.length > 0) {
    defaultScope = { type: 'DESA', id: desas[0].id, name: desas[0].name };
  } else if (isPjKelompok && kelompoks.length > 0) {
    defaultScope = { type: 'KELOMPOK', id: kelompoks[0].id, name: kelompoks[0].name };
  } else if (classes.length > 0) {
    defaultScope = { type: 'CLASS', id: classes[0].id, name: classes[0].name };
  } else if (generations.length > 0) {
    defaultScope = { type: 'GENERATION', id: generations[0].id, name: generations[0].name };
  }

  return {
    allowedScopeTypes,
    classes,
    generations,
    kelompoks,
    desas,
    daerahs,
    availableStudents,
    defaultScope,
  };
}

// 2. Ambil data analitika & visualisasi lengkap (Query Agregasi Paralel)
export async function getAnalyticsDashboardData(
  userId: string,
  params: {
    scopeType: AnalyticsScopeType;
    scopeId?: string;
    period: AnalyticsPeriod;
    customStudentIds?: string[];
  }
): Promise<AnalyticsDashboardData> {
  const { scopeType, scopeId, period, customStudentIds } = params;
  const { startDate, endDate, periodLabel, dateRangeLabel } = getPeriodDateRange(period);

  // 1. Tentukan daftar student IDs dalam cakupan
  let targetStudentIds: string[] = [];
  let scopeTitle = '';
  let scopeSubtitle = '';

  if (scopeType === 'CUSTOM' && customStudentIds && customStudentIds.length > 0) {
    targetStudentIds = customStudentIds;
    if (customStudentIds.length === 1) {
      const singleStudent = await prisma.user.findUnique({
        where: { id: customStudentIds[0] },
        select: {
          fullName: true,
          generation: { select: { name: true } },
          organization: { select: { name: true } },
        },
      });
      scopeTitle = singleStudent?.fullName || 'Santri Pilihan';
      scopeSubtitle = `${singleStudent?.generation?.name || 'Santri'} • ${singleStudent?.organization?.name || 'Lembaga'}`;
    } else {
      scopeTitle = `${customStudentIds.length} Santri Pilihan`;
      scopeSubtitle = 'Analisis Perbandingan Santri Terpilih';
    }
  } else if (scopeType === 'CLASS' && scopeId) {
    const cls = await prisma.class.findUnique({
      where: { id: scopeId },
      include: { organization: true, generation: true },
    });
    if (cls) {
      scopeTitle = cls.name;
      scopeSubtitle = `${cls.generation.name} • ${cls.organization.name}`;
      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          organizationId: cls.organizationId,
          generationId: cls.generationId,
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  } else if (scopeType === 'GENERATION' && scopeId) {
    const gen = await prisma.generation.findUnique({ where: { id: scopeId } });
    if (gen) {
      scopeTitle = `Jenjang ${gen.name}`;
      scopeSubtitle = `Rentang Usia ${gen.minAge}-${gen.maxAge} tahun`;
      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          generationId: gen.id,
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  } else if (scopeType === 'KELOMPOK' && scopeId) {
    const org = await prisma.organization.findUnique({ where: { id: scopeId } });
    if (org) {
      scopeTitle = `Kelompok ${org.name}`;
      scopeSubtitle = 'Seluruh Santri Kelompok Binaan';
      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          organizationId: org.id,
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  } else if (scopeType === 'DESA' && scopeId) {
    const desa = await prisma.organization.findUnique({
      where: { id: scopeId },
      include: { children: true },
    });
    if (desa) {
      scopeTitle = `Desa ${desa.name}`;
      scopeSubtitle = `Agregat Desa (${desa.children.length} Kelompok)`;
      const orgIds = [desa.id, ...desa.children.map((c) => c.id)];
      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          organizationId: { in: orgIds },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  } else if (scopeType === 'DAERAH' && scopeId) {
    const daerah = await prisma.organization.findUnique({
      where: { id: scopeId },
      include: {
        children: {
          include: { children: true },
        },
      },
    });
    if (daerah) {
      scopeTitle = `Daerah ${daerah.name}`;
      scopeSubtitle = 'Agregat Seluruh Desa & Kelompok Daerah';
      const desaIds = daerah.children.map((d) => d.id);
      const kelompokIds = daerah.children.flatMap((d) => d.children.map((k) => k.id));
      const orgIds = [daerah.id, ...desaIds, ...kelompokIds];
      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          organizationId: { in: orgIds },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  }

  // Kategori baku kurikulum
  const standardCategories = [
    { key: "Al-Qur'an & Tahfidz", color: '#10B981' },
    { key: 'Hadits & Sunnah', color: '#3B82F6' },
    { key: 'Doa & Dzikir Harian', color: '#F59E0B' },
    { key: 'Fiqih & Ibadah', color: '#8B5CF6' },
    { key: 'Pegon & Literasi', color: '#EC4899' },
  ];

  // Jika tidak ada santri dalam skop (misal kelas / jenjang baru kosong)
  if (targetStudentIds.length === 0) {
    return {
      scopeInfo: {
        type: scopeType,
        id: scopeId || 'empty',
        name: scopeTitle || 'Tidak Ada Santri',
        subtitle: scopeSubtitle || 'Belum ada santri terdaftar dalam cakupan ini',
        periodLabel,
        dateRangeLabel,
      },
      summary: {
        totalStudents: 0,
        activeStudentsCount: 0,
        attendanceRate: 0,
        onTimeRate: 0,
        lateRate: 0,
        absentRate: 0,
        excusedRate: 0,
        curriculumMasteryRate: 0,
        characterAverage: 0,
        topPerformerCount: 0,
        atRiskCount: 0,
        averageStreak: 0,
        completedSessionsCount: 0,
      },
      attendanceTrends: [],
      curriculumCategories: standardCategories.map((cat) => ({
        category: cat.key,
        masteryRate: 0,
        completedItems: 0,
        totalItems: 0,
        color: cat.color,
      })),
      characterRadar: [],
      benchmarkComparison: [],
      topPerformers: [],
      atRiskStudents: [],
      allStudents: [],
      parentEngagement: {
        hasVerificationTasks: false,
        totalRequiredTasks: 0,
        totalVerifiedTasks: 0,
        totalPendingTasks: 0,
        overallVerificationRate: 0,
        parentItems: [],
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // 2. Query Data Agregasi Paralel untuk seluruh targetStudentIds
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
  if (startDate) scheduleConditions.push({ startTime: { gte: startDate } });
  if (endDate) scheduleConditions.push({ startTime: { lte: endDate } });

  const attendanceWhere = {
    studentId: { in: targetStudentIds },
    session: {
      schedule: {
        AND: scheduleConditions,
      },
    },
  };

  const evalScheduleConditions: any[] = [{ status: { not: 'CANCELLED' } }];
  if (startDate) evalScheduleConditions.push({ startTime: { gte: startDate } });
  if (endDate) evalScheduleConditions.push({ startTime: { lte: endDate } });

  const evaluatedDateFilter =
    startDate && endDate
      ? {
          evaluatedAt: {
            gte: startDate,
            lte: endDate,
          },
        }
      : {};

  const targetStudentsGen = await prisma.user.findMany({
    where: { id: { in: targetStudentIds } },
    select: { id: true, generationId: true, organizationId: true },
  });
  const targetGenIds = Array.from(
    new Set(targetStudentsGen.map((s) => s.generationId).filter(Boolean))
  ) as string[];
  const targetOrgIds = Array.from(
    new Set(targetStudentsGen.map((s) => s.organizationId).filter(Boolean))
  ) as string[];

  const monthNames = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];
  let filterMonths: string[] = [];
  if (period === 'THIS_MONTH') {
    filterMonths = [monthNames[now.getMonth()]];
  } else if (period === 'LAST_MONTH') {
    const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    filterMonths = [monthNames[prevM]];
  } else if (period === 'THIS_SEMESTER') {
    const m = now.getMonth();
    filterMonths = m >= 6 ? monthNames.slice(6, 12) : monthNames.slice(0, 6);
  } else {
    filterMonths = monthNames;
  }

  const [
    studentsProfileRaw,
    attendanceRecordsRaw,
    checklistProgressRaw,
    evaluationsRaw,
    totalChecklistItemsCount,
    assignmentsRaw,
    targetMaterialsRaw,
    completedSchedulesCountRaw,
  ] = await Promise.all([
    // A. Profil Santri
    prisma.user.findMany({
      where: { id: { in: targetStudentIds } },
      select: {
        id: true,
        fullName: true,
        gender: true,
        organization: { select: { id: true, name: true, type: true } },
        generation: { select: { id: true, name: true } },
        parents: {
          take: 1,
          select: {
            parent: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    }),

    // B. Presensi Kehadiran
    prisma.attendanceRecord.findMany({
      where: attendanceWhere,
      select: {
        id: true,
        studentId: true,
        status: true,
        checkInTime: true,
        createdAt: true,
        session: {
          select: {
            schedule: {
              select: {
                id: true,
                title: true,
                startTime: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),

    // C. Capaian Checklist Kurikulum
    prisma.materialChecklistProgress.findMany({
      where: {
        studentId: { in: targetStudentIds },
        isCompleted: true,
        ...evaluatedDateFilter,
      },
      select: {
        studentId: true,
        score: true,
        evaluatedAt: true,
        checklistItem: {
          select: {
            id: true,
            itemTitle: true,
            description: true,
            material: {
              select: {
                id: true,
                title: true,
                description: true,
                targetGeneration: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    }),

    // D. Evaluasi Karakter & Adab
    prisma.studentEvaluation.findMany({
      where: {
        studentId: { in: targetStudentIds },
        schedule: {
          AND: evalScheduleConditions,
        },
      },
      select: {
        studentId: true,
        adabScore: true,
        keaktifanScore: true,
      },
    }),

    // E. Total materi checklist kurikulum yang ada (sebagai acuan target)
    prisma.materialChecklistItem.count({
      where: {
        material: { isActive: true },
      },
    }),

    // F. Tugas / Penugasan dalam rentang periode
    prisma.assignment.findMany({
      where: {
        ...(startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {}),
        OR: [
          {
            submissions: {
              some: { studentId: { in: targetStudentIds } },
            },
          },
          ...(scopeType === 'CLASS' && scopeId ? [{ classId: scopeId }] : []),
          ...(targetGenIds.length > 0
            ? [
                { class: { generationId: { in: targetGenIds } } },
                { material: { targetGenerationId: { in: targetGenIds } } },
              ]
            : []),
          ...(targetOrgIds.length > 0 ? [{ organizationId: { in: targetOrgIds } }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        organizationId: true,
        classId: true,
        materialId: true,
        attachmentUrl: true,
        requiresParentVerification: true,
        class: {
          select: {
            id: true,
            generationId: true,
          },
        },
        material: {
          select: {
            id: true,
            targetGenerationId: true,
          },
        },
        submissions: {
          where: { studentId: { in: targetStudentIds } },
          select: {
            id: true,
            studentId: true,
            status: true,
            parentVerification: {
              select: {
                id: true,
                isVerifiedByParent: true,
                parentFeedback: true,
                verifiedAt: true,
                parent: {
                  select: {
                    id: true,
                    fullName: true,
                    phoneNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    }),

    // G. Materi kurikulum target yang harus diselesaikan untuk santri dalam periode ini
    prisma.material.findMany({
      where: {
        isActive: true,
        ...(targetGenIds.length > 0 ? { targetGenerationId: { in: targetGenIds } } : {}),
        ...(filterMonths.length < 12
          ? {
              OR: filterMonths.map((mName) => ({
                title: { contains: mName, mode: 'insensitive' },
              })),
            }
          : {}),
      },
      include: {
        checklistItems: true,
      },
    }),

    // H. Total sesi pengajian yang statusnya selesai (COMPLETED)
    prisma.schedule.count({
      where: {
        status: 'COMPLETED',
        ...(startDate && endDate ? { startTime: { gte: startDate, lte: endDate } } : {}),
        OR: [
          { attendanceSessions: { some: { records: { some: { studentId: { in: targetStudentIds } } } } } },
          ...(scopeType === 'CLASS' && scopeId ? [{ classId: scopeId }, { targetClasses: { some: { classId: scopeId } } }] : []),
          ...(scopeType === 'GENERATION' && scopeId ? [{ targetGenerations: { some: { generationId: scopeId } } }] : []),
          ...(scopeType === 'KELOMPOK' && scopeId ? [{ organizationId: scopeId }] : []),
        ],
      },
    }),
  ]);

  // 3. Kalkulasi Metrik Agregat Presensi
  const totalAttendances = attendanceRecordsRaw.length;
  let countHadir = 0;
  let countTerlambat = 0;
  let countIzin = 0;
  let countSakit = 0;
  let countAlpa = 0;

  // Peta presensi per santri
  const studentAttendanceMap = new Map<
    string,
    { total: number; hadir: number; terlambat: number; alpa: number; izin: number; sakit: number }
  >();

  attendanceRecordsRaw.forEach((rec) => {
    const sId = rec.studentId;
    if (!studentAttendanceMap.has(sId)) {
      studentAttendanceMap.set(sId, { total: 0, hadir: 0, terlambat: 0, alpa: 0, izin: 0, sakit: 0 });
    }
    const sStat = studentAttendanceMap.get(sId)!;
    sStat.total += 1;

    if (rec.status === 'HADIR') {
      countHadir++;
      sStat.hadir++;
    } else if (rec.status === 'TERLAMBAT') {
      countTerlambat++;
      sStat.terlambat++;
    } else if (rec.status === 'IZIN') {
      countIzin++;
      sStat.izin++;
    } else if (rec.status === 'SAKIT') {
      countSakit++;
      sStat.sakit++;
    } else if (rec.status === 'ALPA') {
      countAlpa++;
      sStat.alpa++;
    }
  });

  const validPresentCount = countHadir + countTerlambat;
  const attendanceRate =
    totalAttendances > 0 ? Math.round((validPresentCount / totalAttendances) * 100) : 0;
  const onTimeRate =
    totalAttendances > 0 ? Math.round((countHadir / totalAttendances) * 100) : 0;
  const lateRate =
    totalAttendances > 0 ? Math.round((countTerlambat / totalAttendances) * 100) : 0;
  const absentRate =
    totalAttendances > 0 ? Math.round((countAlpa / totalAttendances) * 100) : 0;
  const excusedRate =
    totalAttendances > 0 ? Math.round(((countIzin + countSakit) / totalAttendances) * 100) : 0;

  // 4. Kalkulasi Metrik Kurikulum per Santri & Bidang Studi
  const studentChecklistMap = new Map<string, number>();

  // Hitung jumlah santri per jenjang untuk pengali target checklist materi
  const studentsPerGen: Record<string, number> = {};
  studentsProfileRaw.forEach((s) => {
    const gId = s.generation?.id || 'default';
    studentsPerGen[gId] = (studentsPerGen[gId] || 0) + 1;
  });

  // Hitung total target checklist per kategori materi
  const categoryTargets: Record<string, number> = {
    "Al-Qur'an & Tahfidz": 0,
    'Hadits & Sunnah': 0,
    'Doa & Dzikir Harian': 0,
    'Fiqih & Ibadah': 0,
    'Pegon & Literasi': 0,
  };
  const checklistCountPerGen: Record<string, number> = {};

  targetMaterialsRaw.forEach((m) => {
    const gId = m.targetGenerationId;
    const genStudentCount = gId && studentsPerGen[gId] ? studentsPerGen[gId] : targetStudentIds.length;
    checklistCountPerGen[gId] = (checklistCountPerGen[gId] || 0) + m.checklistItems.length;

    m.checklistItems.forEach((item) => {
      const cat = classifyCurriculumCategory(
        item.itemTitle,
        m.title,
        item.description || '',
        m.description || ''
      );
      categoryTargets[cat] = (categoryTargets[cat] || 0) + genStudentCount;
    });
  });

  // Hitung total capaian checklist yang telah selesai per kategori
  const categoryCompleted: Record<string, number> = {
    "Al-Qur'an & Tahfidz": 0,
    'Hadits & Sunnah': 0,
    'Doa & Dzikir Harian': 0,
    'Fiqih & Ibadah': 0,
    'Pegon & Literasi': 0,
  };

  checklistProgressRaw.forEach((p) => {
    studentChecklistMap.set(p.studentId, (studentChecklistMap.get(p.studentId) || 0) + 1);

    const itemTitle = p.checklistItem.itemTitle || '';
    const itemDesc = p.checklistItem.description || '';
    const matTitle = p.checklistItem.material.title || '';
    const matDesc = p.checklistItem.material.description || '';
    const catKey = classifyCurriculumCategory(itemTitle, matTitle, itemDesc, matDesc);

    categoryCompleted[catKey] = (categoryCompleted[catKey] || 0) + 1;
  });

  const totalTargetAllCategories = Object.values(categoryTargets).reduce((a, b) => a + b, 0);
  const totalCompletedChecklist = checklistProgressRaw.length;
  const maxPossibleCompleted =
    totalTargetAllCategories > 0 ? totalTargetAllCategories : targetStudentIds.length * 20;

  const curriculumMasteryRate =
    maxPossibleCompleted > 0 && totalCompletedChecklist > 0
      ? Math.min(100, Math.round((totalCompletedChecklist / maxPossibleCompleted) * 100))
      : 0;

  // Hasilkan bidang materi secara dinamis sesuai checklist yang ada atau diselesaikan
  const curriculumCategories: CurriculumCategoryMastery[] = standardCategories
    .filter((cat) => categoryTargets[cat.key] > 0 || categoryCompleted[cat.key] > 0)
    .map((cat) => {
      const target = categoryTargets[cat.key] || 0;
      const completed = categoryCompleted[cat.key] || 0;
      const rate = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
      return {
        category: cat.key,
        masteryRate: rate,
        completedItems: completed,
        totalItems: target,
        color: cat.color,
      };
    });

  // 5. Kalkulasi Karakter & Radar 5 Dimensi
  const studentEvalMap = new Map<string, { totalAdab: number; totalKeaktifan: number; count: number }>();
  evaluationsRaw.forEach((e) => {
    if (!studentEvalMap.has(e.studentId)) {
      studentEvalMap.set(e.studentId, { totalAdab: 0, totalKeaktifan: 0, count: 0 });
    }
    const s = studentEvalMap.get(e.studentId)!;
    s.totalAdab += e.adabScore;
    s.totalKeaktifan += e.keaktifanScore;
    s.count += 1;
  });

  let totalAdabAll = 0;
  let totalKeaktifanAll = 0;
  let evalCountAll = 0;

  studentEvalMap.forEach((v) => {
    totalAdabAll += v.totalAdab;
    totalKeaktifanAll += v.totalKeaktifan;
    evalCountAll += v.count;
  });

  const avgAdab = evalCountAll > 0 ? Math.round(totalAdabAll / evalCountAll) : 0;
  const avgKeaktifan = evalCountAll > 0 ? Math.round(totalKeaktifanAll / evalCountAll) : 0;
  const characterAverage = evalCountAll > 0 ? Math.round((avgAdab + avgKeaktifan) / 2) : 0;

  // Kalkulasi Keaktifan Pengerjaan Tugas (disesuaikan dengan tugas yang benar-benar ditujukan untuk santri)
  let totalExpectedSubmissionsAll = 0;
  let totalCompletedSubmissionsAll = 0;

  studentsProfileRaw.forEach((student) => {
    const studentTasks = assignmentsRaw.filter((a) =>
      isAssignmentForStudent(a, {
        id: student.id,
        organizationId: student.organization?.id,
        generationId: student.generation?.id,
      })
    );

    totalExpectedSubmissionsAll += studentTasks.length;

    studentTasks.forEach((a) => {
      const sub = a.submissions.find((s) => s.studentId === student.id);
      if (sub && (sub.status === 'SUBMITTED' || sub.status === 'VERIFIED_BY_PARENT' || sub.status === 'GRADED')) {
        totalCompletedSubmissionsAll += 1;
      }
    });
  });

  const taskCompletionRate =
    totalExpectedSubmissionsAll > 0
      ? Math.min(100, Math.round((totalCompletedSubmissionsAll / totalExpectedSubmissionsAll) * 100))
      : 0;

  const characterRadar: CharacterDimensionScore[] = [
    {
      dimension: 'Budi Pekerti (Adab)',
      score: avgAdab,
      benchmark: 85,
    },
    {
      dimension: 'Keaktifan Sesi',
      score: avgKeaktifan,
      benchmark: 80,
    },
    {
      dimension: 'Kemandirian & Disiplin',
      score: validPresentCount > 0 ? Math.round((countHadir / validPresentCount) * 100) : 0,
      benchmark: 80,
    },
  ];

  // Tambahkan dimensi Keaktifan Tugas jika terdapat penugasan untuk santri dalam periode berjalan
  if (totalExpectedSubmissionsAll > 0) {
    characterRadar.push({
      dimension: 'Keaktifan Pengerjaan Tugas',
      score: taskCompletionRate,
      benchmark: 80,
    });
  }

  // 6. Analisis Profil Setiap Santri & Klasifikasi Santri Unggul vs Perlu Penguatan
  const allStudents: PerformerStudentItem[] = studentsProfileRaw.map((student) => {
    const sAtt = studentAttendanceMap.get(student.id) || {
      total: 0,
      hadir: 0,
      terlambat: 0,
      alpa: 0,
      izin: 0,
      sakit: 0,
    };
    const sChecklist = studentChecklistMap.get(student.id) || 0;
    const sEval = studentEvalMap.get(student.id) || { totalAdab: 0, totalKeaktifan: 0, count: 0 };

    const studentTargetChecklist =
      (student.generation?.id && checklistCountPerGen[student.generation.id]) ||
      (targetGenIds.length === 1 && checklistCountPerGen[targetGenIds[0]]) ||
      Math.round(totalTargetAllCategories / (studentsProfileRaw.length || 1)) ||
      20;

    const studentAttRate =
      sAtt.total > 0 ? Math.round(((sAtt.hadir + sAtt.terlambat) / sAtt.total) * 100) : 0;
    const studentCurriculumRate =
      sChecklist > 0 && studentTargetChecklist > 0
        ? Math.min(100, Math.round((sChecklist / studentTargetChecklist) * 100))
        : 0;
    const studentCharScore =
      sEval.count > 0 ? Math.round((sEval.totalAdab / sEval.count + sEval.totalKeaktifan / sEval.count) / 2) : 0;

    const hasActivity = sAtt.total > 0 || sChecklist > 0 || sEval.count > 0;
    const compositeScore = hasActivity
      ? Math.round(studentAttRate * 0.4 + studentCurriculumRate * 0.35 + studentCharScore * 0.25)
      : 0;

    const reasons: string[] = [];
    let status: 'TOP' | 'STABLE' | 'AT_RISK' = 'STABLE';

    if (!hasActivity) {
      status = 'STABLE';
      reasons.push('Belum ada jadwal, presensi, atau evaluasi pada periode ini');
    } else if (compositeScore >= 85 && studentAttRate >= 90 && sAtt.alpa === 0) {
      status = 'TOP';
      if (studentAttRate === 100) reasons.push('Presensi Sempurna (100%)');
      if (studentCurriculumRate >= 80) reasons.push(`Capaian kurikulum sangat tinggi (${studentCurriculumRate}%)`);
      if (studentCharScore >= 90) reasons.push('Adab & akhlak istimewa');
    } else if (
      (sAtt.total > 0 && studentAttRate < 75) ||
      sAtt.alpa >= 2 ||
      (sChecklist > 0 && studentCurriculumRate < 40) ||
      (sEval.count > 0 && studentCharScore < 70)
    ) {
      status = 'AT_RISK';
      if (sAtt.alpa >= 2) reasons.push(`Alpa ${sAtt.alpa}x dalam periode ini`);
      if (sAtt.total > 0 && studentAttRate < 75) reasons.push(`Tingkat kehadiran rendah (${studentAttRate}%)`);
      if (sChecklist > 0 && studentCurriculumRate < 40) reasons.push(`Capaian kurikulum terhambat (${studentCurriculumRate}%)`);
      if (sEval.count > 0 && studentCharScore < 70) reasons.push('Perlu bimbingan adab & keaktifan');
    }

    if (reasons.length === 0) {
      reasons.push('Progres belajar stabil & konsisten');
    }

    const parent = student.parents[0]?.parent;

    return {
      studentId: student.id,
      fullName: student.fullName,
      gender: student.gender,
      className: student.generation?.name || 'Santri',
      generationName: student.generation?.name || '-',
      organizationName: student.organization?.name || '-',
      attendanceRate: studentAttRate,
      curriculumRate: studentCurriculumRate,
      characterScore: studentCharScore,
      compositeScore,
      reasons,
      status,
      parentName: parent?.fullName,
      parentPhone: parent?.phoneNumber || undefined,
    };
  });

  // Urutkan top performers dari skor tertinggi
  const topPerformers = allStudents
    .filter((s) => s.status === 'TOP')
    .sort((a, b) => b.compositeScore - a.compositeScore);

  // Urutkan at-risk students dari skor terendah
  const atRiskStudents = allStudents
    .filter((s) => s.status === 'AT_RISK')
    .sort((a, b) => a.compositeScore - b.compositeScore);

  // 7. Tren Kehadiran (Dikelompokkan per interval pekan secara dinamis)
  const attendanceTrends: AttendanceTrendItem[] = [];
  const startMs = startDate ? startDate.getTime() : Date.now() - 28 * 24 * 3600 * 1000;
  const endMs = endDate ? endDate.getTime() : Date.now();
  const numWeeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * 24 * 3600 * 1000)));

  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(startMs + i * 7 * 24 * 3600 * 1000);
    const weekEnd = new Date(Math.min(endMs, startMs + (i + 1) * 7 * 24 * 3600 * 1000));
    const weekRecs = attendanceRecordsRaw.filter((r) => {
      const rawDate = r.session?.schedule?.startTime || r.checkInTime || r.createdAt;
      const t = new Date(rawDate).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });

    const h = weekRecs.filter((r) => r.status === 'HADIR').length;
    const t = weekRecs.filter((r) => r.status === 'TERLAMBAT').length;
    const iz = weekRecs.filter((r) => r.status === 'IZIN').length;
    const sk = weekRecs.filter((r) => r.status === 'SAKIT').length;
    const al = weekRecs.filter((r) => r.status === 'ALPA').length;
    const rate = weekRecs.length > 0 ? Math.round(((h + t) / weekRecs.length) * 100) : 0;

    const completedSchedulesInWeek = new Set<string>();
    weekRecs.forEach((r) => {
      const sch = r.session?.schedule;
      if (sch?.id) {
        completedSchedulesInWeek.add(sch.id);
      }
    });

    const sDay = weekStart.getDate();
    const sMonth = weekStart.toLocaleDateString('id-ID', { month: 'short' });
    const eDateObj = new Date(weekEnd.getTime() - 1);
    const eDay = eDateObj.getDate();
    const eMonth = eDateObj.toLocaleDateString('id-ID', { month: 'short' });
    const dateRangeStr =
      sMonth === eMonth ? `${sDay}-${eDay} ${sMonth}` : `${sDay} ${sMonth} - ${eDay} ${eMonth}`;

    attendanceTrends.push({
      periodLabel: `Pekan ${i + 1} (${dateRangeStr})`,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      hadir: h,
      terlambat: t,
      izin: iz,
      sakit: sk,
      alpa: al,
      rate,
      completedSessions: completedSchedulesInWeek.size,
    });
  }

  // 8. Benchmark Perbandingan Sub-Unit (Per Kelompok atau Per Kelas)
  const benchmarkMap = new Map<
    string,
    { name: string; type: 'KELAS' | 'GENERASI' | 'KELOMPOK' | 'DESA'; students: PerformerStudentItem[] }
  >();

  allStudents.forEach((student) => {
    const key = student.organizationName || student.className;
    if (!benchmarkMap.has(key)) {
      benchmarkMap.set(key, {
        name: key,
        type: scopeType === 'DESA' || scopeType === 'DAERAH' ? 'KELOMPOK' : 'KELAS',
        students: [],
      });
    }
    benchmarkMap.get(key)!.students.push(student);
  });

  const benchmarkComparison: BenchmarkComparisonItem[] = Array.from(benchmarkMap.entries()).map(
    ([id, val]) => {
      const count = val.students.length;
      const avgAtt = Math.round(
        val.students.reduce((acc, s) => acc + s.attendanceRate, 0) / count
      );
      const avgCurr = Math.round(
        val.students.reduce((acc, s) => acc + s.curriculumRate, 0) / count
      );
      const avgChar = Math.round(
        val.students.reduce((acc, s) => acc + s.characterScore, 0) / count
      );
      return {
        id,
        name: val.name,
        type: val.type,
        studentCount: count,
        attendanceRate: avgAtt,
        curriculumRate: avgCurr,
        characterScore: avgChar,
      };
    }
  );

  let averageStreak = 0;
  if (totalAttendances > 0 && targetStudentIds.length > 0) {
    const gamifications = await prisma.userGamification.findMany({
      where: { userId: { in: targetStudentIds } },
      select: { currentStreakDays: true },
    });
    if (gamifications.length > 0) {
      averageStreak = Math.round(
        gamifications.reduce((acc, g) => acc + (g.currentStreakDays || 0), 0) / gamifications.length
      );
    }
  }

  const distinctSchedulesInAttendance = new Set<string>();
  attendanceRecordsRaw.forEach((r) => {
    const schId = r.session?.schedule?.id;
    if (schId) distinctSchedulesInAttendance.add(schId);
  });
  const completedSessionsCount = Math.max(completedSchedulesCountRaw || 0, distinctSchedulesInAttendance.size);

  const summary: AnalyticsSummaryKPI = {
    totalStudents: targetStudentIds.length,
    activeStudentsCount: allStudents.length,
    attendanceRate,
    onTimeRate,
    lateRate,
    absentRate,
    excusedRate,
    curriculumMasteryRate,
    characterAverage,
    topPerformerCount: topPerformers.length,
    atRiskCount: atRiskStudents.length,
    averageStreak,
    completedSessionsCount,
  };

  // 9. Analisis Keaktifan Paraf Orang Tua (hanya untuk santri yang benar-benar memiliki tugas butuh paraf)
  const verificationAssignments = assignmentsRaw.filter(
    (a) => a.requiresParentVerification || a.submissions.some((s) => s.parentVerification)
  );

  let totalAllRequired = 0;
  let totalAllVerified = 0;
  const parentItems: ParentVerificationItem[] = [];

  studentsProfileRaw.forEach((student) => {
    // Cari tugas paraf yang benar-benar ditujukan untuk jenjang/kelas santri ini
    const studentVerifTasks = verificationAssignments.filter((a) =>
      isAssignmentForStudent(a, {
        id: student.id,
        organizationId: student.organization?.id,
        generationId: student.generation?.id,
      })
    );

    // Jika santri ini tidak memiliki tugas berparaf pada periode ini, jangan masukkan ke daftar/perhitungan paraf
    if (studentVerifTasks.length === 0) {
      return;
    }

    const totalRequiredForStudent = studentVerifTasks.length;
    let verifiedCount = 0;
    let lastVerifiedDate: Date | null = null;
    let recordedParentName: string | undefined = undefined;
    let recordedParentPhone: string | undefined = undefined;

    studentVerifTasks.forEach((assignment) => {
      const sub = assignment.submissions.find((s) => s.studentId === student.id);
      if (sub) {
        const pv = sub.parentVerification;
        if (pv?.isVerifiedByParent || sub.status === 'VERIFIED_BY_PARENT' || sub.status === 'GRADED') {
          verifiedCount++;
          if (pv?.verifiedAt) {
            const vDate = new Date(pv.verifiedAt);
            if (!lastVerifiedDate || vDate > lastVerifiedDate) {
              lastVerifiedDate = vDate;
            }
          }
          if (pv?.parent?.fullName) recordedParentName = pv.parent.fullName;
          if (pv?.parent?.phoneNumber) recordedParentPhone = pv.parent.phoneNumber;
        }
      }
    });

    totalAllRequired += totalRequiredForStudent;
    totalAllVerified += verifiedCount;
    const pendingCount = Math.max(0, totalRequiredForStudent - verifiedCount);
    const rate = Math.round((verifiedCount / totalRequiredForStudent) * 100);

    let status: 'AKTIF' | 'SEDANG' | 'PERLU_DIPACU' = 'PERLU_DIPACU';
    if (rate >= 80) status = 'AKTIF';
    else if (rate >= 50) status = 'SEDANG';

    const fallbackParent = student.parents?.[0]?.parent;
    const parentName = recordedParentName || fallbackParent?.fullName || 'Wali Santri';
    const parentPhone = recordedParentPhone || fallbackParent?.phoneNumber || undefined;

    parentItems.push({
      studentId: student.id,
      studentName: student.fullName,
      gender: student.gender,
      className: student.generation?.name || student.organization?.name || 'Kelas',
      parentName,
      parentPhone,
      totalRequired: totalRequiredForStudent,
      totalVerified: verifiedCount,
      totalPending: pendingCount,
      verificationRate: rate,
      lastVerifiedAt: lastVerifiedDate ? (lastVerifiedDate as Date).toISOString() : undefined,
      status,
    });
  });

  const hasVerificationTasks = parentItems.length > 0 && totalAllRequired > 0;
  const totalAllPending = Math.max(0, totalAllRequired - totalAllVerified);
  const overallRate =
    totalAllRequired > 0 ? Math.round((totalAllVerified / totalAllRequired) * 100) : 0;

  const parentEngagement: ParentEngagementSummary = {
    hasVerificationTasks,
    totalRequiredTasks: totalAllRequired,
    totalVerifiedTasks: totalAllVerified,
    totalPendingTasks: totalAllPending,
    overallVerificationRate: overallRate,
    parentItems,
  };

  return {
    scopeInfo: {
      type: scopeType,
      id: scopeId || 'custom',
      name: scopeTitle,
      subtitle: scopeSubtitle,
      periodLabel,
      dateRangeLabel,
    },
    summary,
    attendanceTrends,
    curriculumCategories,
    characterRadar,
    benchmarkComparison,
    topPerformers,
    atRiskStudents,
    allStudents,
    parentEngagement,
    generatedAt: new Date().toISOString(),
  };
}
