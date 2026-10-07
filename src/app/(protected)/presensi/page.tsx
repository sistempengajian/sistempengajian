import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import ClassroomCockpit from '@/components/presensi/ClassroomCockpit';
import StudentQrScanner from '@/components/presensi/StudentQrScanner';
import ParentAttendanceMonitor, {
  ChildAttendanceSummary,
  ChildScheduleInfo,
} from '@/components/presensi/ParentAttendanceMonitor';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building2,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { AttendanceStatus, AttendanceMethod } from '@prisma/client';
import { generateSessionSecret, generateQrPayload, TOTP_STEP_SECONDS } from '@/lib/totp';
import { resolveMaterialsForSchedule } from '@/lib/curriculumVersionResolver';
import { getParentAbsenceHistory, populateDefaultAbsenceForSession } from '@/app/(protected)/presensi/actions';

import { getEffectiveAuthUser } from '@/lib/auth';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

export default async function PresensiPage({
  searchParams,
}: {
  searchParams?: Promise<{ scheduleId?: string; studentId?: string; tab?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedScheduleId = resolvedParams.scheduleId;
  const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!authUser) {
    redirect('/login');
  }

  if (!userProfile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login?auth_error=' + encodeURIComponent('Sesi profil pengguna tidak ditemukan. Silakan login kembali.'));
  }

  const scheduleInclude = {
    organization: {
      include: {
        parent: true,
      },
    },
    class: {
      include: {
        generation: true,
        organization: true,
      },
    },
    targetClasses: {
      include: {
        class: {
          include: {
            generation: true,
            organization: true,
          },
        },
      },
    },
    targetGenerations: {
      include: {
        generation: true,
      },
    },
    scheduleMaterials: {
      include: {
        material: {
          include: {
            targetGeneration: true,
          },
        },
      },
      orderBy: {
        slotIndex: 'asc' as const,
      },
    },
    teachers: {
      include: {
        teacher: true,
      },
    },
    attendanceSessions: {
      take: 1,
      orderBy: {
        createdAt: 'desc' as const,
      },
      include: {
        records: {
          include: {
            absenceConfirmation: {
              include: {
                parent: {
                  select: { fullName: true },
                },
              },
            },
          },
        },
      },
    },
  };

  // Fetch jadwal spesifik jika scheduleId disediakan
  const directSchedule = requestedScheduleId
    ? await prisma.schedule.findUnique({
        where: { id: requestedScheduleId },
        include: scheduleInclude,
      })
    : null;

  const roleCodes = userProfile.roles.map((r) => r.role);
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPjOrAdmin =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('ADMIN_MASTER');

  const canAccessCockpit = isPengajar || (isPjOrAdmin && Boolean(requestedScheduleId));

  // =========================================================================
  // VIEW 1: PENGAJAR / WALI KELAS / PJ MEMANDU PRESENSI -> CLASSROOM COCKPIT
  // =========================================================================
  if (canAccessCockpit) {
    // Gunakan jadwal dari query param jika ada, jika tidak cari jadwal aktif pengajar
    let activeSchedule = directSchedule;

    if (!activeSchedule && isPengajar) {
      activeSchedule = await prisma.schedule.findFirst({
        where: {
          status: { in: ['ACTIVE', 'SCHEDULED'] },
          OR: [
            { teachers: { some: { teacherId: userProfile.id } } },
            ...(userProfile.organizationId ? [{ organizationId: userProfile.organizationId }] : []),
          ],
        },
        orderBy: { startTime: 'asc' },
        include: scheduleInclude,
      });
    }

    if (!activeSchedule) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto border border-teal-200/60">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Belum Ada Sesi Pengajian Terjadwal</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Anda tidak memiliki jadwal pengajian aktif saat ini. Buat atau aktifkan jadwal di menu Jadwal Pengajian.
            </p>
            <Link
              href="/jadwal"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Buka Kalender Jadwal
            </Link>
          </div>
        </div>
      );
    }

    const isScheduleCompleted = activeSchedule.status === 'COMPLETED';

    // Ambil sesi presensi yang ada (utamakan yang sudah di-load eager di relasi scheduleInclude)
    let session: any = (activeSchedule as any).attendanceSessions?.[0] || null;

    if (!session) {
      session = await prisma.attendanceSession.findFirst({
        where: {
          scheduleId: activeSchedule.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          records: {
            include: {
              absenceConfirmation: {
                include: {
                  parent: {
                    select: { fullName: true },
                  },
                },
              },
            },
          },
        },
      });
    }

    // HANYA buat sesi baru jika jadwal BELUM COMPLETED dan sesi memang belum pernah ada
    if (!session && !isScheduleCompleted) {
      const dynamicQrSecret = generateSessionSecret();
      session = await prisma.attendanceSession.create({
        data: {
          scheduleId: activeSchedule.id,
          dynamicQrSecret,
          isActive: true,
          qrRefreshSeconds: TOTP_STEP_SECONDS,
          openedAt: new Date(),
        },
        include: {
          records: {
            include: {
              absenceConfirmation: {
                include: {
                  parent: {
                    select: { fullName: true },
                  },
                },
              },
            },
          },
        },
      });

      // Update status jadwal menjadi ACTIVE
      await prisma.schedule.update({
        where: { id: activeSchedule.id },
        data: { status: 'ACTIVE' },
      });
    }

    // Jika jadwal sudah COMPLETED namun belum ada sesi di database
    if (!session) {
      const dynamicQrSecret = generateSessionSecret();
      session = await prisma.attendanceSession.create({
        data: {
          scheduleId: activeSchedule.id,
          dynamicQrSecret,
          isActive: false,
          openedAt: new Date(activeSchedule.startTime),
          closedAt: new Date(activeSchedule.endTime),
        },
        include: {
          records: {
            include: {
              absenceConfirmation: {
                include: {
                  parent: {
                    select: { fullName: true },
                  },
                },
              },
            },
          },
        },
      });
    }

    const isSessionActive = Boolean(session.isActive && !isScheduleCompleted);

    // Hitung token QR awal di server untuk instan-render tanpa delay network di browser
    const initialQrPayload = isSessionActive && session.dynamicQrSecret
      ? generateQrPayload(session.id, session.dynamicQrSecret, session.qrRefreshSeconds)
      : null;

    // Kumpulkan daftar kelas target jadwal (baik kelas utama maupun multi-kelas gabungan)
    const targetClassesMap = new Map<
      string,
      { id: string; name: string; organizationId: string; generationId: string }
    >();

    if (activeSchedule.class) {
      targetClassesMap.set(activeSchedule.class.id, {
        id: activeSchedule.class.id,
        name: activeSchedule.class.name,
        organizationId: activeSchedule.class.organizationId,
        generationId: activeSchedule.class.generationId,
      });
    }

    if (activeSchedule.targetClasses && activeSchedule.targetClasses.length > 0) {
      for (const tc of activeSchedule.targetClasses) {
        if (tc.class) {
          targetClassesMap.set(tc.class.id, {
            id: tc.class.id,
            name: tc.class.name,
            organizationId: tc.class.organizationId,
            generationId: tc.class.generationId,
          });
        }
      }
    }

    const targetClassesList = Array.from(targetClassesMap.values());

    // Ambil daftar santri terfilter sesuai target jadwal
    const studentWhere: any = {
      roles: {
        some: { role: 'SANTRI' },
      },
    };

    if (targetClassesList.length > 0) {
      studentWhere.OR = targetClassesList.map((c) => ({
        organizationId: c.organizationId,
        generationId: c.generationId,
      }));
    } else {
      // Filter teritorial berdasarkan organisasi jadwal & generasi target
      const orgIds: string[] = [activeSchedule.organizationId];
      if (activeSchedule.tierLevel === 'DESA') {
        const subOrgs = await prisma.organization.findMany({
          where: { parentId: activeSchedule.organizationId },
          select: { id: true },
        });
        orgIds.push(...subOrgs.map((o) => o.id));
      } else if (activeSchedule.tierLevel === 'DAERAH') {
        const desaOrgs = await prisma.organization.findMany({
          where: { parentId: activeSchedule.organizationId },
          select: { id: true },
        });
        const desaIds = desaOrgs.map((o) => o.id);
        orgIds.push(...desaIds);
        if (desaIds.length > 0) {
          const kelompokOrgs = await prisma.organization.findMany({
            where: { parentId: { in: desaIds } },
            select: { id: true },
          });
          orgIds.push(...kelompokOrgs.map((o) => o.id));
        }
      }

      studentWhere.organizationId = { in: orgIds };

      if (activeSchedule.targetGenerations && activeSchedule.targetGenerations.length > 0) {
        studentWhere.generationId = {
          in: activeSchedule.targetGenerations.map((g) => g.generationId),
        };
      }
    }

    // Kumpulkan generasi target yang relevan dengan jadwal ini
    const relevantGenerationIds = new Set<string>();
    if (activeSchedule.targetGenerations && activeSchedule.targetGenerations.length > 0) {
      activeSchedule.targetGenerations.forEach((g) => relevantGenerationIds.add(g.generationId));
    }
    targetClassesList.forEach((c) => {
      if (c.generationId) relevantGenerationIds.add(c.generationId);
    });

    // Organisasi yang relevan dengan jadwal pengajian ini (Kelompok & Desa induk)
    const relevantOrgIds: string[] = [];
    if (activeSchedule.organizationId) {
      relevantOrgIds.push(activeSchedule.organizationId);
    }
    if (activeSchedule.organization?.parentId) {
      relevantOrgIds.push(activeSchedule.organization.parentId);
    }

    const scheduledMaterialIds = activeSchedule.scheduleMaterials.map((sm) => sm.materialId);
    const hasScheduledMaterials = scheduledMaterialIds.length > 0;

    // Filter materi yang relevan secara presisi agar tidak memuat seluruh kurikulum yang tidak terkait
    let materialWhere: any;
    if (hasScheduledMaterials) {
      // Prioritaskan materi yang telah dijadwalkan pada sesi ini
      materialWhere = {
        isActive: true,
        id: { in: scheduledMaterialIds },
      };
    } else if (relevantGenerationIds.size > 0) {
      // Jika tidak ada materi terjadwal spesifik, ambil materi yang sesuai dengan jenjang generasi kelas ini
      materialWhere = {
        isActive: true,
        targetGenerationId: { in: Array.from(relevantGenerationIds) },
        OR: [
          { organizationId: null },
          { creatorTierLevel: 'DAERAH' },
          ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
        ],
      };
    } else {
      // Fallback umum
      materialWhere = {
        isActive: true,
        OR: [
          { organizationId: null },
          { creatorTierLevel: 'DAERAH' },
          ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
        ],
      };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Ambil daftar santri, sesi pengajian hari ini, seluruh jenjang, & materi kurikulum secara paralel
    const [classStudents, todaySchedules, allGenerations, totalMaterialsCount, rawMaterials] =
      await Promise.all([
        prisma.user.findMany({
          where: studentWhere,
          select: {
            id: true,
            fullName: true,
            organizationId: true,
            generationId: true,
            generation: { select: { id: true, name: true, code: true } },
          },
          orderBy: { fullName: 'asc' },
        }),
        prisma.schedule.findMany({
          where: {
            status: { in: ['ACTIVE', 'SCHEDULED'] },
            startTime: { gte: startOfToday, lte: endOfToday },
            OR: [
              { teachers: { some: { teacherId: authUser.id } } },
              ...(userProfile.organizationId ? [{ organizationId: userProfile.organizationId }] : []),
            ],
          },
          orderBy: { startTime: 'asc' },
          include: {
            class: { select: { name: true } },
          },
        }),
        prisma.generation.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { code: 'asc' },
        }),
        hasScheduledMaterials
          ? Promise.resolve(scheduledMaterialIds.length)
          : prisma.material.count({ where: materialWhere }),
        prisma.material.findMany({
          where: materialWhere,
          take: hasScheduledMaterials ? undefined : 5,
          include: {
            targetGeneration: {
              select: { id: true, name: true, code: true },
            },
            checklistItems: {
              where: {
                OR: [
                  { organizationId: null },
                  { tierLevel: 'DAERAH' },
                  ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
                ],
              },
              orderBy: { orderIndex: 'asc' },
            },
            customizations: {
              where:
                relevantOrgIds.length > 0
                  ? {
                      organizationId: { in: relevantOrgIds },
                    }
                  : undefined,
            },
          },
          orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

    // Smart default absence: Hanya tambahkan santri yang belum memiliki attendanceRecord (Zero extra queries jika sudah lengkap)
    if (session) {
      const existingStudentIdSet = new Set((session.records || []).map((r: any) => r.studentId));
      const missingStudents = classStudents.filter((s) => !existingStudentIdSet.has(s.id));

      if (missingStudents.length > 0) {
        await prisma.attendanceRecord.createMany({
          data: missingStudents.map((s) => ({
            sessionId: session.id,
            studentId: s.id,
            method: AttendanceMethod.MANUAL_TEACHER,
            status: AttendanceStatus.ALPA,
            notes: 'Status awal presensi sesi (Belum hadir)',
          })),
          skipDuplicates: true,
        });

        const refreshedRecords = await prisma.attendanceRecord.findMany({
          where: { sessionId: session.id },
          include: {
            absenceConfirmation: {
              include: {
                parent: {
                  select: { fullName: true },
                },
              },
            },
          },
        });
        session.records = refreshedRecords;
      }
    }

    const initialHasMore = hasScheduledMaterials ? false : totalMaterialsCount > rawMaterials.length;

    const relevantChecklistItemIds: string[] = [];
    rawMaterials.forEach((m) => {
      m.checklistItems.forEach((ci) => relevantChecklistItemIds.push(ci.id));
    });

    const studentIds = classStudents.map((s) => s.id);
    const existingChecklistProgress =
      studentIds.length > 0 && relevantChecklistItemIds.length > 0
        ? await prisma.materialChecklistProgress.findMany({
            where: {
              studentId: { in: studentIds },
              checklistItemId: { in: relevantChecklistItemIds },
            },
            select: {
              checklistItemId: true,
              studentId: true,
              score: true,
              isCompleted: true,
              teacherFeedback: true,
              evaluatedAt: true,
            },
          })
        : [];

    // Lakukan penyesuaian materi dan butir capaian berdasarkan tingkat pengajian jadwal (Kelompok, Desa, atau Daerah)
    const baseResolvedMaterials = resolveMaterialsForSchedule(rawMaterials, {
      scheduleTierLevel: activeSchedule.tierLevel,
      scheduleOrganizationId: activeSchedule.organizationId,
      parentOrganizationId: activeSchedule.organization?.parentId || null,
      scheduleOrganizationName: activeSchedule.organization?.name || '',
      parentOrganizationName: activeSchedule.organization?.parent?.name || '',
    });

    const scheduleMaterialMap = new Map<string, number>();
    activeSchedule.scheduleMaterials.forEach((sm) => {
      scheduleMaterialMap.set(sm.materialId, sm.slotIndex);
    });

    const resolvedMaterials = baseResolvedMaterials
      .map((m) => {
        const isScheduled = scheduleMaterialMap.has(m.id);
        const slotIndex = scheduleMaterialMap.get(m.id);
        return {
          ...m,
          isScheduled,
          slotIndex: isScheduled ? slotIndex : undefined,
        };
      })
      .sort((a, b) => {
        if (a.isScheduled && !b.isScheduled) return -1;
        if (!a.isScheduled && b.isScheduled) return 1;
        if (a.isScheduled && b.isScheduled) {
          return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
        }
        return 0;
      });

    const canCompleteDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
    const canCompleteDesa = roleCodes.includes('PJ_DESA') || canCompleteDaerah;

    const availableSchedulesProp = todaySchedules.map((s) => ({
      id: s.id,
      title: s.title,
      startTime: new Date(s.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(s.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      className: s.class?.name,
      venueName: s.venuePlaceName || undefined,
      tierLevel: s.tierLevel,
    }));

    if (activeSchedule && !availableSchedulesProp.some((s) => s.id === activeSchedule.id)) {
      availableSchedulesProp.unshift({
        id: activeSchedule.id,
        title: activeSchedule.title,
        startTime: new Date(activeSchedule.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(activeSchedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        className: activeSchedule.class?.name,
        venueName: activeSchedule.venuePlaceName || undefined,
        tierLevel: activeSchedule.tierLevel,
      });
    }

    // Tanggal jadwal terformat
    const scheduleDate = new Date(activeSchedule.startTime).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Tentukan daftar seluruh pengajar sesi (utama, pendamping, badal)
    const teachersList = activeSchedule.teachers.map((t) => ({
      id: t.teacherId,
      name: t.teacher.fullName,
      isPrimary: t.isPrimary,
      isSubstitute: t.isSubstitute,
    }));

    if (teachersList.length === 0 && userProfile) {
      teachersList.push({
        id: userProfile.id,
        name: userProfile.fullName,
        isPrimary: true,
        isSubstitute: false,
      });
    }

    const currentScheduleTeacher = activeSchedule.teachers.find((t) => t.teacherId === userProfile.id);
    const primaryScheduleTeacher = activeSchedule.teachers.find((t) => t.isPrimary) || activeSchedule.teachers[0];
    const teacherInfo = currentScheduleTeacher
      ? {
          name: currentScheduleTeacher.teacher.fullName,
          isSubstitute: currentScheduleTeacher.isSubstitute,
        }
      : primaryScheduleTeacher
      ? {
          name: primaryScheduleTeacher.teacher.fullName,
          isSubstitute: primaryScheduleTeacher.isSubstitute,
        }
      : userProfile
      ? {
          name: userProfile.fullName,
          isSubstitute: false,
        }
      : undefined;

    const studentItems = classStudents.map((s) => {
      const record = session?.records.find((r: any) => r.studentId === s.id);
      const matchedClass = targetClassesList.find(
        (c) => c.organizationId === s.organizationId && c.generationId === s.generationId
      );

      return {
        id: s.id,
        fullName: s.fullName,
        generationId: s.generationId || undefined,
        generationName: s.generation?.name || 'Santri',
        classId: matchedClass?.id,
        className: matchedClass?.name,
        currentStatus: record ? record.status : AttendanceStatus.ALPA,
        method: record?.method,
        notes: record?.notes,
        checkInTime: record?.checkInTime
          ? new Date(record.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : null,
        absenceConfirmation: record?.absenceConfirmation
          ? {
              id: record.absenceConfirmation.id,
              status: record.absenceConfirmation.status,
              reasonType: record.absenceConfirmation.reasonType,
              parentNotes: record.absenceConfirmation.parentNotes,
              attachmentUrl: record.absenceConfirmation.attachmentUrl,
              parentName: record.absenceConfirmation.parent?.fullName || null,
              confirmedAt: record.absenceConfirmation.confirmedAt
                ? record.absenceConfirmation.confirmedAt.toISOString()
                : null,
            }
          : null,
      };
    });

    const classesProp = targetClassesList.map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <ClassroomCockpit
          key={activeSchedule.id}
          sessionId={session.id}
          scheduleId={activeSchedule.id}
          scheduleTitle={activeSchedule.title}
          scheduleTierLevel={activeSchedule.tierLevel}
          organizationName={activeSchedule.organization?.name}
          venueName={activeSchedule.venuePlaceName}
          scheduleDate={scheduleDate}
          startTime={new Date(activeSchedule.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          endTime={new Date(activeSchedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          students={studentItems}
          materials={resolvedMaterials}
          initialTotalMaterials={totalMaterialsCount}
          initialHasMore={initialHasMore}
          generations={allGenerations}
          initialProgress={existingChecklistProgress.map((p) => ({
            checklistItemId: p.checklistItemId,
            studentId: p.studentId,
            score: p.score,
            isCompleted: p.isCompleted,
            teacherFeedback: p.teacherFeedback,
            evaluatedAt: p.evaluatedAt.toISOString(),
          }))}
          canCompleteDaerah={canCompleteDaerah}
          canCompleteDesa={canCompleteDesa}
          availableSchedules={availableSchedulesProp}
          isSessionActive={isSessionActive}
          closedAt={session.closedAt ? session.closedAt.toISOString() : null}
          initialQrPayload={initialQrPayload}
          classes={classesProp}
          teacherInfo={teacherInfo}
          teachersList={teachersList}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SANTRI -> STUDENT QR SCANNER & KARTU DIGITAL SAYA
  // =========================================================================
  if (isSantri) {
    const userOrgIds = [
      userProfile.organizationId,
      userProfile.organization?.parentId,
    ].filter(Boolean) as string[];

    const sessionInclude = {
      attendanceSessions: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        include: {
          records: {
            where: { studentId: userProfile.id },
          },
        },
      },
    };

    let activeSchedule: any = null;

    if (requestedScheduleId) {
      activeSchedule = await prisma.schedule.findUnique({
        where: { id: requestedScheduleId },
        include: sessionInclude,
      });
    } else {
      const studentClasses = await prisma.class.findMany({
        where: {
          generationId: userProfile.generationId || undefined,
          OR: [
            { organizationId: userProfile.organizationId || undefined },
            { organizationId: userProfile.organization?.parentId || undefined },
          ],
        },
        select: { id: true },
      });
      const studentClassIds = studentClasses.map((c) => c.id);

      activeSchedule = await prisma.schedule.findFirst({
        where: {
          status: { in: ['ACTIVE', 'SCHEDULED'] },
          organizationId: { in: userOrgIds },
          OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
          AND: [
            {
              OR: [
                ...(studentClassIds.length > 0
                  ? [
                      { classId: { in: studentClassIds } },
                      { targetClasses: { some: { classId: { in: studentClassIds } } } },
                    ]
                  : []),
                ...(userProfile.generationId
                  ? [
                      { targetGenerations: { some: { generationId: userProfile.generationId } } },
                      { class: { generationId: userProfile.generationId } },
                    ]
                  : []),
                {
                  classId: null,
                  targetClasses: { none: {} },
                  targetGenerations: { none: {} },
                },
              ],
            },
          ],
        },
        orderBy: { startTime: 'asc' },
        include: sessionInclude,
      });
    }

    // Cek apakah santri sudah diabsen pada jadwal aktif ini
    let isAlreadyPresent = false;
    let checkInTimeStr: string | null = null;

    if (activeSchedule) {
      const session = activeSchedule.attendanceSessions?.[0];
      const myRecord = session?.records?.[0];
      if (myRecord && (myRecord.status === 'HADIR' || myRecord.status === 'TERLAMBAT')) {
        isAlreadyPresent = true;
        checkInTimeStr = myRecord.checkInTime
          ? new Date(myRecord.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : null;
      }
    }

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <StudentQrScanner
          studentId={userProfile.id}
          studentName={userProfile.fullName}
          generationName={userProfile.generation?.name || 'Santri'}
          organizationName={userProfile.organization?.name || 'Kelompok Pengajian'}
          activeSchedule={
            activeSchedule
              ? {
                  id: activeSchedule.id,
                  title: activeSchedule.title,
                  venuePlaceName: activeSchedule.venuePlaceName,
                  startTime: new Date(activeSchedule.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  endTime: new Date(activeSchedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                }
              : null
          }
          isAlreadyPresent={isAlreadyPresent}
          checkInTime={checkInTimeStr}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ORANG TUA -> LIVE MONITORING KEHADIRAN ANAK
  // =========================================================================
  if (isOrangTua) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const children = userProfile.children || [];
    const childStudentIds = children.map((c) => c.student.id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Kueri batch paralel untuk semua anak (Zero N+1):
    // 1. Batch seluruh catatan presensi 30 hari untuk seluruh anak
    // 2. Kueri riwayat surat izin orang tua langsung (bypassing redundant Supabase auth)
    // 3. Batch kelas untuk seluruh anak
    const [allPastRecords, absenceHistory, allClasses] = await Promise.all([
      childStudentIds.length > 0
        ? prisma.attendanceRecord.findMany({
            where: {
              studentId: { in: childStudentIds },
              createdAt: { gte: thirtyDaysAgo },
            },
            select: {
              studentId: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      getParentAbsenceHistory(undefined, userProfile.id),
      children.length > 0
        ? prisma.class.findMany({
            where: {
              OR: children.map((c) => ({
                generationId: c.student.generationId || undefined,
                organizationId: {
                  in: [c.student.organizationId, c.student.organization?.parentId].filter(Boolean) as string[],
                },
              })),
            },
            select: { id: true, name: true, generationId: true, organizationId: true },
          })
        : Promise.resolve([]),
    ]);

    // Grouping past records by studentId in memory (O(1) fast lookup)
    const pastRecordsByStudent = new Map<string, Array<{ status: string }>>();
    for (const rec of allPastRecords) {
      const list = pastRecordsByStudent.get(rec.studentId) || [];
      list.push(rec);
      pastRecordsByStudent.set(rec.studentId, list);
    }

    const childrenDataList: ChildAttendanceSummary[] = await Promise.all(
      children.map(async (c) => {
        const student = c.student;

        // Ambil kelas santri dari allClasses di memory
        const studentOrgIds = [student.organizationId, student.organization?.parentId].filter(Boolean) as string[];
        const studentClasses = allClasses.filter(
          (cls) =>
            (!cls.generationId || cls.generationId === student.generationId) &&
            cls.organizationId &&
            studentOrgIds.includes(cls.organizationId)
        );
        const studentClass = studentClasses[0];
        const studentClassIds = studentClasses.map((cls) => cls.id);

        const scheduleWhere: any = {
          status: { in: ['ACTIVE', 'SCHEDULED', 'COMPLETED'] },
          startTime: { gte: startOfDay, lte: endOfDay },
          organizationId: { in: studentOrgIds },
          OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
          AND: [
            {
              OR: [
                ...(studentClassIds.length > 0
                  ? [
                      { classId: { in: studentClassIds } },
                      { targetClasses: { some: { classId: { in: studentClassIds } } } },
                    ]
                  : []),
                ...(student.generationId
                  ? [
                      { targetGenerations: { some: { generationId: student.generationId } } },
                      { class: { generationId: student.generationId } },
                    ]
                  : []),
                {
                  classId: null,
                  targetClasses: { none: {} },
                  targetGenerations: { none: {} },
                },
              ],
            },
          ],
        };

        const todaySchedule = await prisma.schedule.findFirst({
          where: scheduleWhere,
          orderBy: { startTime: 'asc' },
          include: {
            teachers: {
              include: {
                teacher: { select: { fullName: true } },
              },
            },
            scheduleMaterials: {
              include: {
                material: { select: { title: true } },
              },
            },
            attendanceSessions: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                records: {
                  where: { studentId: student.id },
                },
              },
            },
          },
        });

        // Catatan kehadiran hari ini pada sesi aktif/terjadwal tersebut
        let todayAttendanceStatus: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA' | 'NOT_STARTED' =
          'NOT_STARTED';
        let todayCheckInTime: string | null = null;
        let todayNotes: string | null = null;
        let childScheduleInfo: ChildScheduleInfo | null = null;

        if (todaySchedule) {
          const primaryTeacher =
            todaySchedule.teachers.find((t) => t.isPrimary) || todaySchedule.teachers[0];

          childScheduleInfo = {
            scheduleId: todaySchedule.id,
            scheduleTitle: todaySchedule.title,
            startTime: new Date(todaySchedule.startTime).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            endTime: new Date(todaySchedule.endTime).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            venueName: todaySchedule.venuePlaceName,
            teacherName: primaryTeacher?.teacher?.fullName,
            isSubstitute: primaryTeacher?.isSubstitute,
            status: todaySchedule.status as 'ACTIVE' | 'SCHEDULED' | 'COMPLETED',
            materialTitles: todaySchedule.scheduleMaterials.map((sm) => sm.material.title),
          };

          const session = todaySchedule.attendanceSessions?.[0];
          const record = session?.records?.[0];
          if (record) {
            todayAttendanceStatus = record.status as any;
            todayNotes = record.notes;
            todayCheckInTime = record.checkInTime
              ? new Date(record.checkInTime).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;
          } else if (todaySchedule.status === 'ACTIVE') {
            todayAttendanceStatus = 'ALPA';
          }
        }

        // Statistik 30 hari dari in-memory group
        const pastRecords = pastRecordsByStudent.get(student.id) || [];
        const totalSessions = pastRecords.length;
        const hadirCount = pastRecords.filter(
          (r) => r.status === 'HADIR' || r.status === 'TERLAMBAT'
        ).length;
        const izinCount = pastRecords.filter((r) => r.status === 'IZIN').length;
        const sakitCount = pastRecords.filter((r) => r.status === 'SAKIT').length;
        const alpaCount = pastRecords.filter((r) => r.status === 'ALPA').length;
        const attendanceRate = totalSessions > 0 ? Math.round((hadirCount / totalSessions) * 100) : 100;

        return {
          id: student.id,
          fullName: student.fullName,
          generationName: student.generation?.name || 'Santri',
          className: studentClass?.name,
          organizationName: student.organization?.name,
          todaySchedule: childScheduleInfo,
          todayAttendanceStatus,
          todayCheckInTime,
          todayNotes,
          monthlyStats: {
            totalSessions,
            hadirCount,
            izinCount,
            sakitCount,
            alpaCount,
            attendanceRate,
          },
        };
      })
    );

    const preselectedScheduleId = typeof resolvedParams.scheduleId === 'string' ? resolvedParams.scheduleId : undefined;
    const preselectedStudentId = typeof resolvedParams.studentId === 'string' ? resolvedParams.studentId : undefined;
    const initialActiveTab = resolvedParams.tab === 'leave' ? 'leave' : 'monitor';

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
        <ParentAttendanceMonitor
          childrenData={childrenDataList}
          initialAbsenceHistory={absenceHistory}
          preselectedScheduleId={preselectedScheduleId}
          preselectedStudentId={preselectedStudentId}
          initialTab={initialActiveTab}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: PJ WILAYAH / ADMIN -> AGREGAT KEHADIRAN WILAYAH
  // =========================================================================
  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile.organizationId);

  const activeSessions = await prisma.attendanceSession.findMany({
    where: {
      isActive: true,
      ...(scopedOrgIds ? { schedule: { organizationId: { in: scopedOrgIds } } } : {}),
    },
    include: {
      schedule: true,
      records: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Pusat Kendali Presensi Teritorial</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring aktivitas sesi pengajian dan tingkat kehadiran santri di seluruh kelompok binaan.
          </p>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-slate-50 border border-slate-200">
            Tidak ada sesi pengajian yang sedang aktif saat ini di wilayah Anda.
          </div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    LIVE AKTIF 🟢
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-1">{s.schedule.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.schedule.venuePlaceName || 'Masjid'}</div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold text-slate-700">
                    {s.records.length} Santri Tercatat
                  </span>
                  <Link
                    href={`/presensi?scheduleId=${s.schedule.id}`}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    Buka Cockpit
                  </Link>
                  <Link
                    href={`/jadwal/${s.schedule.id}`}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Rincian
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
