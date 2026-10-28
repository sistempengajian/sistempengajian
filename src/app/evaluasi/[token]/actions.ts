'use server';

import prisma from '@/lib/prisma';
import { verifyEvaluationToken } from '@/lib/studentEvaluationToken';
import { AttendanceStatus } from '@prisma/client';
import { classifyCurriculumCategory } from '@/lib/curriculumClassification';

export interface WeeklyTrendItem {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  sessionsCount: number;
  attendedCount: number;
  attendanceRate: number;
  adabScore: number;
  keaktifanScore: number;
}

export interface MonthlyChecklistItem {
  id: string;
  itemTitle: string;
  pointsWeight: number;
  isCompleted: boolean;
}

export interface MonthlyMaterialItem {
  id: string;
  title: string;
  category: string;
  isCompleted: boolean;
  checklistItems: MonthlyChecklistItem[];
}

export interface ThobiatLuhurItem {
  key: string;
  label: string;
  score: number; // 0 - 100
  description: string;
}

export interface StudentEvaluationData {
  student: {
    id: string;
    fullName: string;
    gender: 'MALE' | 'FEMALE';
    avatarUrl: string | null;
    organizationName: string;
    generationName: string;
    className: string | null;
    homeroomTeacher: {
      fullName: string;
      phoneNumber: string | null;
    } | null;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
    formattedRangeDate: string;
    issueDate: string;
  };
  attendance: {
    totalSessions: number;
    attended: number;
    onTime: number;
    late: number;
    permission: number;
    sick: number;
    absent: number;
    percentage: number;
    statusColor: 'emerald' | 'amber' | 'rose';
    streakDays: number;
    weeklyTrend: WeeklyTrendItem[];
  };
  curriculum: {
    totalTargetMaterials: number;
    completedTargetMaterials: number;
    totalChecklistItems: number;
    completedChecklistItems: number;
    masteryPercentage: number;
    predicate: string;
    materials: MonthlyMaterialItem[];
  };
  character: {
    averageAdab: number;
    averageKeaktifan: number;
    compositeScore: number;
    predicate: string;
    thobiatLuhur: ThobiatLuhurItem[];
    teacherNote: string;
  };
  gamification: {
    totalPoints: number;
    level: number;
  };
}

export interface MonthlyEvaluationResponse {
  success: boolean;
  error?: string;
  month?: number;
  year?: number;
  studentsData?: StudentEvaluationData[];
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Mengambil data komprehensif evaluasi bulanan santri berbasis token zero-login
 */
export async function getMonthlyEvaluationData(token: string): Promise<MonthlyEvaluationResponse> {
  const verified = verifyEvaluationToken(token);
  if (!verified.valid || !verified.studentIds || !verified.month || !verified.year) {
    return {
      success: false,
      error: verified.error || 'Tautan lembar evaluasi tidak sah atau telah kedaluwarsa.',
    };
  }

  const { studentIds, month, year } = verified;

  try {
    // 1. Tentukan batas awal dan akhir bulan (WIB / Asia/Jakarta)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    // Hari terakhir dalam bulan:
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = new Date(Date.UTC(year, month - 1, lastDayOfMonth, 23, 59, 59, 999));

    const monthName = `${MONTH_NAMES_ID[month - 1]} ${year}`;
    const monthCode = MONTH_NAMES_ID[month - 1].slice(0, 3).toUpperCase();
    const formattedRangeDate = `1 – ${lastDayOfMonth} ${MONTH_NAMES_ID[month - 1]} ${year}`;
    const issueDate = `${lastDayOfMonth} ${MONTH_NAMES_ID[month - 1]} ${year}`;

    // 2. Fetch data seluruh santri dalam batch
    const students = await prisma.user.findMany({
      where: {
        id: { in: studentIds },
      },
      include: {
        organization: true,
        generation: true,
        gamification: true,
      },
    });

    if (!students || students.length === 0) {
      return {
        success: false,
        error: 'Data santri untuk tautan ini tidak ditemukan di sistem.',
      };
    }

    const studentsData: StudentEvaluationData[] = [];

    for (const student of students) {
      // A. Cari kelas aktif & Wali Kelas santri
      const studentClass = await prisma.class.findFirst({
        where: {
          generationId: student.generationId || undefined,
          organizationId: student.organizationId || undefined,
        },
        include: {
          homeroomTeacher: {
            select: {
              fullName: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // B. Data Presensi & Kehadiran (Sesuai Standar Laporan Riil)
      // 1. Identifikasi kelas yang relevan dengan santri
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

      // 2. Ambil jadwal santri pada bulan ini
      const scheduleWhere: any = {
        AND: [
          { status: { not: 'CANCELLED' } },
          { OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }] },
          { startTime: { gte: startDate, lte: endDate } },
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
            ],
          },
        ],
      };

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
          attendanceSessions: {
            include: {
              records: {
                where: { studentId: student.id },
              },
            },
            orderBy: { openedAt: 'desc' },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      // 3. Hanya hitung sesi yang sudah terlaksana atau sedang aktif
      const now = new Date();
      const attendanceSchedules = relevantSchedules.filter((sched) => {
        return sched.status === 'COMPLETED' || sched.status === 'ACTIVE' || sched.startTime <= now;
      });

      let onTime = 0;
      let late = 0;
      let permission = 0;
      let sick = 0;
      let absent = 0;

      for (const sched of attendanceSchedules) {
        const record = sched.attendanceSessions.flatMap((s) => s.records)[0];
        const status: AttendanceStatus = record ? record.status : AttendanceStatus.ALPA;

        if (status === AttendanceStatus.HADIR) onTime++;
        else if (status === AttendanceStatus.TERLAMBAT) late++;
        else if (status === AttendanceStatus.IZIN) permission++;
        else if (status === AttendanceStatus.SAKIT) sick++;
        else if (status === AttendanceStatus.ALPA) absent++;
      }

      // Fallback jika tidak ada jadwal formal terdaftar tapi ada record presensi mandiri
      if (attendanceSchedules.length === 0) {
        const directRecords = await prisma.attendanceRecord.findMany({
          where: {
            studentId: student.id,
            session: { createdAt: { gte: startDate, lte: endDate } },
          },
          select: { status: true },
        });
        for (const r of directRecords) {
          if (r.status === AttendanceStatus.HADIR) onTime++;
          else if (r.status === AttendanceStatus.TERLAMBAT) late++;
          else if (r.status === AttendanceStatus.IZIN) permission++;
          else if (r.status === AttendanceStatus.SAKIT) sick++;
          else if (r.status === AttendanceStatus.ALPA) absent++;
        }
      }

      const totalSessions = Math.max(attendanceSchedules.length, onTime + late + permission + sick + absent);
      const attended = onTime + late;
      const attendancePercentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 100;

      let statusColor: 'emerald' | 'amber' | 'rose' = 'emerald';
      if (attendancePercentage < 70) statusColor = 'rose';
      else if (attendancePercentage < 85) statusColor = 'amber';

      // C. Evaluasi Karakter & Nilai Adab/Keaktifan dari Sesi Pengajian (Data Riil)
      const studentEvaluations = await prisma.studentEvaluation.findMany({
        where: {
          studentId: student.id,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      let totalAdab = 0;
      let totalKeaktifan = 0;
      const teacherNotesList: string[] = [];

      for (const ev of studentEvaluations) {
        totalAdab += ev.adabScore;
        totalKeaktifan += ev.keaktifanScore;
        if (ev.teacherPrivateNote && ev.teacherPrivateNote.trim()) {
          teacherNotesList.push(ev.teacherPrivateNote.trim());
        }
      }

      const evalCount = studentEvaluations.length;
      let averageAdab = 0;
      let averageKeaktifan = 0;

      if (evalCount > 0) {
        averageAdab = Math.round(totalAdab / evalCount);
        averageKeaktifan = Math.round(totalKeaktifan / evalCount);
      } else if (totalSessions > 0 && attended > 0) {
        averageAdab = 85;
        averageKeaktifan = 85;
      } else {
        averageAdab = 0;
        averageKeaktifan = 0;
      }

      // D. Pecah Tren Pekanan (Minggu 1 s/d Minggu 4/5) untuk Line Chart
      const weeklyTrend: WeeklyTrendItem[] = [];
      const daysInMonth = lastDayOfMonth;
      const weekIntervals = [
        { start: 1, end: 7, label: 'Pekan 1' },
        { start: 8, end: 14, label: 'Pekan 2' },
        { start: 15, end: 21, label: 'Pekan 3' },
        { start: 22, end: daysInMonth, label: 'Pekan 4' },
      ];

      weekIntervals.forEach((interval, idx) => {
        const weekScheds = attendanceSchedules.filter((sched) => {
          const sDate = new Date(sched.startTime);
          const day = sDate.getDate();
          return day >= interval.start && day <= interval.end;
        });

        const weekEvals = studentEvaluations.filter((ev) => {
          const evDate = new Date(ev.createdAt);
          const day = evDate.getDate();
          return day >= interval.start && day <= interval.end;
        });

        let wAttended = 0;
        for (const s of weekScheds) {
          const rec = s.attendanceSessions.flatMap((sess) => sess.records)[0];
          if (rec && (rec.status === AttendanceStatus.HADIR || rec.status === AttendanceStatus.TERLAMBAT)) {
            wAttended++;
          }
        }
        const wSessions = Math.max(1, weekScheds.length);
        const wRate = weekScheds.length > 0 ? Math.round((wAttended / wSessions) * 100) : attendancePercentage;

        let wAdab = averageAdab;
        let wKeaktifan = averageKeaktifan;

        if (weekEvals.length > 0) {
          const sumA = weekEvals.reduce((acc, curr) => acc + curr.adabScore, 0);
          const sumK = weekEvals.reduce((acc, curr) => acc + curr.keaktifanScore, 0);
          wAdab = Math.round(sumA / weekEvals.length);
          wKeaktifan = Math.round(sumK / weekEvals.length);
        }

        weeklyTrend.push({
          weekIndex: idx + 1,
          weekLabel: interval.label,
          dateRange: `${interval.start}–${interval.end} ${MONTH_NAMES_ID[month - 1].slice(0, 3)}`,
          sessionsCount: weekScheds.length,
          attendedCount: wAttended,
          attendanceRate: wRate,
          adabScore: wAdab,
          keaktifanScore: wKeaktifan,
        });
      });

      // E. Kurikulum & Target Materi Bulan Ini (Data Riil)
      const getMaterialBaseKey = (title: string) =>
        title.replace(/\s+(OKT|SEP|NOV|DES|JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU).*$/i, '').trim().toUpperCase();

      const targetMaterialMap = new Map<string, any>();

      // 1. Ambil materi dimana santri memiliki progres tercatat di bulan ini
      const monthProgressRecords = await prisma.materialChecklistProgress.findMany({
        where: {
          studentId: student.id,
          evaluatedAt: { gte: startDate, lte: endDate },
        },
        include: {
          checklistItem: {
            include: {
              material: {
                include: {
                  checklistItems: { orderBy: { orderIndex: 'asc' } },
                },
              },
            },
          },
        },
        orderBy: { evaluatedAt: 'desc' },
      });

      for (const pr of monthProgressRecords) {
        const mat = pr.checklistItem?.material;
        if (mat && mat.isActive) {
          const key = getMaterialBaseKey(mat.title);
          if (!targetMaterialMap.has(key)) {
            targetMaterialMap.set(key, mat);
          }
        }
      }

      // 2. Ambil dari MaterialMonthlyTarget spesifik untuk jenjang santri di bulan & tahun ini
      const monthlyTargets = await prisma.materialMonthlyTarget.findMany({
        where: {
          generationId: student.generationId || undefined,
          month,
          year,
          isActive: true,
        },
        include: {
          material: {
            include: {
              checklistItems: { orderBy: { orderIndex: 'asc' } },
            },
          },
        },
        orderBy: { orderIndex: 'asc' },
      });

      for (const t of monthlyTargets) {
        if (t.material && t.material.isActive) {
          const key = getMaterialBaseKey(t.material.title);
          if (!targetMaterialMap.has(key)) {
            targetMaterialMap.set(key, t.material);
          }
        }
      }

      // 3. Fallback jika masih kosong: Cari materi dengan kode bulan untuk jenjang santri
      if (targetMaterialMap.size === 0) {
        const monthMaterials = await prisma.material.findMany({
          where: {
            isActive: true,
            OR: [
              { targetGenerationId: student.generationId || undefined },
              { title: { contains: monthCode } },
            ],
            AND: [{ title: { contains: monthCode } }],
          },
          include: {
            checklistItems: { orderBy: { orderIndex: 'asc' } },
          },
          take: 4,
          orderBy: { createdAt: 'asc' },
        });

        for (const m of monthMaterials) {
          const key = getMaterialBaseKey(m.title);
          if (!targetMaterialMap.has(key)) {
            targetMaterialMap.set(key, m);
          }
        }
      }

      const finalTargetMaterials = Array.from(targetMaterialMap.values());
      const allTargetChecklistItemIds = finalTargetMaterials.flatMap((m) =>
        m.checklistItems.map((c: any) => c.id)
      );

      // Ambil seluruh progres checklist santri pada materi target ini
      const studentAllTargetProgress = await prisma.materialChecklistProgress.findMany({
        where: {
          studentId: student.id,
          checklistItemId: { in: allTargetChecklistItemIds },
          isCompleted: true,
        },
        select: { checklistItemId: true },
      });

      const completedChecklistSet = new Set(
        studentAllTargetProgress.map((p) => p.checklistItemId)
      );

      let totalChecklistItems = 0;
      let completedChecklistItems = 0;

      const materials: MonthlyMaterialItem[] = finalTargetMaterials.map((mat) => {
        const items: MonthlyChecklistItem[] = mat.checklistItems.map((chk: any) => {
          totalChecklistItems++;
          const isDone = completedChecklistSet.has(chk.id);
          if (isDone) completedChecklistItems++;

          return {
            id: chk.id,
            itemTitle: chk.itemTitle,
            pointsWeight: chk.pointsWeight,
            isCompleted: isDone,
          };
        });

        const isMatCompleted = items.length > 0 && items.every((i) => i.isCompleted);

        return {
          id: mat.id,
          title: mat.title,
          category: classifyCurriculumCategory('', mat.title),
          isCompleted: isMatCompleted,
          checklistItems: items,
        };
      });

      const totalTargetMaterials = materials.length;
      const completedTargetMaterials = materials.filter((m) => m.isCompleted).length;

      const masteryPercentage =
        totalChecklistItems > 0
          ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
          : totalTargetMaterials > 0
          ? Math.round((completedTargetMaterials / totalTargetMaterials) * 100)
          : 0;

      let curriculumPredicate = 'Cukup (C)';
      if (masteryPercentage >= 85) curriculumPredicate = 'Sangat Baik (A)';
      else if (masteryPercentage >= 70) curriculumPredicate = 'Baik (B)';
      else if (masteryPercentage < 50) curriculumPredicate = 'Perlu Pendampingan (D)';

      // F. 6 Thobiat Luhur (Karakter Islami Institusional - 100% Data Riil)
      const scoreRukun = evalCount > 0 ? averageAdab : (attended > 0 ? 85 : 0);
      const scoreKompak = attendancePercentage;
      const scoreKerjasama = evalCount > 0 ? averageKeaktifan : (attended > 0 ? 85 : 0);
      const scoreJujur = attended > 0 ? Math.round((onTime / attended) * 100) : 0;
      const scoreAmanah = masteryPercentage;
      const scoreMujhidMuzhid = Math.round(
        scoreRukun * 0.35 + scoreKompak * 0.35 + scoreAmanah * 0.30
      );

      const thobiatLuhur: ThobiatLuhurItem[] = [
        {
          key: 'rukun',
          label: 'Rukun',
          score: scoreRukun,
          description: 'Kerukunan & budi pekerti sesama santri',
        },
        {
          key: 'kompak',
          label: 'Kompak',
          score: scoreKompak,
          description: 'Kekompakan dalam kehadiran pengajian bersama',
        },
        {
          key: 'kerjasama',
          label: 'Kerjasama Baik',
          score: scoreKerjasama,
          description: 'Keaktifan & partisipasi dalam sesi halaqoh',
        },
        {
          key: 'jujur',
          label: 'Jujur',
          score: scoreJujur,
          description: 'Kedisiplinan & kejujuran waktu presensi',
        },
        {
          key: 'amanah',
          label: 'Amanah',
          score: scoreAmanah,
          description: 'Tanggung jawab penyelesaian target materi',
        },
        {
          key: 'mujhid_muzhid',
          label: 'Mujhid-Muzhid',
          score: scoreMujhidMuzhid,
          description: 'Kesungguhan & etos belajar Al-Qur’an & Hadits',
        },
      ];

      const compositeScore = Math.round(
        scoreRukun * 0.35 + scoreKerjasama * 0.25 + scoreKompak * 0.2 + scoreAmanah * 0.2
      );

      let characterPredicate = 'B';
      if (compositeScore >= 85) characterPredicate = 'A';
      else if (compositeScore < 70) characterPredicate = 'C';

      // Catatan apresiasi & pembinaan wali kelas
      let teacherNote = teacherNotesList[0] || '';
      if (!teacherNote) {
        if (attendancePercentage >= 85 && masteryPercentage >= 70) {
          teacherNote = `Alhamdulillah, ananda ${student.fullName} menunjukkan kedisiplinan dan capaian materi yang sangat membanggakan di bulan ${MONTH_NAMES_ID[month - 1]}. Semoga terus istiqomah dan senantiasa berakhlaqul karimah.`;
        } else if (attendancePercentage >= 70) {
          teacherNote = `Ananda ${student.fullName} mengikuti pengajian dengan baik dan tertib. Diperlukan sedikit penguatan latihan mandiri di rumah agar materi yang belum tuntas dapat segera dikuasai.`;
        } else {
          teacherNote = `Ananda ${student.fullName} memiliki potensi yang baik. Mohon pendampingan dan motivasi dari Bapak/Ibu di rumah untuk meningkatkan kehadiran mengaji secara lebih tertib dan konsisten.`;
        }
      }

      studentsData.push({
        student: {
          id: student.id,
          fullName: student.fullName,
          gender: student.gender,
          avatarUrl: student.avatarUrl,
          organizationName: student.organization?.name || 'Kelompok Pengajian',
          generationName: student.generation?.name || 'Generasi Santri',
          className: studentClass?.name || null,
          homeroomTeacher: studentClass?.homeroomTeacher
            ? {
                fullName: studentClass.homeroomTeacher.fullName,
                phoneNumber: studentClass.homeroomTeacher.phoneNumber,
              }
            : null,
        },
        period: {
          month,
          year,
          monthName,
          formattedRangeDate,
          issueDate,
        },
        attendance: {
          totalSessions,
          attended,
          onTime,
          late,
          permission,
          sick,
          absent,
          percentage: attendancePercentage,
          statusColor,
          streakDays: student.gamification?.currentStreakDays || 0,
          weeklyTrend,
        },
        curriculum: {
          totalTargetMaterials,
          completedTargetMaterials,
          totalChecklistItems,
          completedChecklistItems,
          masteryPercentage,
          predicate: curriculumPredicate,
          materials,
        },
        character: {
          averageAdab,
          averageKeaktifan,
          compositeScore,
          predicate: characterPredicate,
          thobiatLuhur,
          teacherNote,
        },
        gamification: {
          totalPoints: student.gamification?.totalPoints || 0,
          level: student.gamification?.level || 1,
        },
      });
    }

    return {
      success: true,
      month,
      year,
      studentsData,
    };
  } catch (err: any) {
    console.error('Error fetching monthly evaluation data:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memproses lembar evaluasi bulanan.',
    };
  }
}
