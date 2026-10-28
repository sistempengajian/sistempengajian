'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getEffectiveAuthUser } from '@/lib/auth';
import { formatZodError } from '@/lib/security-utils';

const analyticsUserIdSchema = z.string().uuid('ID pengguna tidak valid.').optional();

const analyticsFilterParamsSchema = z.object({
  scopeType: z.enum(['CLASS', 'HOMEROOM_ALL', 'GENERATION', 'KELOMPOK', 'DESA', 'DAERAH', 'CUSTOM'], {
    errorMap: () => ({ message: 'Tipe cakupan analisis tidak valid.' }),
  }),
  scopeId: z.string().optional().nullable(),
  period: z.enum(['THIS_MONTH', 'LAST_MONTH', 'THIS_SEMESTER', 'ALL'], {
    errorMap: () => ({ message: 'Periode waktu analisis tidak valid.' }),
  }),
  customStudentIds: z.array(z.string().uuid('ID santri tidak valid.')).optional().nullable(),
});
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
  HomeroomClassOption,
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
  userId?: string
): Promise<AnalyticsFilterOptions> {
  let authUser: any = null;
  try {
    const authRes = await getEffectiveAuthUser();
    authUser = authRes.authUser;
  } catch {
    // Allows CLI / test script execution when explicit userId is provided
  }
  if (!authUser && !userId) {
    throw new Error('Unauthorized');
  }

  let targetUserId = userId;
  if (targetUserId) {
    const parsedUserId = analyticsUserIdSchema.safeParse(targetUserId);
    if (!parsedUserId.success) {
      throw new Error('ID pengguna tidak valid.');
    }
    targetUserId = parsedUserId.data;
  }
  let user = null;

  if (targetUserId) {
    user = await prisma.user.findUnique({
      where: { id: targetUserId },
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
  }

  // Fallback: Jika tidak ditemukan dengan targetUserId (misal yang diteruskan adalah UUID auth Supabase), cari via getEffectiveAuthUser
  if (!user) {
    try {
      const { dbUser } = await getEffectiveAuthUser();
      if (dbUser) {
        user = await prisma.user.findUnique({
          where: { id: dbUser.id },
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
      }
    } catch {
      // outside request context
    }
  }

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

  // Ambil kelas binaan spesifik user ini jika bertindak sebagai wali kelas
  const teacherHomeroomClassesRaw = await prisma.class.findMany({
    where: { homeroomTeacherId: user.id },
    include: {
      organization: true,
      generation: true,
    },
    orderBy: [{ generation: { minAge: 'asc' } }, { name: 'asc' }],
  });

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
          ? { homeroomTeacherId: user.id }
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

  // Fetch santri dalam cakupan untuk pemilih multi-siswa kustom serta penghitungan santri per kelas/jenjang
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
      organizationId: true,
      generationId: true,
      organization: { select: { name: true } },
      generation: { select: { name: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  // Hitung santri per kelas (organizationId + generationId) dan per jenjang untuk eliminasi kelas/jenjang kosong
  const classStudentCountMap = new Map<string, number>();
  const genStudentCountMap = new Map<string, number>();

  studentsRaw.forEach((s) => {
    if (s.organizationId && s.generationId) {
      const key = `${s.organizationId}:${s.generationId}`;
      classStudentCountMap.set(key, (classStudentCountMap.get(key) || 0) + 1);
    }
    if (s.generationId) {
      genStudentCountMap.set(s.generationId, (genStudentCountMap.get(s.generationId) || 0) + 1);
    }
  });

  // Saring homeroomClasses: HANYA kelas yang memiliki studentCount > 0
  const homeroomClasses: HomeroomClassOption[] = teacherHomeroomClassesRaw
    .map((c) => {
      const count = classStudentCountMap.get(`${c.organizationId}:${c.generationId}`) || 0;
      return {
        id: c.id,
        name: c.name,
        generationName: c.generation.name,
        organizationName: c.organization.name,
        studentCount: count,
      };
    })
    .filter((c) => c.studentCount > 0);

  // Saring classes: HANYA kelas yang memiliki count > 0
  const classes: ScopeFilterOption[] = classesRaw
    .map((c) => {
      const count = classStudentCountMap.get(`${c.organizationId}:${c.generationId}`) || 0;
      return {
        id: c.id,
        name: c.name,
        type: 'CLASS' as const,
        count,
        subtitle: `${c.generation.name} • ${c.organization.name} (${count} Santri)`,
      };
    })
    .filter((c) => (c.count || 0) > 0);

  // Saring generations: HANYA jenjang yang memiliki count > 0 dalam wilayah user
  const generations: ScopeFilterOption[] = generationsRaw
    .map((g) => {
      const count = genStudentCountMap.get(g.id) || 0;
      return {
        id: g.id,
        name: g.name,
        type: 'GENERATION' as const,
        count,
        subtitle: `Rentang Usia ${g.minAge}-${g.maxAge} thn (${count} Santri)`,
      };
    })
    .filter((g) => (g.count || 0) > 0);

  // Jika user membina kelas yang aktif bersantri, tambahkan opsi HOMEROOM_ALL
  if (homeroomClasses.length > 0) {
    if (!allowedScopeTypes.includes('HOMEROOM_ALL')) {
      allowedScopeTypes = ['HOMEROOM_ALL', ...allowedScopeTypes];
    }
  }

  const availableStudents: StudentSelectorItem[] = studentsRaw.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    gender: s.gender,
    className: s.generation?.name || 'Santri',
    generationName: s.generation?.name || '-',
    organizationName: s.organization?.name || '-',
  }));

  // Tentukan default scope secara cerdas
  let defaultScope: { type: AnalyticsScopeType; id: string; name: string } = {
    type: 'CLASS',
    id: classes[0]?.id || '',
    name: classes[0]?.name || 'Kelas Binaan',
  };

  const isPureTeacher = !isAdmin && !isPjDaerah && !isPjDesa && !isPjKelompok;

  if (isPureTeacher && homeroomClasses.length > 1) {
    defaultScope = {
      type: 'HOMEROOM_ALL',
      id: 'homeroom_all',
      name: 'Semua Kelas Binaan',
    };
  } else if (isPureTeacher && homeroomClasses.length === 1) {
    defaultScope = {
      type: 'CLASS',
      id: homeroomClasses[0].id,
      name: homeroomClasses[0].name,
    };
  } else if (isPjDaerah && daerahs.length > 0) {
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
    homeroomClasses,
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
  let authUser: any = null;
  try {
    const authRes = await getEffectiveAuthUser();
    authUser = authRes.authUser;
  } catch {
    // Allows CLI / test script execution when explicit userId is provided
  }
  if (!authUser && !userId) {
    throw new Error('Unauthorized');
  }

  const parsedUserId = z.string().uuid('ID pengguna tidak valid.').safeParse(userId);
  if (!parsedUserId.success) {
    throw new Error('ID pengguna tidak valid.');
  }

  const parsedParams = analyticsFilterParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    throw new Error(formatZodError(parsedParams.error));
  }

  const { scopeType, scopeId, period, customStudentIds } = parsedParams.data;
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
  } else if (scopeType === 'HOMEROOM_ALL') {
    const teacherClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      include: { organization: true, generation: true },
      orderBy: [{ generation: { minAge: 'asc' } }, { name: 'asc' }],
    });

    if (teacherClasses.length > 0) {
      const classOrFilters = teacherClasses.map((c) => ({
        organizationId: c.organizationId,
        generationId: c.generationId,
      }));

      const students = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          OR: classOrFilters,
        },
        select: { id: true, organizationId: true, generationId: true },
      });

      targetStudentIds = students.map((s) => s.id);

      const populatedKeys = new Set<string>();
      students.forEach((s) => {
        if (s.organizationId && s.generationId) {
          populatedKeys.add(`${s.organizationId}:${s.generationId}`);
        }
      });
      const activeClasses = teacherClasses.filter((c) =>
        populatedKeys.has(`${c.organizationId}:${c.generationId}`)
      );

      scopeTitle = 'Semua Kelas Binaan';
      scopeSubtitle = `${activeClasses.length} Kelas Binaan Aktif • ${targetStudentIds.length} Santri Terdaftar`;
    } else {
      scopeTitle = 'Semua Kelas Binaan';
      scopeSubtitle = 'Belum ada kelas binaan yang ditugaskan';
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
        period,
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

  // Tarik kelas relevan untuk santri-santri ini dalam 1 batch query (Zero N+1)
  const relevantClasses = await prisma.class.findMany({
    where: {
      organizationId: { in: targetOrgIds },
      ...(targetGenIds.length > 0 ? { generationId: { in: targetGenIds } } : {}),
    },
    select: { id: true, organizationId: true, generationId: true },
  });

  const studentToMatchingClassIds = new Map<string, string[]>();
  targetStudentsGen.forEach((s) => {
    const clsIds = relevantClasses
      .filter((c) => c.organizationId === s.organizationId && c.generationId === s.generationId)
      .map((c) => c.id);
    if (scopeType === 'CLASS' && scopeId && !clsIds.includes(scopeId)) {
      clsIds.push(scopeId);
    }
    studentToMatchingClassIds.set(s.id, clsIds);
  });
  const allTargetClassIds = Array.from(
    new Set(Array.from(studentToMatchingClassIds.values()).flat())
  );

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

  // Tentukan target periode kurikulum (bulan & tahun) untuk acuan denominator target bulanan
  const currentYear = now.getFullYear();
  const currentMonthZeroIndex = now.getMonth(); // 0 - 11
  const currentMonth = currentMonthZeroIndex + 1; // 1 - 12

  let targetPeriods: Array<{ year: number; month: number }> = [];
  if (period === 'THIS_MONTH') {
    targetPeriods = [{ year: currentYear, month: currentMonth }];
  } else if (period === 'LAST_MONTH') {
    const prevYear = currentMonthZeroIndex === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonthZeroIndex === 0 ? 12 : currentMonthZeroIndex;
    targetPeriods = [{ year: prevYear, month: prevMonth }];
  } else if (period === 'THIS_SEMESTER') {
    const isGenap = currentMonthZeroIndex < 6;
    const semesterMonths = isGenap ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
    targetPeriods = semesterMonths.map((m) => ({ year: currentYear, month: m }));
  }

  const [
    studentsProfileRaw,
    attendanceRecordsRaw,
    checklistProgressRaw,
    evaluationsRaw,
    totalChecklistItemsCount,
    assignmentsRaw,
    allMasterMaterialsRaw,
    monthlyTargetsRaw,
    conductedSchedulesRaw,
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
        checklistItemId: true,
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
                targetGenerationId: true,
                checklistItems: {
                  select: { id: true, itemTitle: true, description: true },
                  orderBy: { orderIndex: 'asc' },
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

    // G1. Master seluruh materi kurikulum aktif (sebagai fallback pro-rata dan periode ALL)
    prisma.material.findMany({
      where: {
        isActive: true,
        OR: [
          ...(targetGenIds.length > 0 ? [{ targetGenerationId: { in: targetGenIds } }] : []),
          ...filterMonths.map((m) => ({ title: { contains: m.slice(0, 3) } })),
        ],
      },
      include: {
        checklistItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    }),

    // G2. Target kurikulum silabus periodik (MaterialMonthlyTarget) jika bukan periode ALL
    period !== 'ALL' && targetPeriods.length > 0
      ? prisma.materialMonthlyTarget.findMany({
          where: {
            isActive: true,
            ...(targetGenIds.length > 0 ? { generationId: { in: targetGenIds } } : {}),
            OR: targetPeriods.map((p) => ({ year: p.year, month: p.month })),
          },
          include: {
            material: {
              include: {
                checklistItems: {
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
          orderBy: [{ orderIndex: 'asc' }],
        })
      : Promise.resolve([]),

    // H. Seluruh jadwal sesi pengajian terlaksana dalam rentang periode untuk santri-santri ini (Batch-Optimized)
    prisma.schedule.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
        ...(startDate && endDate ? { startTime: { gte: startDate, lte: endDate } } : {}),
        AND: [
          {
            OR: [
              { attendanceSessions: { some: { records: { some: { studentId: { in: targetStudentIds } } } } } },
              ...(allTargetClassIds.length > 0
                ? [
                    { classId: { in: allTargetClassIds } },
                    { targetClasses: { some: { classId: { in: allTargetClassIds } } } },
                  ]
                : []),
              ...(targetGenIds.length > 0
                ? [{ targetGenerations: { some: { generationId: { in: targetGenIds } } } }]
                : []),
              ...(scopeType === 'KELOMPOK' && scopeId ? [{ organizationId: scopeId }] : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        status: true,
        classId: true,
        organizationId: true,
        targetClasses: { select: { classId: true } },
        targetGenerations: { select: { generationId: true } },
        attendanceSessions: {
          select: {
            id: true,
            openedAt: true,
            records: {
              where: { studentId: { in: targetStudentIds } },
              select: {
                id: true,
                studentId: true,
                status: true,
                checkInTime: true,
              },
            },
          },
          orderBy: { openedAt: 'desc' },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  // 1. Filter sesi pengajian yang sah dan terlaksana (COMPLETED, ACTIVE, atau startTime <= now)
  const conductedSchedules = conductedSchedulesRaw.filter((sched) => {
    return sched.status === 'COMPLETED' || sched.status === 'ACTIVE' || sched.startTime <= now;
  });

  // 2. Kalkulasi Metrik Presensi Berbasis Sesi Terlaksana (SSOT Parity)
  const studentAttendanceMap = new Map<
    string,
    { total: number; hadir: number; terlambat: number; alpa: number; izin: number; sakit: number }
  >();

  let globalCountHadir = 0;
  let globalCountTerlambat = 0;
  let globalCountIzin = 0;
  let globalCountSakit = 0;
  let globalCountAlpa = 0;
  let globalTotalConductedStudentSessions = 0;

  studentsProfileRaw.forEach((student) => {
    const studentClassIds = studentToMatchingClassIds.get(student.id) || [];

    // Tentukan sesi terlaksana yang relevan bagi santri ini
    const applicableSchedules = conductedSchedules.filter((sched) => {
      const isMatchedByClass = sched.classId ? studentClassIds.includes(sched.classId) : false;
      const isMatchedByTargetClass = sched.targetClasses.some((tc) => studentClassIds.includes(tc.classId));
      const isMatchedByGen = Boolean(
        student.generation?.id && sched.targetGenerations.some((tg) => tg.generationId === student.generation?.id)
      );
      const hasStudentRecord = sched.attendanceSessions.some((ses) =>
        ses.records.some((r) => r.studentId === student.id)
      );
      return isMatchedByClass || isMatchedByTargetClass || isMatchedByGen || hasStudentRecord;
    });

    let sHadir = 0;
    let sTerlambat = 0;
    let sIzin = 0;
    let sSakit = 0;
    let sAlpa = 0;

    applicableSchedules.forEach((sched) => {
      let record: { status: string } | null = null;
      for (const ses of sched.attendanceSessions) {
        const r = ses.records.find((rec) => rec.studentId === student.id);
        if (r) {
          record = r;
          break;
        }
      }

      const status = record ? record.status : 'ALPA';
      if (status === 'HADIR') sHadir++;
      else if (status === 'TERLAMBAT') sTerlambat++;
      else if (status === 'IZIN') sIzin++;
      else if (status === 'SAKIT') sSakit++;
      else if (status === 'ALPA') sAlpa++;
    });

    // Fallback jika tidak ada jadwal terdaftar tapi ada rekaman presensi langsung
    if (applicableSchedules.length === 0) {
      const directRecords = attendanceRecordsRaw.filter((r) => r.studentId === student.id);
      directRecords.forEach((r) => {
        if (r.status === 'HADIR') sHadir++;
        else if (r.status === 'TERLAMBAT') sTerlambat++;
        else if (r.status === 'IZIN') sIzin++;
        else if (r.status === 'SAKIT') sSakit++;
        else if (r.status === 'ALPA') sAlpa++;
      });
    }

    const sTotal = Math.max(applicableSchedules.length, sHadir + sTerlambat + sIzin + sSakit + sAlpa);
    studentAttendanceMap.set(student.id, {
      total: sTotal,
      hadir: sHadir,
      terlambat: sTerlambat,
      izin: sIzin,
      sakit: sSakit,
      alpa: sAlpa,
    });

    globalCountHadir += sHadir;
    globalCountTerlambat += sTerlambat;
    globalCountIzin += sIzin;
    globalCountSakit += sSakit;
    globalCountAlpa += sAlpa;
    globalTotalConductedStudentSessions += sTotal;
  });

  const validPresentCount = globalCountHadir + globalCountTerlambat;
  const attendanceRate =
    globalTotalConductedStudentSessions > 0
      ? Math.round((validPresentCount / globalTotalConductedStudentSessions) * 100)
      : 0;
  const onTimeRate =
    globalTotalConductedStudentSessions > 0
      ? Math.round((globalCountHadir / globalTotalConductedStudentSessions) * 100)
      : 0;
  const lateRate =
    globalTotalConductedStudentSessions > 0
      ? Math.round((globalCountTerlambat / globalTotalConductedStudentSessions) * 100)
      : 0;
  const absentRate =
    globalTotalConductedStudentSessions > 0
      ? Math.round((globalCountAlpa / globalTotalConductedStudentSessions) * 100)
      : 0;
  const excusedRate =
    globalTotalConductedStudentSessions > 0
      ? Math.round(((globalCountIzin + globalCountSakit) / globalTotalConductedStudentSessions) * 100)
      : 0;

  // 3. Kalkulasi Kurikulum Berbasis Irisan Checklist Materi Target (SSOT Parity)
  const getMaterialBaseKey = (title: string) =>
    title.replace(/\s+(OKT|SEP|NOV|DES|JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU).*$/i, '').trim().toUpperCase();

  type MaterialWithChecklists = {
    id: string;
    title: string;
    description: string | null;
    targetGenerationId: string | null;
    checklistItems: Array<{
      id: string;
      itemTitle: string;
      description: string | null;
    }>;
  };

  const studentCurriculumMap = new Map<
    string,
    {
      targetItemsCount: number;
      completedItemsCount: number;
      curriculumRate: number;
      targetMaterials: MaterialWithChecklists[];
    }
  >();

  const studentCompletedItemIdsMap = new Map<string, Set<string>>();
  const studentProgressMaterialsMap = new Map<string, MaterialWithChecklists[]>();

  checklistProgressRaw.forEach((p) => {
    if (!studentCompletedItemIdsMap.has(p.studentId)) {
      studentCompletedItemIdsMap.set(p.studentId, new Set<string>());
    }
    studentCompletedItemIdsMap.get(p.studentId)!.add(p.checklistItemId);

    const mat = p.checklistItem?.material;
    if (mat) {
      if (!studentProgressMaterialsMap.has(p.studentId)) {
        studentProgressMaterialsMap.set(p.studentId, []);
      }
      studentProgressMaterialsMap.get(p.studentId)!.push({
        id: mat.id,
        title: mat.title,
        description: mat.description,
        targetGenerationId: mat.targetGenerationId,
        checklistItems: mat.checklistItems,
      });
    }
  });

  const monthlyTargetsByGen = new Map<string, MaterialWithChecklists[]>();
  monthlyTargetsRaw.forEach((t) => {
    if (!t.material) return;
    const gId = t.generationId || 'all';
    if (!monthlyTargetsByGen.has(gId)) {
      monthlyTargetsByGen.set(gId, []);
    }
    monthlyTargetsByGen.get(gId)!.push({
      id: t.material.id,
      title: t.material.title,
      description: t.material.description,
      targetGenerationId: t.generationId,
      checklistItems: t.material.checklistItems,
    });
  });

  const categoryTargets: Record<string, number> = {
    "Al-Qur'an & Tahfidz": 0,
    'Hadits & Sunnah': 0,
    'Doa & Dzikir Harian': 0,
    'Fiqih & Ibadah': 0,
    'Pegon & Literasi': 0,
  };
  const categoryCompleted: Record<string, number> = {
    "Al-Qur'an & Tahfidz": 0,
    'Hadits & Sunnah': 0,
    'Doa & Dzikir Harian': 0,
    'Fiqih & Ibadah': 0,
    'Pegon & Literasi': 0,
  };

  studentsProfileRaw.forEach((student) => {
    const completedSet = studentCompletedItemIdsMap.get(student.id) || new Set<string>();
    const progressMats = studentProgressMaterialsMap.get(student.id) || [];
    const targetMaterialMap = new Map<string, MaterialWithChecklists>();

    // A. Materi dimana santri memiliki progres tercatat di periode ini
    progressMats.forEach((mat) => {
      const key = getMaterialBaseKey(mat.title);
      if (!targetMaterialMap.has(key)) {
        targetMaterialMap.set(key, mat);
      }
    });

    // B. Target silabus periodik (MaterialMonthlyTarget) untuk jenjang santri
    if (period !== 'ALL') {
      const genTargets = student.generation?.id
        ? monthlyTargetsByGen.get(student.generation.id) || []
        : [];
      genTargets.forEach((mat) => {
        const key = getMaterialBaseKey(mat.title);
        if (!targetMaterialMap.has(key)) {
          targetMaterialMap.set(key, mat);
        }
      });
    } else {
      // Periode ALL: seluruh master kurikulum aktif
      allMasterMaterialsRaw
        .filter(
          (m) =>
            !student.generation?.id ||
            m.targetGenerationId === student.generation.id ||
            !m.targetGenerationId
        )
        .forEach((mat) => {
          const key = getMaterialBaseKey(mat.title);
          if (!targetMaterialMap.has(key)) {
            targetMaterialMap.set(key, mat);
          }
        });
    }

    // C. Fallback jika masih kosong: cari materi yang cocok dengan jenjang atau filter bulan
    if (targetMaterialMap.size === 0) {
      allMasterMaterialsRaw
        .filter(
          (m) =>
            (!student.generation?.id || m.targetGenerationId === student.generation.id) &&
            filterMonths.some((f) => m.title.toUpperCase().includes(f.slice(0, 3)))
        )
        .slice(0, 4)
        .forEach((mat) => {
          const key = getMaterialBaseKey(mat.title);
          if (!targetMaterialMap.has(key)) {
            targetMaterialMap.set(key, mat);
          }
        });
    }

    // D. Safe Fallback pro-rata
    if (targetMaterialMap.size === 0 && allMasterMaterialsRaw.length > 0) {
      const divisor = period === 'THIS_SEMESTER' ? 2 : period === 'ALL' ? 1 : 12;
      const masterForGen = allMasterMaterialsRaw.filter(
        (m) => !student.generation?.id || m.targetGenerationId === student.generation.id
      );
      const candidates = masterForGen.length > 0 ? masterForGen : allMasterMaterialsRaw;
      const quota = Math.max(1, Math.ceil(candidates.length / divisor));
      candidates.slice(0, quota).forEach((mat) => {
        const key = getMaterialBaseKey(mat.title);
        if (!targetMaterialMap.has(key)) {
          targetMaterialMap.set(key, mat);
        }
      });
    }

    const finalTargetMaterials = Array.from(targetMaterialMap.values());
    const allTargetChecklistItems = finalTargetMaterials.flatMap((m) => m.checklistItems);
    const totalTargetItems = allTargetChecklistItems.length;
    let completedInTarget = 0;

    allTargetChecklistItems.forEach((chk) => {
      const isDone = completedSet.has(chk.id);
      if (isDone) completedInTarget++;

      const mat = finalTargetMaterials.find((m) => m.checklistItems.some((c) => c.id === chk.id));
      const cat = classifyCurriculumCategory(
        chk.itemTitle,
        mat?.title || '',
        chk.description || '',
        mat?.description || ''
      );
      categoryTargets[cat] = (categoryTargets[cat] || 0) + 1;
      if (isDone) {
        categoryCompleted[cat] = (categoryCompleted[cat] || 0) + 1;
      }
    });

    const studentRate =
      totalTargetItems > 0
        ? Math.min(100, Math.round((completedInTarget / totalTargetItems) * 100))
        : 0;

    studentCurriculumMap.set(student.id, {
      targetItemsCount: totalTargetItems,
      completedItemsCount: completedInTarget,
      curriculumRate: studentRate,
      targetMaterials: finalTargetMaterials,
    });
  });

  const totalTargetAllCategories = Object.values(categoryTargets).reduce((a, b) => a + b, 0);
  const totalCompletedAllCategories = Object.values(categoryCompleted).reduce((a, b) => a + b, 0);

  const curriculumMasteryRate =
    totalTargetAllCategories > 0
      ? Math.min(100, Math.round((totalCompletedAllCategories / totalTargetAllCategories) * 100))
      : 0;

  const curriculumCategories: CurriculumCategoryMastery[] = standardCategories
    .filter((cat) => (categoryTargets[cat.key] || 0) > 0 || (categoryCompleted[cat.key] || 0) > 0)
    .map((cat) => {
      const target = categoryTargets[cat.key] || 0;
      const completed = categoryCompleted[cat.key] || 0;
      const rate = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : (completed > 0 ? 100 : 0);
      return {
        category: cat.key,
        masteryRate: rate,
        completedItems: completed,
        totalItems: target,
        color: cat.color,
      };
    });

  // 4. Kalkulasi Karakter & Evaluasi Ustadz Murni (Tanpa Penalti Alpa Ganda)
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

  const studentScoresMap = new Map<string, { adab: number; keaktifan: number; charScore: number }>();
  let totalStudentCharScores = 0;
  let totalStudentAdabScores = 0;
  let totalStudentKeaktifanScores = 0;
  let evaluatedStudentsCount = 0;

  studentsProfileRaw.forEach((student) => {
    const sAtt = studentAttendanceMap.get(student.id) || {
      total: 0,
      hadir: 0,
      terlambat: 0,
      alpa: 0,
      izin: 0,
      sakit: 0,
    };
    const sEval = studentEvalMap.get(student.id) || { totalAdab: 0, totalKeaktifan: 0, count: 0 };

    let sAdab = 0;
    let sKeaktifan = 0;

    if (sEval.count > 0) {
      sAdab = Math.round(sEval.totalAdab / sEval.count);
      sKeaktifan = Math.round(sEval.totalKeaktifan / sEval.count);
    } else if (sAtt.total > 0 && (sAtt.hadir + sAtt.terlambat) > 0) {
      sAdab = 85;
      sKeaktifan = 85;
    } else {
      sAdab = 0;
      sKeaktifan = 0;
    }

    const sChar = Math.round((sAdab + sKeaktifan) / 2);
    studentScoresMap.set(student.id, { adab: sAdab, keaktifan: sKeaktifan, charScore: sChar });

    if (sAtt.total > 0 || sEval.count > 0) {
      totalStudentAdabScores += sAdab;
      totalStudentKeaktifanScores += sKeaktifan;
      totalStudentCharScores += sChar;
      evaluatedStudentsCount++;
    }
  });

  const avgAdab = evaluatedStudentsCount > 0 ? Math.round(totalStudentAdabScores / evaluatedStudentsCount) : 0;
  const avgKeaktifan = evaluatedStudentsCount > 0 ? Math.round(totalStudentKeaktifanScores / evaluatedStudentsCount) : 0;
  const characterAverage = evaluatedStudentsCount > 0 ? Math.round(totalStudentCharScores / evaluatedStudentsCount) : 0;

  // Radar 6 Thobiat Luhur (Karakter Islami Institusional - SSOT Parity)
  const scoreRukun = avgAdab;
  const scoreKompak = attendanceRate;
  const scoreKerjasama = avgKeaktifan;
  const scoreJujur = validPresentCount > 0 ? Math.round((globalCountHadir / validPresentCount) * 100) : 0;
  const scoreAmanah = curriculumMasteryRate;
  const scoreMujhidMuzhid = Math.round(
    scoreRukun * 0.35 + scoreKompak * 0.35 + scoreAmanah * 0.30
  );

  const characterRadar: CharacterDimensionScore[] = [
    {
      dimension: 'Rukun (Budi Pekerti & Adab)',
      score: scoreRukun,
      benchmark: 85,
    },
    {
      dimension: 'Kompak (Kehadiran Pengajian)',
      score: scoreKompak,
      benchmark: 85,
    },
    {
      dimension: 'Kerjasama Baik (Keaktifan Sesi)',
      score: scoreKerjasama,
      benchmark: 80,
    },
    {
      dimension: 'Jujur & Disiplin (Ketepatan Waktu)',
      score: scoreJujur,
      benchmark: 85,
    },
    {
      dimension: 'Amanah (Ketuntasan Kurikulum)',
      score: scoreAmanah,
      benchmark: 80,
    },
    {
      dimension: 'Mujhid-Muzhid (Etos & Kesungguhan)',
      score: scoreMujhidMuzhid,
      benchmark: 80,
    },
  ];

  // 5. Analisis Profil Setiap Santri & Skor Komposit Terpadu
  const allStudents: PerformerStudentItem[] = studentsProfileRaw.map((student) => {
    const sAtt = studentAttendanceMap.get(student.id) || {
      total: 0,
      hadir: 0,
      terlambat: 0,
      alpa: 0,
      izin: 0,
      sakit: 0,
    };
    const sCurr = studentCurriculumMap.get(student.id) || {
      targetItemsCount: 0,
      completedItemsCount: 0,
      curriculumRate: 0,
      targetMaterials: [],
    };
    const sEval = studentEvalMap.get(student.id) || { totalAdab: 0, totalKeaktifan: 0, count: 0 };
    const sScores = studentScoresMap.get(student.id) || { adab: 0, keaktifan: 0, charScore: 0 };

    const studentAttRate =
      sAtt.total > 0 ? Math.round(((sAtt.hadir + sAtt.terlambat) / sAtt.total) * 100) : 0;
    const clampedCurrRate = Math.min(100, Math.max(0, sCurr.curriculumRate));
    const studentCharScore = sScores.charScore;

    const hasActivity = sAtt.total > 0 || sCurr.completedItemsCount > 0 || sEval.count > 0;
    const compositeScore = hasActivity
      ? Math.min(100, Math.round(studentAttRate * 0.40 + clampedCurrRate * 0.35 + studentCharScore * 0.25))
      : 0;

    const reasons: string[] = [];
    let status: 'TOP' | 'STABLE' | 'AT_RISK' = 'STABLE';

    if (!hasActivity) {
      if (globalTotalConductedStudentSessions > 0) {
        status = 'AT_RISK';
        reasons.push('Tidak memiliki catatan presensi / evaluasi sesi (Perlu ditindaklanjuti)');
      } else {
        status = 'STABLE';
        reasons.push('Belum ada jadwal sesi pengajian pada periode ini');
      }
    } else if (compositeScore >= 85 && studentAttRate >= 90 && sAtt.alpa === 0 && studentCharScore >= 80) {
      status = 'TOP';
      if (studentAttRate === 100) reasons.push('Presensi Sempurna (100%)');
      if (clampedCurrRate >= 80) reasons.push(`Capaian kurikulum sangat tinggi (${clampedCurrRate}%)`);
      if (studentCharScore >= 90) reasons.push('Adab & akhlak istimewa');
    } else if (
      (sAtt.total > 0 && studentAttRate < 75) ||
      sAtt.alpa >= 1 ||
      (sAtt.total > 0 && (sAtt.hadir + sAtt.terlambat) === 0) ||
      (sCurr.targetItemsCount > 0 && clampedCurrRate < 40) ||
      (studentCharScore < 70)
    ) {
      status = 'AT_RISK';
      if (sAtt.alpa >= 1) reasons.push(`Alpa ${sAtt.alpa}x dalam periode ini`);
      if (sAtt.total > 0 && (sAtt.hadir + sAtt.terlambat) === 0) reasons.push('Tidak pernah hadir pada sesi yang tercatat');
      else if (sAtt.total > 0 && studentAttRate < 75) reasons.push(`Tingkat kehadiran rendah (${studentAttRate}%)`);
      if (sCurr.targetItemsCount > 0 && clampedCurrRate < 40) reasons.push(`Capaian kurikulum terhambat (${clampedCurrRate}%)`);
      if (studentCharScore < 70) reasons.push('Perlu bimbingan adab & keaktifan');
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
      curriculumRate: clampedCurrRate,
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

  // 6. Tren Kehadiran (Dikelompokkan per interval pekan secara dinamis berbasis Sesi Terlaksana)
  const attendanceTrends: AttendanceTrendItem[] = [];
  const startMs = startDate ? startDate.getTime() : Date.now() - 28 * 24 * 3600 * 1000;
  const endMs = endDate ? endDate.getTime() : Date.now();
  const numWeeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * 24 * 3600 * 1000)));

  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(startMs + i * 7 * 24 * 3600 * 1000);
    const weekEnd = new Date(Math.min(endMs, startMs + (i + 1) * 7 * 24 * 3600 * 1000));
    const weekScheds = conductedSchedules.filter((sched) => {
      const t = sched.startTime.getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });

    let h = 0;
    let t = 0;
    let iz = 0;
    let sk = 0;
    let al = 0;

    if (weekScheds.length > 0) {
      weekScheds.forEach((sched) => {
        studentsProfileRaw.forEach((student) => {
          const studentClassIds = studentToMatchingClassIds.get(student.id) || [];
          const isMatchedByClass = sched.classId ? studentClassIds.includes(sched.classId) : false;
          const isMatchedByTargetClass = sched.targetClasses.some((tc) => studentClassIds.includes(tc.classId));
          const isMatchedByGen = Boolean(
            student.generation?.id && sched.targetGenerations.some((tg) => tg.generationId === student.generation?.id)
          );
          const hasStudentRecord = sched.attendanceSessions.some((ses) =>
            ses.records.some((r) => r.studentId === student.id)
          );

          if (isMatchedByClass || isMatchedByTargetClass || isMatchedByGen || hasStudentRecord) {
            let rec: { status: string } | null = null;
            for (const ses of sched.attendanceSessions) {
              const r = ses.records.find((rc) => rc.studentId === student.id);
              if (r) {
                rec = r;
                break;
              }
            }
            const st = rec ? rec.status : 'ALPA';
            if (st === 'HADIR') h++;
            else if (st === 'TERLAMBAT') t++;
            else if (st === 'IZIN') iz++;
            else if (st === 'SAKIT') sk++;
            else if (st === 'ALPA') al++;
          }
        });
      });
    } else {
      const weekRecs = attendanceRecordsRaw.filter((r) => {
        const rawDate = r.session?.schedule?.startTime || r.checkInTime || r.createdAt;
        const timeVal = new Date(rawDate).getTime();
        return timeVal >= weekStart.getTime() && timeVal < weekEnd.getTime();
      });
      h = weekRecs.filter((r) => r.status === 'HADIR').length;
      t = weekRecs.filter((r) => r.status === 'TERLAMBAT').length;
      iz = weekRecs.filter((r) => r.status === 'IZIN').length;
      sk = weekRecs.filter((r) => r.status === 'SAKIT').length;
      al = weekRecs.filter((r) => r.status === 'ALPA').length;
    }

    const totalInWeek = h + t + iz + sk + al;
    const rate = totalInWeek > 0 ? Math.round(((h + t) / totalInWeek) * 100) : 0;

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
      completedSessions: weekScheds.length,
    });
  }

  // 8. Benchmark Perbandingan Sub-Unit (Per Kelompok atau Per Kelas)
  let benchmarkComparison: BenchmarkComparisonItem[] = [];

  if (scopeType === 'HOMEROOM_ALL') {
    const teacherClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      include: { generation: true, organization: true },
      orderBy: [{ generation: { minAge: 'asc' } }, { name: 'asc' }],
    });

    // Peta siswa ke kelas binaan guru
    const studentToClassMap = new Map<string, typeof teacherClasses[0]>();
    studentsProfileRaw.forEach((student) => {
      const cls = teacherClasses.find(
        (c) => c.organizationId === student.organization?.id && c.generationId === student.generation?.id
      );
      if (cls) {
        studentToClassMap.set(student.id, cls);
      }
    });

    const classGroupMap = new Map<string, { cls: typeof teacherClasses[0]; students: PerformerStudentItem[] }>();
    allStudents.forEach((student) => {
      const cls = studentToClassMap.get(student.studentId);
      if (cls) {
        if (!classGroupMap.has(cls.id)) {
          classGroupMap.set(cls.id, { cls, students: [] });
        }
        classGroupMap.get(cls.id)!.students.push(student);
      }
    });

    benchmarkComparison = Array.from(classGroupMap.values())
      .map(({ cls, students }) => {
        const count = students.length;
        const avgAtt = Math.round(students.reduce((acc, s) => acc + s.attendanceRate, 0) / count);
        const avgCurr = Math.round(students.reduce((acc, s) => acc + s.curriculumRate, 0) / count);
        const avgChar = Math.round(students.reduce((acc, s) => acc + s.characterScore, 0) / count);
        return {
          id: cls.id,
          name: `${cls.name} (${cls.generation.name})`,
          type: 'KELAS' as const,
          studentCount: count,
          attendanceRate: avgAtt,
          curriculumRate: avgCurr,
          characterScore: avgChar,
        };
      })
      .filter((b) => b.studentCount > 0);
  } else {
    const benchmarkMap = new Map<
      string,
      { id: string; name: string; type: 'KELAS' | 'GENERASI' | 'KELOMPOK' | 'DESA'; students: PerformerStudentItem[] }
    >();

    allStudents.forEach((student) => {
      const key = student.organizationName || student.className;
      if (!benchmarkMap.has(key)) {
        benchmarkMap.set(key, {
          id: key,
          name: key,
          type: scopeType === 'DESA' || scopeType === 'DAERAH' ? 'KELOMPOK' : 'KELAS',
          students: [],
        });
      }
      benchmarkMap.get(key)!.students.push(student);
    });

    benchmarkComparison = Array.from(benchmarkMap.values())
      .map((val) => {
        const count = val.students.length;
        const avgAtt = Math.round(val.students.reduce((acc, s) => acc + s.attendanceRate, 0) / count);
        const avgCurr = Math.round(val.students.reduce((acc, s) => acc + s.curriculumRate, 0) / count);
        const avgChar = Math.round(val.students.reduce((acc, s) => acc + s.characterScore, 0) / count);
        return {
          id: val.id,
          name: val.name,
          type: val.type,
          studentCount: count,
          attendanceRate: avgAtt,
          curriculumRate: avgCurr,
          characterScore: avgChar,
        };
      })
      .filter((b) => b.studentCount > 0);
  }

  let averageStreak = 0;
  if (globalTotalConductedStudentSessions > 0 && targetStudentIds.length > 0) {
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
  const completedSessionsCount = Math.max(conductedSchedules.length, distinctSchedulesInAttendance.size);

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
      period,
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

/**
 * Aksi Server: Mendapatkan Tautan & Teks WhatsApp Lembar Evaluasi Bulanan Zero-Login
 */
export async function getStudentEvaluationLinkAction(
  studentId: string,
  targetMonth?: number,
  targetYear?: number
) {
  const { getSingleStudentEvaluationShareData } = await import(
    '@/lib/whatsapp/monthlyEvaluationNotificationService'
  );
  return getSingleStudentEvaluationShareData(studentId, targetMonth, targetYear);
}

/**
 * Aksi Server: Mengirim Lembar Evaluasi ke Nomor WhatsApp Orang Tua via WAHA
 */
export async function sendEvaluationViaWahaAction(
  studentId: string,
  targetMonth?: number,
  targetYear?: number
) {
  const { dispatchMonthlyEvaluationsForStudents } = await import(
    '@/lib/whatsapp/monthlyEvaluationNotificationService'
  );
  const now = new Date();
  return dispatchMonthlyEvaluationsForStudents({
    studentIds: [studentId],
    month: targetMonth || now.getMonth() + 1,
    year: targetYear || now.getFullYear(),
  });
}

/**
 * Aksi Server: Mengirim Lembar Evaluasi Bulanan Massal ke Seluruh Santri Terpilih via WAHA
 */
export async function batchDispatchEvaluationsViaWahaAction(
  studentIds: string[],
  targetMonth?: number,
  targetYear?: number
) {
  const { dispatchMonthlyEvaluationsForStudents } = await import(
    '@/lib/whatsapp/monthlyEvaluationNotificationService'
  );
  const now = new Date();
  return dispatchMonthlyEvaluationsForStudents({
    studentIds,
    month: targetMonth || now.getMonth() + 1,
    year: targetYear || now.getFullYear(),
  });
}

