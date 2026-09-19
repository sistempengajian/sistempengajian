import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import ScheduleDetailView, {
  ScheduleProgressData,
  ClassProgressBreakdown,
  ScheduleMaterialProgress,
  ScheduleChecklistItemProgress,
  StudentPersonalData,
  StudentPersonalMaterialProgress,
  StudentPersonalChecklistItemProgress,
} from '@/components/jadwal/detail/ScheduleDetailView';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const schedule = await prisma.schedule.findUnique({
    where: { id: resolvedParams.id },
    select: { title: true },
  });

  if (!schedule) {
    return {
      title: 'Jadwal Tidak Ditemukan | Sistem Pengajian',
    };
  }

  return {
    title: `${schedule.title} - Rincian Jadwal | Sistem Pengajian`,
    description: `Rincian lengkap sesi pengajian ${schedule.title}, materi kurikulum, pengajar, dan presensi santri.`,
  };
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Ambil data profil pengguna & perannya
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      organization: true,
      children: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              organizationId: true,
              generationId: true,
            },
          },
        },
      },
    },
  });

  if (!userProfile) {
    redirect('/login');
  }

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isPjDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isManager = isPjDaerah || isPjDesa || isPjKelompok;

  let userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null = null;
  if (isPjDaerah) userTierLevel = 'DAERAH';
  else if (isPjDesa) userTierLevel = 'DESA';
  else if (isPjKelompok) userTierLevel = 'KELOMPOK';
  else if (userProfile.organization?.type) userTierLevel = userProfile.organization.type as any;

  // 2. Ambil data rincian jadwal lengkap
  const schedule = await prisma.schedule.findUnique({
    where: { id: resolvedParams.id },
    include: {
      teachers: {
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { isSubstitute: 'asc' }],
      },
      organization: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
      class: {
        include: {
          generation: true,
          homeroomTeacher: { select: { id: true, fullName: true } },
        },
      },
      targetClasses: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              tierLevel: true,
              organizationId: true,
              generationId: true,
              homeroomTeacherId: true,
              generation: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
      targetGenerations: {
        include: {
          generation: {
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
            },
          },
        },
      },
      scheduleMaterials: {
        include: {
          material: {
            include: {
              targetGeneration: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              checklistItems: {
                select: {
                  id: true,
                  itemTitle: true,
                  description: true,
                  completionTierLevel: true,
                  pointsWeight: true,
                  orderIndex: true,
                },
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
            select: {
              id: true,
              status: true,
              studentId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      rollingPengajian: {
        select: {
          id: true,
          name: true,
          tierLevel: true,
        },
      },
    },
  });

  if (!schedule) {
    notFound();
  }

  // Cek hak akses granular
  const isAssignedTeacher = schedule.teachers.some((t) => t.teacherId === user.id);
  const isHomeroomTeacher =
    schedule.class?.homeroomTeacherId === user.id ||
    schedule.targetClasses.some((tc) => tc.class?.homeroomTeacherId === user.id);
  const isOwnerOfProposal = schedule.requestedByUserId === user.id;
  const isPendingProposal = schedule.approvalStatus === 'PENDING';

  const canManage = isManager;
  const canDelegateBadal = isManager || isAssignedTeacher || isHomeroomTeacher;
  const canEdit = isManager || (isOwnerOfProposal && isPendingProposal);
  const canDelete = isManager || (isOwnerOfProposal && isPendingProposal);
  const canApprove = isManager && isPendingProposal;

  const isStaffOrTeacher = isManager || isAssignedTeacher || isHomeroomTeacher;
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPersonalView = !isStaffOrTeacher && (isSantri || isOrangTua);

  let userRoleCategory: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ' = 'TEACHER';
  if (isPersonalView) {
    userRoleCategory = isSantri ? 'SANTRI' : 'ORANG_TUA';
  } else if (isManager) {
    userRoleCategory = 'PJ';
  }

  // Jika ada requestedByUserId, cari info pemohon
  let requestedByUser = null;
  if (schedule.requestedByUserId) {
    requestedByUser = await prisma.user.findUnique({
      where: { id: schedule.requestedByUserId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
      },
    });
  }

  // 3. Ambil data pendukung untuk modal edit jika pengguna berhak mengedit
  const needFormData = canManage || canEdit;
  const [teachers, classes, materials, generations, scopedOrganizations] = await Promise.all([
    needFormData
      ? prisma.user.findMany({
          where: {
            roles: {
              some: {
                role: {
                  in: [
                    'PENGAJAR',
                    'WALI_KELAS',
                    'PJ_KELOMPOK',
                    'PJ_DESA',
                    'PJ_DAERAH',
                    'ADMIN_MASTER',
                  ],
                },
              },
            },
          },
          select: {
            id: true,
            fullName: true,
          },
          orderBy: { fullName: 'asc' },
        })
      : Promise.resolve([]),
    needFormData
      ? prisma.class.findMany({
          select: {
            id: true,
            name: true,
            tierLevel: true,
            organizationId: true,
            generation: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    needFormData
      ? prisma.material.findMany({
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            targetGeneration: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { title: 'asc' },
        })
      : Promise.resolve([]),
    needFormData
      ? prisma.generation.findMany({
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
          orderBy: { minAge: 'asc' },
        })
      : Promise.resolve([]),
    needFormData
      ? (async () => {
          const sOrgIds = await getScopedOrganizationIds(
            roleCodes,
            userProfile?.organizationId || null
          );
          return prisma.organization.findMany({
            where: sOrgIds !== null ? { id: { in: sOrgIds } } : {},
            select: {
              id: true,
              name: true,
              type: true,
              parentId: true,
            },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          });
        })()
      : Promise.resolve([]),
  ]);

  // 4. Hitung capaian & progres kurikulum materi
  const rawTargetClasses: Array<{
    id: string;
    name: string;
    organizationId: string;
    generationId: string;
  }> = [];

  if (schedule.targetClasses && schedule.targetClasses.length > 0) {
    schedule.targetClasses.forEach((tc) => {
      if (tc.class) {
        rawTargetClasses.push({
          id: tc.class.id,
          name: tc.class.name,
          organizationId: tc.class.organizationId,
          generationId: tc.class.generationId,
        });
      }
    });
  } else if (schedule.class) {
    rawTargetClasses.push({
      id: schedule.class.id,
      name: schedule.class.name,
      organizationId: schedule.class.organizationId,
      generationId: schedule.class.generationId,
    });
  }

  // Ambil materi kurikulum dari jadwal
  const scheduleMaterialsList = (schedule.scheduleMaterials || [])
    .map((sm) => sm.material)
    .filter(Boolean);

  const allChecklistItemIds = scheduleMaterialsList.flatMap(
    (m) => m.checklistItems?.map((c: any) => c.id) || []
  );

  // Hitung seluruh santri sasaran jadwal (untuk ringkasan presensi & agregat materi)
  let allTargetStudentIds: string[] = [];
  const classStudentsMap = new Map<string, string[]>();

  if (rawTargetClasses.length > 0) {
    const classConditions = rawTargetClasses.map((cls) => ({
      organizationId: cls.organizationId,
      generationId: cls.generationId,
    }));

    const students = await prisma.user.findMany({
      where: {
        roles: { some: { role: 'SANTRI' } },
        OR: classConditions,
      },
      select: {
        id: true,
        organizationId: true,
        generationId: true,
      },
    });

    rawTargetClasses.forEach((cls) => {
      const classStudentIds = students
        .filter(
          (s) => s.organizationId === cls.organizationId && s.generationId === cls.generationId
        )
        .map((s) => s.id);
      classStudentsMap.set(cls.id, classStudentIds);
    });

    allTargetStudentIds = Array.from(new Set(students.map((s) => s.id)));
  } else if (schedule.targetScope === 'GENERASI' && schedule.targetGenerations?.length > 0) {
    const genIds = schedule.targetGenerations.map((tg: any) => tg.generation.id);
    const orgId = schedule.organizationId;
    const orgConditions: any[] = [];
    if (orgId) {
      if (schedule.organization?.type === 'DESA') {
        const childOrgs = await prisma.organization.findMany({
          where: { parentId: orgId },
          select: { id: true },
        });
        orgConditions.push({ organizationId: { in: [orgId, ...childOrgs.map((c) => c.id)] } });
      } else {
        orgConditions.push({ organizationId: orgId });
      }
    }

    const students = await prisma.user.findMany({
      where: {
        generationId: { in: genIds },
        roles: { some: { role: 'SANTRI' } },
        ...(orgConditions.length > 0 ? { OR: orgConditions } : {}),
      },
      select: { id: true },
    });
    allTargetStudentIds = students.map((s) => s.id);
  } else {
    // WILAYAH_UMUM / fallback
    const orgId = schedule.organizationId;
    if (orgId) {
      const orgIds = [orgId];
      if (schedule.organization?.type === 'DESA') {
        const childOrgs = await prisma.organization.findMany({
          where: { parentId: orgId },
          select: { id: true },
        });
        orgIds.push(...childOrgs.map((c) => c.id));
      }
      const students = await prisma.user.findMany({
        where: {
          organizationId: { in: orgIds },
          roles: { some: { role: 'SANTRI' } },
        },
        select: { id: true },
      });
      allTargetStudentIds = students.map((s) => s.id);
    }
  }

  let progressData: ScheduleProgressData;

  if (isPersonalView) {
    // Mode Capaian Personal (Santri / Orang Tua)
    const personalStudents: Array<{
      id: string;
      fullName: string;
      avatarUrl?: string | null;
    }> = [];

    if (isSantri) {
      personalStudents.push({
        id: userProfile.id,
        fullName: userProfile.fullName,
        avatarUrl: userProfile.avatarUrl,
      });
    }

    if (isOrangTua && userProfile.children && userProfile.children.length > 0) {
      const childStudents = userProfile.children
        .map((c) => c.student)
        .filter(Boolean);

      let relevantChildren = childStudents;
      if (rawTargetClasses.length > 0) {
        const matched = childStudents.filter((cs) =>
          rawTargetClasses.some(
            (tc) => tc.organizationId === cs.organizationId && tc.generationId === cs.generationId
          )
        );
        if (matched.length > 0) relevantChildren = matched;
      } else if (schedule.targetScope === 'GENERASI' && schedule.targetGenerations?.length > 0) {
        const genIds = new Set(schedule.targetGenerations.map((tg: any) => tg.generation.id));
        const matched = childStudents.filter((cs) => cs.generationId && genIds.has(cs.generationId));
        if (matched.length > 0) relevantChildren = matched;
      }

      for (const cs of relevantChildren) {
        if (!personalStudents.some((p) => p.id === cs.id)) {
          personalStudents.push({
            id: cs.id,
            fullName: cs.fullName,
            avatarUrl: cs.avatarUrl,
          });
        }
      }
    }

    if (personalStudents.length === 0) {
      personalStudents.push({
        id: userProfile.id,
        fullName: userProfile.fullName,
        avatarUrl: userProfile.avatarUrl,
      });
    }

    const personalStudentIds = personalStudents.map((s) => s.id);

    let personalProgressRecords: Array<{
      checklistItemId: string;
      studentId: string;
      score: number | null;
      teacherFeedback: string | null;
      feedbackTags: string[];
      isCompleted: boolean;
      evaluatedAt: Date;
    }> = [];

    if (personalStudentIds.length > 0 && allChecklistItemIds.length > 0) {
      personalProgressRecords = await prisma.materialChecklistProgress.findMany({
        where: {
          checklistItemId: { in: allChecklistItemIds },
          studentId: { in: personalStudentIds },
        },
        select: {
          checklistItemId: true,
          studentId: true,
          score: true,
          teacherFeedback: true,
          feedbackTags: true,
          isCompleted: true,
          evaluatedAt: true,
        },
      });
    }

    const studentsPersonal: StudentPersonalData[] = personalStudents.map((st) => {
      const materialsProgress: Record<string, StudentPersonalMaterialProgress> = {};

      for (const mat of scheduleMaterialsList) {
        const items = mat.checklistItems || [];
        const totalItems = items.length;
        let completedItems = 0;
        const scores: number[] = [];
        const checklistItemsMap: Record<string, StudentPersonalChecklistItemProgress> = {};

        for (const item of items) {
          const rec = personalProgressRecords.find(
            (p) => p.checklistItemId === item.id && p.studentId === st.id
          );

          const isCompleted = Boolean(rec?.isCompleted);
          const score = typeof rec?.score === 'number' && rec.score > 0 ? rec.score : null;
          if (isCompleted) {
            completedItems++;
            if (score !== null) {
              scores.push(score);
            }
          }

          checklistItemsMap[item.id] = {
            checklistItemId: item.id,
            isCompleted,
            score: isCompleted ? score : null,
            teacherFeedback: rec?.teacherFeedback || null,
            feedbackTags: rec?.feedbackTags || [],
            evaluatedAt: rec?.evaluatedAt ? rec.evaluatedAt.toISOString() : null,
          };
        }

        const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        const averageScore =
          scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const isMaterialCompleted = totalItems > 0 && completedItems >= totalItems;

        materialsProgress[mat.id] = {
          materialId: mat.id,
          totalItems,
          completedItems,
          percentage,
          averageScore,
          isCompleted: isMaterialCompleted,
          checklistItems: checklistItemsMap,
        };
      }

      return {
        studentId: st.id,
        studentName: st.fullName,
        avatarUrl: st.avatarUrl,
        materialsProgress,
      };
    });

    progressData = {
      mode: 'PERSONAL',
      totalTargetStudents: allTargetStudentIds.length,
      studentsPersonal,
      activeStudentId: studentsPersonal[0]?.studentId,
      userRoleCategory,
    };
  } else {
    // Mode Kolektif (Pengajar / Wali Kelas / PJ / Admin)
    let allProgressRecords: Array<{
      checklistItemId: string;
      studentId: string;
      score: number | null;
      isCompleted: boolean;
    }> = [];

    if (allTargetStudentIds.length > 0 && allChecklistItemIds.length > 0) {
      allProgressRecords = await prisma.materialChecklistProgress.findMany({
        where: {
          checklistItemId: { in: allChecklistItemIds },
          studentId: { in: allTargetStudentIds },
        },
        select: {
          checklistItemId: true,
          studentId: true,
          score: true,
          isCompleted: true,
        },
      });
    }

    function computeMaterialsProgress(
      studentIds: string[]
    ): Record<string, ScheduleMaterialProgress> {
      const studentSet = new Set(studentIds);
      const N = studentIds.length;
      const result: Record<string, ScheduleMaterialProgress> = {};

      for (const mat of scheduleMaterialsList) {
        const items = mat.checklistItems || [];
        const totalItems = items.length;
        const checklistItemsProgress: Record<string, ScheduleChecklistItemProgress> = {};

        if (N === 0 || totalItems === 0) {
          for (const item of items) {
            checklistItemsProgress[item.id] = {
              checklistItemId: item.id,
              totalStudents: N,
              completedCount: 0,
              percentage: 0,
              averageScore: 0,
            };
          }
          result[mat.id] = {
            materialId: mat.id,
            totalItems,
            completedItemsSum: 0,
            totalPossibleCompletions: totalItems * N,
            percentage: 0,
            averageScore: 0,
            totalStudents: N,
            completedStudents: 0,
            checklistItemsProgress,
          };
          continue;
        }

        let completedItemsSum = 0;
        const allMaterialScores: number[] = [];
        const studentCompletedItemCounts = new Map<string, number>();

        for (const item of items) {
          const itemRecords = allProgressRecords.filter(
            (p) => p.checklistItemId === item.id && studentSet.has(p.studentId)
          );

          let itemCompletedCount = 0;
          const itemScores: number[] = [];

          for (const rec of itemRecords) {
            if (rec.isCompleted) {
              itemCompletedCount++;
              studentCompletedItemCounts.set(
                rec.studentId,
                (studentCompletedItemCounts.get(rec.studentId) || 0) + 1
              );
              // Hanya item yang tuntas dan memiliki skor valid yang dihitung
              if (typeof rec.score === 'number' && rec.score > 0) {
                itemScores.push(rec.score);
                allMaterialScores.push(rec.score);
              }
            }
          }

          completedItemsSum += itemCompletedCount;
          const itemPercentage = N > 0 ? Math.round((itemCompletedCount / N) * 100) : 0;
          const itemAvgScore =
            itemScores.length > 0
              ? Math.round(itemScores.reduce((a, b) => a + b, 0) / itemScores.length)
              : 0;

          checklistItemsProgress[item.id] = {
            checklistItemId: item.id,
            totalStudents: N,
            completedCount: itemCompletedCount,
            percentage: itemPercentage,
            averageScore: itemAvgScore,
          };
        }

        const totalPossibleCompletions = totalItems * N;
        const materialPercentage =
          totalPossibleCompletions > 0
            ? Math.round((completedItemsSum / totalPossibleCompletions) * 100)
            : 0;

        const materialAvgScore =
          allMaterialScores.length > 0
            ? Math.round(allMaterialScores.reduce((a, b) => a + b, 0) / allMaterialScores.length)
            : 0;

        let completedStudents = 0;
        for (const sId of studentIds) {
          if ((studentCompletedItemCounts.get(sId) || 0) >= totalItems) {
            completedStudents++;
          }
        }

        result[mat.id] = {
          materialId: mat.id,
          totalItems,
          completedItemsSum,
          totalPossibleCompletions,
          percentage: materialPercentage,
          averageScore: materialAvgScore,
          totalStudents: N,
          completedStudents,
          checklistItemsProgress,
        };
      }

      return result;
    }

    const combinedProgress = computeMaterialsProgress(allTargetStudentIds);

    const classesBreakdown: ClassProgressBreakdown[] = rawTargetClasses.map((cls) => {
      const classStudentIds = classStudentsMap.get(cls.id) || [];
      return {
        classId: cls.id,
        className: cls.name,
        totalStudents: classStudentIds.length,
        materialsProgress: computeMaterialsProgress(classStudentIds),
      };
    });

    progressData = {
      mode: 'COLLECTIVE',
      totalTargetStudents: allTargetStudentIds.length,
      combined: {
        totalStudents: allTargetStudentIds.length,
        scopeLabel:
          rawTargetClasses.length > 1
            ? `Seluruh Peserta Gabungan (${allTargetStudentIds.length} Santri)`
            : rawTargetClasses.length === 1
              ? rawTargetClasses[0].name
              : 'Seluruh Santri',
        materialsProgress: combinedProgress,
      },
      classesBreakdown,
      userRoleCategory,
    };
  }

  return (
    <ScheduleDetailView
      schedule={schedule}
      canManage={canManage}
      canDelegateBadal={canDelegateBadal}
      canEdit={canEdit}
      canDelete={canDelete}
      canApprove={canApprove}
      requestedByUser={requestedByUser}
      currentUserId={user.id}
      availableTeachers={teachers}
      availableClasses={classes as any}
      availableMaterials={materials as any}
      availableGenerations={generations as any}
      scopedOrganizations={scopedOrganizations as any}
      currentUserOrgId={userProfile.organizationId}
      userTierLevel={userTierLevel}
      roleCodes={roleCodes}
      progressData={progressData}
    />
  );
}
