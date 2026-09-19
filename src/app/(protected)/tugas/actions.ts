'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { TaskType, SubmissionStatus, TierLevel } from '@prisma/client';
import { generateMagicToken, verifyMagicToken } from '@/lib/magicToken';
import { processMediaPayload, deleteUnusedMedia, deleteTaskMedia, uploadTaskImage } from '@/lib/storage/mediaUploader';
import { parseMediaUrls } from '@/lib/habitParser';
import {
  parseAssignmentConfig,
  serializeAssignmentConfig,
  AssignmentConfig,
  formatTargetSasaranLabel,
} from '@/lib/assignmentConfig';

/**
 * Memeriksa apakah pengguna memiliki hak akses penuh untuk mengelola tugas
 * (Pembuat tugas, Superadmin, PJ Daerah, PJ Desa atas kelompok binaan, atau PJ Kelompok).
 */
export async function canUserManageAssignment(
  userProfile: {
    id: string;
    roles: { role: string }[];
    organizationId?: string | null;
  },
  assignment: {
    organizationId: string;
    teacherId: string;
  }
): Promise<boolean> {
  // 1. Pembuat tugas selalu berhak penuh
  if (assignment.teacherId === userProfile.id) return true;

  const roleCodes = userProfile.roles.map((r) => r.role);

  // 2. Superadmin atau PJ Daerah berhak penuh atas seluruh tugas di wilayahnya / sistem
  if (roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH')) {
    return true;
  }

  const userOrgId = userProfile.organizationId;
  if (!userOrgId) return false;

  // 3. Tugas berada di organisasi yang sama dengan PJ
  if (assignment.organizationId === userOrgId) {
    if (roleCodes.includes('PJ_DESA') || roleCodes.includes('PJ_KELOMPOK')) {
      return true;
    }
  }

  // 4. PJ Desa memiliki hak penuh atas tugas yang dibuat pengajar/wali di tingkat bawahnya (seluruh Kelompok di bawah Desa tersebut)
  if (roleCodes.includes('PJ_DESA')) {
    const childKelompoks = await prisma.organization.findMany({
      where: { parentId: userOrgId },
      select: { id: true },
    });
    const childIds = childKelompoks.map((c) => c.id);
    if (childIds.includes(assignment.organizationId)) {
      return true;
    }
  }

  return false;
}

/**
 * Mendapatkan data tugas terstruktur berdasarkan role pengguna aktif
 */
export async function getAssignmentsData(selectedStudentId?: string, requestedRole?: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      roles: true,
      organization: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
      generation: true,
      gamification: true,
      children: {
        include: {
          student: {
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
            },
          },
        },
      },
    },
  });

  if (!userProfile) {
    throw new Error('Profil pengguna tidak ditemukan');
  }

  const roleCodes = userProfile.roles.map((r) => r.role);
  const isSuperAdminOrDaerah = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isPj = isPjKelompok || isPjDesa || isSuperAdminOrDaerah;
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');
  const isOrangTua = roleCodes.includes('ORANG_TUA') || (userProfile.children && userProfile.children.length > 0);
  const isSantri = roleCodes.includes('SANTRI') || (Boolean(userProfile.generationId) && Boolean(userProfile.organizationId) && !isPj && !isPengajar);

  // Tentukan activeRoleKey berdasarkan requestedRole dan kapabilitas user
  let activeRoleKey: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ';
  const req = requestedRole?.toUpperCase();

  if (req === 'SANTRI' && (isSantri || roleCodes.includes('SANTRI') || Boolean(userProfile.generationId))) {
    activeRoleKey = 'SANTRI';
  } else if (req === 'ORANG_TUA' && isOrangTua) {
    activeRoleKey = 'ORANG_TUA';
  } else if (req === 'PENGAJAR' && (isPengajar || isPj)) {
    activeRoleKey = 'PENGAJAR';
  } else if (req === 'PJ' && isPj) {
    activeRoleKey = 'PJ';
  } else {
    // Default fallback prioritas
    if (roleCodes.includes('SANTRI') && !isPengajar && !isPj && !isOrangTua) {
      activeRoleKey = 'SANTRI';
    } else if (isPj) {
      activeRoleKey = 'PJ';
    } else if (isPengajar) {
      activeRoleKey = 'PENGAJAR';
    } else if (isOrangTua) {
      activeRoleKey = 'ORANG_TUA';
    } else if (isSantri) {
      activeRoleKey = 'SANTRI';
    } else {
      activeRoleKey = 'PJ';
    }
  }

  const userOrgId = userProfile.organizationId;
  const parentOrgId = userProfile.organization?.parentId;
  const grandParentOrgId = userProfile.organization?.parent?.parentId;
  const allowedOrgs = [userOrgId, parentOrgId, grandParentOrgId].filter(Boolean) as string[];

  const allGenerations = await prisma.generation.findMany({
    orderBy: { minAge: 'asc' },
    select: { id: true, code: true, name: true, minAge: true, maxAge: true, description: true },
  });

  // 1. DATA UNTUK SISWA (SANTRI)
  if (activeRoleKey === 'SANTRI') {
    const studentGenId = userProfile.generationId;

    // Ambil tugas yang ditujukan untuk organisasi atau jenjang santri ini
    const rawAssignments = await prisma.assignment.findMany({
      where: {
        OR: [
          ...(allowedOrgs.length > 0 ? [{ organizationId: { in: allowedOrgs } }] : []),
          { organizationId: userOrgId || undefined },
          { material: { targetGenerationId: studentGenId || undefined } },
        ],
      },
      include: {
        teacher: { select: { id: true, fullName: true, avatarUrl: true } },
        organization: { select: { id: true, name: true, type: true } },
        class: { select: { id: true, name: true } },
        material: { select: { id: true, title: true } },
        submissions: {
          where: { studentId: userProfile.id },
          include: {
            parentVerification: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    // Filter penugasan sesuai target santri spesifik / target generasi (jika ada pembatasan sasaran)
    const assignments = rawAssignments.filter((a) => {
      const cfg = parseAssignmentConfig(a.attachmentUrl);
      if (cfg.targetStudentIds && cfg.targetStudentIds.length > 0) {
        return cfg.targetStudentIds.includes(userProfile.id);
      }
      if (cfg.targetGenerationIds && cfg.targetGenerationIds.length > 0) {
        if (!userProfile.generationId) return false;
        return cfg.targetGenerationIds.includes(userProfile.generationId);
      }
      return true;
    });

    return {
      role: 'SANTRI' as const,
      userProfile,
      assignments: assignments.map((a) => {
        const sub = a.submissions[0] || null;
        const config = parseAssignmentConfig(a.attachmentUrl);
        const className = formatTargetSasaranLabel(config, a.class, allGenerations);
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          taskType: a.taskType,
          requiresParentVerification: a.requiresParentVerification,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          pointsReward: a.pointsReward,
          parentBonusPoints: a.parentBonusPoints,
          attachmentUrl: a.attachmentUrl,
          config,
          createdAt: a.createdAt.toISOString(),
          className,
          teacherName: a.teacher.fullName,
          organizationName: a.organization.name,
          organizationType: a.organization.type || a.tierLevel,
          tierLevel: a.tierLevel,
          materialTitle: a.material?.title,
          submission: sub
            ? {
                id: sub.id,
                submissionText: sub.submissionText,
                mediaFileUrl: sub.mediaFileUrl,
                status: sub.status,
                score: sub.score,
                teacherFeedback: sub.teacherFeedback,
                submittedAt: sub.submittedAt.toISOString(),
                parentVerification: sub.parentVerification
                  ? {
                      id: sub.parentVerification.id,
                      isVerifiedByParent: sub.parentVerification.isVerifiedByParent,
                      parentFeedback: sub.parentVerification.parentFeedback,
                      magicToken: sub.parentVerification.magicToken,
                      verifiedAt: sub.parentVerification.verifiedAt
                        ? sub.parentVerification.verifiedAt.toISOString()
                        : null,
                    }
                  : null,
              }
            : null,
        };
      }),
    };
  }

  // 2. DATA UNTUK PENGAJAR / WALI KELAS
  if (activeRoleKey === 'PENGAJAR') {
    // Resolusi hierarki organisasi untuk santri target penugasan:
    // - PJ_KELOMPOK / Pengajar di Kelompok: HANYA santri di kelompoknya (userOrgId)
    // - PJ_DESA: santri di desa tersebut + santri di seluruh kelompok di bawah desa tersebut
    // - PJ_DAERAH / ADMIN_MASTER: santri di daerah + seluruh desa & kelompok di bawah daerah tersebut
    let targetStudentOrgIds: string[] = [];

    if (userOrgId) {
      if (isSuperAdminOrDaerah || userProfile.organization?.type === 'DAERAH') {
        const desaOrgs = await prisma.organization.findMany({
          where: { parentId: userOrgId },
          select: { id: true },
        });
        const desaIds = desaOrgs.map((d) => d.id);
        const kelompokOrgs = desaIds.length > 0
          ? await prisma.organization.findMany({
              where: { parentId: { in: desaIds } },
              select: { id: true },
            })
          : [];
        const kelompokIds = kelompokOrgs.map((k) => k.id);
        targetStudentOrgIds = [userOrgId, ...desaIds, ...kelompokIds];
      } else if (isPjDesa || userProfile.organization?.type === 'DESA') {
        const childKelompoks = await prisma.organization.findMany({
          where: { parentId: userOrgId },
          select: { id: true },
        });
        const kelompokIds = childKelompoks.map((k) => k.id);
        targetStudentOrgIds = [userOrgId, ...kelompokIds];
      } else {
        // PJ_KELOMPOK atau Pengajar di tingkat Kelompok: hanya kelompoknya sendiri
        targetStudentOrgIds = [userOrgId];
      }
    }

    // Ambil tugas yang dibuat pengajar ini atau berada dalam organisasinya
    const [assignments, classes, materials, rawStudents, generations] = await Promise.all([
      prisma.assignment.findMany({
        where: roleCodes.includes('ADMIN_MASTER')
          ? undefined
          : {
              OR: [
                { teacherId: userProfile.id },
                ...(targetStudentOrgIds.length > 0 ? [{ organizationId: { in: targetStudentOrgIds } }] : []),
                ...(allowedOrgs.length > 0 ? [{ organizationId: { in: allowedOrgs } }] : []),
              ],
            },
        include: {
          teacher: { select: { id: true, fullName: true } },
          organization: { select: { id: true, name: true, type: true } },
          class: { select: { id: true, name: true } },
          material: { select: { id: true, title: true } },
          submissions: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                  generation: { select: { name: true, code: true } },
                },
              },
              parentVerification: {
                include: {
                  parent: { select: { fullName: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.class.findMany({
        where: allowedOrgs.length > 0 ? { organizationId: { in: allowedOrgs } } : undefined,
        select: { id: true, name: true, generationId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.material.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          roles: { some: { role: 'SANTRI' } },
          status: 'ACTIVE',
          ...(targetStudentOrgIds.length > 0 ? { organizationId: { in: targetStudentOrgIds } } : {}),
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          generationId: true,
          generation: { select: { id: true, name: true, code: true } },
          organization: { select: { id: true, name: true, type: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.generation.findMany({
        orderBy: { minAge: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          minAge: true,
          maxAge: true,
          description: true,
        },
      }),
    ]);

    // Flat list seluruh submission untuk Antrean Koreksi (Homework Grading Suite)
    const gradingQueue = assignments.flatMap((a) =>
      a.submissions.map((sub) => ({
        submissionId: sub.id,
        assignmentId: a.id,
        assignmentTitle: a.title,
        taskType: a.taskType,
        pointsReward: a.pointsReward,
        parentBonusPoints: a.parentBonusPoints,
        studentId: sub.student.id,
        studentName: sub.student.fullName,
        generationName: sub.student.generation?.name || 'Santri',
        submissionText: sub.submissionText,
        mediaFileUrl: sub.mediaFileUrl,
        attachmentUrl: a.attachmentUrl,
        status: sub.status,
        score: sub.score,
        teacherFeedback: sub.teacherFeedback,
        submittedAt: sub.submittedAt.toISOString(),
        isVerifiedByParent: Boolean(sub.parentVerification?.isVerifiedByParent),
        parentVerifierName: sub.parentVerification?.parent?.fullName || null,
        parentFeedback: sub.parentVerification?.parentFeedback || null,
      }))
    );

    return {
      role: 'PENGAJAR' as const,
      userProfile,
      assignments: assignments.map((a) => {
        const config = parseAssignmentConfig(a.attachmentUrl);
        let className = a.class?.name;
        let targetStudentsCount = rawStudents.length;

        if (config.targetStudentIds && config.targetStudentIds.length > 0) {
          targetStudentsCount = config.targetStudentIds.length;
        } else if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
          const matchCount = rawStudents.filter((s) => s.generationId && config.targetGenerationIds?.includes(s.generationId)).length;
          targetStudentsCount = matchCount > 0 ? matchCount : config.targetGenerationIds.length;
        } else if (config.targetClassIds && config.targetClassIds.length > 0) {
          const targetGenIds = classes.filter((c) => config.targetClassIds?.includes(c.id)).map((c) => c.generationId);
          const matchCount = rawStudents.filter((s) => s.generationId && targetGenIds.includes(s.generationId)).length;
          targetStudentsCount = matchCount > 0 ? matchCount : rawStudents.length;
        } else if (a.classId) {
          const cls = classes.find((c) => c.id === a.classId);
          if (cls?.generationId) {
            const matchCount = rawStudents.filter((s) => s.generationId === cls.generationId).length;
            targetStudentsCount = matchCount > 0 ? matchCount : rawStudents.length;
          }
        }
        targetStudentsCount = Math.max(targetStudentsCount, a.submissions.length);

        if (!className) {
          className = formatTargetSasaranLabel(config, a.class, generations);
        }
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          taskType: a.taskType,
          requiresParentVerification: a.requiresParentVerification,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          pointsReward: a.pointsReward,
          parentBonusPoints: a.parentBonusPoints,
          attachmentUrl: a.attachmentUrl,
          config,
          createdAt: a.createdAt.toISOString(),
          className,
          materialTitle: a.material?.title || null,
          teacherName: a.teacher.fullName,
          organizationName: a.organization.name,
          organizationType: a.organization.type || a.tierLevel,
          tierLevel: a.tierLevel,
          targetStudentsCount,
          totalSubmissions: a.submissions.length,
          pendingSubmissions: a.submissions.filter((s) => s.status === 'SUBMITTED').length,
          gradedSubmissions: a.submissions.filter((s) => s.status === 'GRADED').length,
          verifiedByParent: a.submissions.filter((s) => s.parentVerification?.isVerifiedByParent).length,
        };
      }),
      gradingQueue,
      availableGenerations: generations.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        minAge: g.minAge,
        maxAge: g.maxAge,
        description: g.description,
        studentCount: rawStudents.filter((s) => s.generationId === g.id).length,
      })),
      availableClasses: classes,
      availableMaterials: materials,
      availableStudents: rawStudents.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        generationId: s.generationId,
        generationCode: s.generation?.code || null,
        generationName: s.generation?.name || 'Santri',
        organizationName: s.organization?.name || null,
        avatarUrl: s.avatarUrl,
      })),
    };
  }

  // 3. DATA UNTUK ORANG TUA
  if (activeRoleKey === 'ORANG_TUA') {
    const children = userProfile.children.map((c) => ({
      id: c.student.id,
      fullName: c.student.fullName,
      avatarUrl: c.student.avatarUrl || null,
      generationName: c.student.generation?.name || 'Santri',
      totalPoints: c.student.gamification?.totalPoints || 0,
      pendingParafCount: 0,
    }));

    const allAssignmentsByChild: Record<string, any[]> = {};

    for (const child of userProfile.children) {
      const studentId = child.student.id;
      const childUser = child.student;
      const childOrgId = childUser.organizationId;
      const childParentOrgId = (childUser as any).organization?.parentId;
      const childGrandParentOrgId = (childUser as any).organization?.parent?.parentId;
      const childOrgs = [childOrgId, childParentOrgId, childGrandParentOrgId].filter(Boolean) as string[];

      const rawChildAssignments = await prisma.assignment.findMany({
        where: {
          OR: [
            ...(childOrgs.length > 0 ? [{ organizationId: { in: childOrgs } }] : []),
            { material: { targetGenerationId: childUser.generationId || undefined } },
          ],
        },
        include: {
          teacher: { select: { fullName: true } },
          organization: { select: { id: true, name: true, type: true } },
          class: { select: { id: true, name: true } },
          material: { select: { title: true } },
          submissions: {
            where: { studentId },
            include: { parentVerification: true },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      });

      // Filter berdasarkan target sasaran santri / target generasi
      const childAssignments = rawChildAssignments.filter((a) => {
        const cfg = parseAssignmentConfig(a.attachmentUrl);
        if (cfg.targetStudentIds && cfg.targetStudentIds.length > 0) {
          return cfg.targetStudentIds.includes(studentId);
        }
        if (cfg.targetGenerationIds && cfg.targetGenerationIds.length > 0) {
          if (!childUser.generationId) return false;
          return cfg.targetGenerationIds.includes(childUser.generationId);
        }
        return true;
      });

      const mapped = childAssignments.map((a) => {
        const sub = a.submissions[0] || null;
        const config = parseAssignmentConfig(a.attachmentUrl);
        const className = formatTargetSasaranLabel(config, a.class, allGenerations);
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          taskType: a.taskType,
          requiresParentVerification: a.requiresParentVerification,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          pointsReward: a.pointsReward,
          parentBonusPoints: a.parentBonusPoints,
          attachmentUrl: a.attachmentUrl,
          config,
          createdAt: a.createdAt.toISOString(),
          className,
          teacherName: a.teacher.fullName,
          organizationName: a.organization.name,
          organizationType: a.organization.type || a.tierLevel,
          tierLevel: a.tierLevel,
          materialTitle: a.material?.title || null,
          submission: sub
            ? {
                id: sub.id,
                submissionText: sub.submissionText,
                mediaFileUrl: sub.mediaFileUrl,
                status: sub.status,
                score: sub.score,
                teacherFeedback: sub.teacherFeedback,
                submittedAt: sub.submittedAt.toISOString(),
                parentVerification: sub.parentVerification
                  ? {
                      id: sub.parentVerification.id,
                      isVerifiedByParent: sub.parentVerification.isVerifiedByParent,
                      parentFeedback: sub.parentVerification.parentFeedback,
                      magicToken: sub.parentVerification.magicToken,
                      verifiedAt: sub.parentVerification.verifiedAt
                        ? sub.parentVerification.verifiedAt.toISOString()
                        : null,
                    }
                  : null,
              }
            : null,
        };
      });

      allAssignmentsByChild[studentId] = mapped;

      const childObj = children.find((c) => c.id === studentId);
      if (childObj) {
        childObj.pendingParafCount = mapped.filter(
          (t) => t.requiresParentVerification && t.submission && !t.submission.parentVerification?.isVerifiedByParent
        ).length;
      }
    }

    const activeChildId =
      selectedStudentId && allAssignmentsByChild[selectedStudentId]
        ? selectedStudentId
        : children[0]?.id || '';

    return {
      role: 'ORANG_TUA' as const,
      userProfile,
      children,
      activeChildId,
      assignments: allAssignmentsByChild[activeChildId] || [],
      allAssignmentsByChild,
    };
  }

  // 4. DATA UNTUK PJ WILAYAH / ADMIN MASTER
  const [assignments, generations, rawStudents] = await Promise.all([
    prisma.assignment.findMany({
      where: isSuperAdminOrDaerah
        ? undefined
        : allowedOrgs.length > 0
        ? { organizationId: { in: allowedOrgs } }
        : undefined,
      include: {
        teacher: { select: { fullName: true } },
        organization: { select: { name: true, type: true } },
        class: { select: { name: true, generationId: true } },
        material: { select: { title: true } },
        submissions: {
          include: {
            parentVerification: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.generation.findMany({
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: {
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
        ...(isSuperAdminOrDaerah ? {} : allowedOrgs.length > 0 ? { organizationId: { in: allowedOrgs } } : {}),
      },
      select: {
        id: true,
        generationId: true,
        organizationId: true,
      },
    }),
  ]);

  const totalAssignments = assignments.length;
  const totalSubmissions = assignments.reduce((acc, a) => acc + a.submissions.length, 0);
  const totalParentVerified = assignments.reduce(
    (acc, a) =>
      acc + a.submissions.filter((s) => s.parentVerification?.isVerifiedByParent).length,
    0
  );
  const totalGraded = assignments.reduce(
    (acc, a) => acc + a.submissions.filter((s) => s.status === 'GRADED').length,
    0
  );

  return {
    role: 'PJ' as const,
    userProfile,
    stats: {
      totalAssignments,
      totalSubmissions,
      totalParentVerified,
      totalGraded,
      parentEngagementRate:
        totalSubmissions > 0 ? Math.round((totalParentVerified / totalSubmissions) * 100) : 0,
    },
    assignments: assignments.map((a) => {
      const config = parseAssignmentConfig(a.attachmentUrl);
      let className = a.class?.name;

      const relevantStudents = rawStudents.filter((s) => s.organizationId === a.organizationId);
      const pool = relevantStudents.length > 0 ? relevantStudents : rawStudents;

      let targetStudentsCount = pool.length;

      if (config.targetStudentIds && config.targetStudentIds.length > 0) {
        targetStudentsCount = config.targetStudentIds.length;
      } else if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
        const matchCount = pool.filter((s) => s.generationId && config.targetGenerationIds?.includes(s.generationId)).length;
        targetStudentsCount = matchCount > 0 ? matchCount : config.targetGenerationIds.length;
      } else if (a.class?.generationId) {
        const matchCount = pool.filter((s) => s.generationId === a.class?.generationId).length;
        targetStudentsCount = matchCount > 0 ? matchCount : pool.length;
      }
      targetStudentsCount = Math.max(targetStudentsCount, a.submissions.length);

      if (!className) {
        if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
          const genNames = generations
            .filter((g) => config.targetGenerationIds?.includes(g.id))
            .map((g) => g.name.split(' ')[0]);
          className = genNames.length > 0 ? `${genNames.join(', ')}` : `${config.targetGenerationIds.length} Generasi`;
        } else if (config.targetClassIds && config.targetClassIds.length > 0) {
          className = `${config.targetClassIds.length} Kelas Dipilih`;
        } else if (config.targetStudentIds && config.targetStudentIds.length > 0) {
          className = `${config.targetStudentIds.length} Santri Khusus`;
        } else {
          className = 'Semua Santri';
        }
      }

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        taskType: a.taskType,
        requiresParentVerification: a.requiresParentVerification,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        pointsReward: a.pointsReward,
        parentBonusPoints: a.parentBonusPoints,
        teacherName: a.teacher.fullName,
        organizationName: a.organization.name,
        organizationType: a.organization.type || a.tierLevel,
        tierLevel: a.tierLevel,
        materialTitle: a.material?.title || null,
        targetStudentsCount,
        className,
        totalSubmissions: a.submissions.length,
        verifiedCount: a.submissions.filter((s) => s.parentVerification?.isVerifiedByParent).length,
        gradedCount: a.submissions.filter((s) => s.status === 'GRADED').length,
      };
    }),
  };
}

/**
 * Pengajar menerbitkan tugas baru
 */
export async function createAssignment(formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Tidak terautentikasi' };
    }

    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const taskType = (formData.get('taskType') as TaskType) || TaskType.DAILY_HABIT;
    const classId = (formData.get('classId') as string) || null;
    const materialId = (formData.get('materialId') as string) || null;
    const dueDateStr = formData.get('dueDate') as string;
    const pointsReward = parseInt((formData.get('pointsReward') as string) || '20', 10);
    const parentBonusPoints = parseInt((formData.get('parentBonusPoints') as string) || '10', 10);
    const requiresParentVerification = formData.get('requiresParentVerification') === 'true';
    const assignmentConfig = (formData.get('assignmentConfig') as string) || null;

    if (!title) {
      return { error: 'Judul tugas wajib diisi.' };
    }

    const teacher = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, organizationId: true },
    });

    if (!teacher || !teacher.organizationId) {
      return { error: 'Pengajar belum terdaftar pada unit organisasi.' };
    }

    // Proses upload foto lampiran jika ada Base64
    let finalConfigStr = assignmentConfig;
    if (assignmentConfig) {
      try {
        const parsedConfig = parseAssignmentConfig(assignmentConfig);
        if (parsedConfig.taskAttachments?.photos && parsedConfig.taskAttachments.photos.length > 0) {
          const uploadedPhotos: string[] = [];
          for (const photo of parsedConfig.taskAttachments.photos) {
            const uploadedUrl = await uploadTaskImage(photo);
            uploadedPhotos.push(uploadedUrl);
          }
          parsedConfig.taskAttachments.photos = uploadedPhotos;
          finalConfigStr = serializeAssignmentConfig(parsedConfig);
        }
      } catch (err) {
        console.warn('Gagal memproses upload lampiran foto tugas:', err);
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        taskType,
        organizationId: teacher.organizationId,
        teacherId: teacher.id,
        classId: classId || undefined,
        materialId: materialId || undefined,
        dueDate: dueDateStr && dueDateStr.trim() ? new Date(dueDateStr) : null,
        pointsReward: Math.max(5, Math.min(pointsReward, 100)),
        parentBonusPoints: Math.max(0, Math.min(parentBonusPoints, 50)),
        requiresParentVerification,
        attachmentUrl: finalConfigStr || undefined,
      },
    });

    revalidatePath('/tugas');
    revalidatePath('/dashboard');
    return { success: true, assignmentId: assignment.id };
  } catch (err: any) {
    console.error('Error creating assignment:', err);
    return { error: err.message || 'Gagal menerbitkan tugas.' };
  }
}

/**
 * Santri mengumpulkan pengerjaan tugas (Audio, Checklist, Foto, Teks)
 */
export async function submitAssignment(formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Tidak terautentikasi' };
    }

    const assignmentId = formData.get('assignmentId') as string;
    const submissionText = (formData.get('submissionText') as string) || null;
    const mediaFileUrl = (formData.get('mediaFileUrl') as string) || null;

    if (!assignmentId) {
      return { error: 'ID Tugas tidak valid.' };
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { organization: true },
    });

    if (!assignment) {
      return { error: 'Data tugas tidak ditemukan.' };
    }

    // Evaluasi batas waktu dan kebijakan overdue (Aksi Setelah Batas Waktu Berakhir)
    const config = parseAssignmentConfig(assignment.attachmentUrl);
    const isOverdue = assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false;

    if (isOverdue) {
      if (config.overdueAction === 'LOCK') {
        return {
          error:
            'Batas waktu pengumpulan tugas ini telah berakhir. Pengumpulan tugas telah ditutup oleh pengajar.',
        };
      }
    }

    // Beri label/tag jika dikumpulkan terlambat
    let finalSubmissionText = submissionText;
    if (isOverdue) {
      const lateTag =
        config.overdueAction === 'ALLOW_WITH_PENALTY'
          ? `[TERLAMBAT - Potongan ${config.penaltyPercentage || 25}% Poin]`
          : '[TERLAMBAT]';

      if (finalSubmissionText && finalSubmissionText.startsWith('{')) {
        try {
          const parsedJson = JSON.parse(finalSubmissionText);
          parsedJson.isLate = true;
          parsedJson.overdueAction = config.overdueAction;
          parsedJson.penaltyPercentage = config.penaltyPercentage || 25;
          finalSubmissionText = JSON.stringify(parsedJson);
        } catch {
          finalSubmissionText = `${lateTag}\n${finalSubmissionText}`;
        }
      } else {
        finalSubmissionText = finalSubmissionText
          ? `${lateTag}\n${finalSubmissionText}`
          : lateTag;
      }
    }

    // Ambil data orang tua santri (jika ada) untuk pembuatan verifikasi magic link
    const studentRelation = await prisma.studentParentRelation.findFirst({
      where: { studentUserId: authUser.id },
      select: { parentUserId: true },
    });

    // Cari apakah sudah pernah submit sebelumnya
    const existingSubmission = await prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId,
        studentId: authUser.id,
      },
    });

    if (existingSubmission) {
      if (assignment.taskType === TaskType.QUIZ_ONLINE) {
        return {
          error: 'Jawaban kuis online yang telah dikumpulkan tidak dapat diedit kembali.',
        };
      }
      if (isOverdue) {
        return {
          error: 'Batas waktu pengerjaan tugas telah berakhir. Pengerjaan tidak dapat diedit lagi.',
        };
      }
    }

    // Proses upload media via Unified Media Gateway:
    // Foto -> Cloudinary (q_auto, f_auto)
    // Audio -> Cloudflare R2 (Zero Egress)
    // Jika kredensial belum ada -> Fallback ke Supabase Storage / Mock
    const isAudioTask = assignment.taskType === TaskType.AUDIO_MEMORIZATION;
    const uploadedMediaUrl = await processMediaPayload(mediaFileUrl, isAudioTask);

    // Otomatis bersihkan file lama dari Cloudinary/R2 jika ada file yang dihapus/diganti
    if (existingSubmission?.mediaFileUrl) {
      await deleteUnusedMedia(existingSubmission.mediaFileUrl, uploadedMediaUrl);
    }

    // Simpan atau update submission
    const submission = existingSubmission
      ? await prisma.assignmentSubmission.update({
          where: { id: existingSubmission.id },
          data: {
            submissionText: finalSubmissionText,
            mediaFileUrl: uploadedMediaUrl,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        })
      : await prisma.assignmentSubmission.create({
          data: {
            assignmentId,
            studentId: authUser.id,
            submissionText: finalSubmissionText,
            mediaFileUrl: uploadedMediaUrl,
            status: SubmissionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

    // Jika tugas memerlukan paraf orang tua, buat record verifikasi & magic token
    if (assignment.requiresParentVerification) {
      const parentUserId = studentRelation?.parentUserId || authUser.id;
      const magicToken = generateMagicToken(submission.id, parentUserId, 72);

      await prisma.assignmentParentVerification.upsert({
        where: { submissionId: submission.id },
        update: {
          magicToken,
          tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
          isVerifiedByParent: false,
        },
        create: {
          submissionId: submission.id,
          parentUserId,
          magicToken,
          tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
          isVerifiedByParent: false,
        },
      });
    }

    revalidatePath('/tugas');
    revalidatePath('/dashboard');
    return { success: true, submissionId: submission.id };
  } catch (err: any) {
    console.error('Error submitting assignment:', err);
    return { error: err.message || 'Gagal mengumpulkan tugas.' };
  }
}

/**
 * Pengajar mengoreksi & memberi nilai tugas santri (Homework Grading Suite)
 */
export async function gradeAssignmentSubmission({
  submissionId,
  score,
  teacherFeedback,
  status = SubmissionStatus.GRADED,
}: {
  submissionId: string;
  score: number;
  teacherFeedback?: string;
  status?: SubmissionStatus;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Tidak terautentikasi' };
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: true,
        parentVerification: true,
      },
    });

    if (!submission) {
      return { error: 'Data pengumpulan tugas tidak ditemukan.' };
    }

    // Validasi hak akses koreksi (Pembuat Tugas, Asisten Koreksi, atau Admin)
    const assignment = submission.assignment;
    const config = parseAssignmentConfig(assignment.attachmentUrl);
    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });
    if (!userProfile) {
      return { error: 'Profil pengguna tidak ditemukan.' };
    }

    const canManage = await canUserManageAssignment(userProfile, {
      organizationId: assignment.organizationId,
      teacherId: assignment.teacherId,
    });
    const isAssistantGrader = Boolean(config.assistantGraderIds?.includes(authUser.id));

    if (!canManage && !isAssistantGrader) {
      return {
        error:
          'Anda tidak memiliki hak akses untuk mengoreksi tugas ini. Hanya pembuat tugas, PJ wilayah, atau pengajar yang diberikan akses yang dapat mengoreksi.',
      };
    }

    const clampedScore = Math.max(0, Math.min(Math.round(score), 100));

    // Update status penilaian tugas
    await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: clampedScore,
        teacherFeedback: teacherFeedback?.trim() || null,
        status,
        updatedAt: new Date(),
      },
    });

    // Jika dinilai lulus / GRADED, berikan poin reward gamifikasi kepada santri
    let pointsAwarded = 0;
    if (status === SubmissionStatus.GRADED) {
      pointsAwarded = submission.assignment.pointsReward || 20;

      // Bonus jika telah diverifikasi orang tua
      if (
        submission.parentVerification?.isVerifiedByParent &&
        submission.assignment.parentBonusPoints > 0
      ) {
        pointsAwarded += submission.assignment.parentBonusPoints;
      }

      await prisma.userGamification.upsert({
        where: { userId: submission.studentId },
        update: {
          totalPoints: { increment: pointsAwarded },
          updatedAt: new Date(),
        },
        create: {
          userId: submission.studentId,
          totalPoints: pointsAwarded,
          currentStreakDays: 1,
        },
      });
    }

    revalidatePath('/tugas');
    revalidatePath('/dashboard');
    return { success: true, pointsAwarded };
  } catch (err: any) {
    console.error('Error grading assignment:', err);
    return { error: err.message || 'Gagal menyimpan penilaian tugas.' };
  }
}

/**
 * Orang tua memberi paraf / validasi digital pada tugas ananda
 * (Bisa dipanggil In-App oleh orang tua login atau via Public Magic Link)
 */
export async function verifySubmissionByParent({
  submissionId,
  parentFeedback,
  magicToken,
}: {
  submissionId: string;
  parentFeedback?: string;
  magicToken?: string;
}) {
  try {
    let parentUserId: string | null = null;

    if (magicToken) {
      const verify = verifyMagicToken(magicToken);
      if (!verify.valid || verify.submissionId !== submissionId) {
        return { error: verify.error || 'Tautan verifikasi tidak sah.' };
      }
      parentUserId = verify.parentUserId || null;
    } else {
      const supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return { error: 'Tidak terautentikasi' };
      }
      parentUserId = authUser.id;
    }

    const verification = await prisma.assignmentParentVerification.findUnique({
      where: { submissionId },
      include: {
        submission: {
          include: { assignment: true },
        },
      },
    });

    if (!verification) {
      return { error: 'Data verifikasi tugas tidak ditemukan.' };
    }

    const now = new Date();
    await prisma.assignmentParentVerification.update({
      where: { id: verification.id },
      data: {
        isVerifiedByParent: true,
        parentFeedback: parentFeedback?.trim() || 'Telah diverifikasi dan didampingi oleh orang tua.',
        verifiedAt: now,
      },
    });

    // Jika tugas belum dinilai guru, transisikan status menjadi VERIFIED_BY_PARENT
    if (verification.submission.status === SubmissionStatus.SUBMITTED) {
      await prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.VERIFIED_BY_PARENT,
        },
      });
    }

    revalidatePath('/tugas');
    revalidatePath(`/tugas/${verification.submission.assignmentId}`);
    revalidatePath('/dashboard');
    return { success: true, bonusPoints: verification.submission.assignment.parentBonusPoints };
  } catch (err: any) {
    console.error('Error verifying submission by parent:', err);
    return { error: err.message || 'Gagal memverifikasi tugas.' };
  }
}

/**
 * Membuat tautan Magic Link WhatsApp untuk dibagikan santri ke orang tua
 */
export async function getParentMagicLink(submissionId: string) {
  try {
    const verification = await prisma.assignmentParentVerification.findUnique({
      where: { submissionId },
    });

    if (!verification || !verification.magicToken) {
      const token = generateMagicToken(submissionId, undefined, 72);
      await prisma.assignmentParentVerification.upsert({
        where: { submissionId },
        update: { magicToken: token, tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000) },
        create: {
          submissionId,
          parentUserId: '00000000-0000-0000-0000-000000000000',
          magicToken: token,
          tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
        },
      });
      return { success: true, token };
    }

    return { success: true, token: verification.magicToken };
  } catch (err: any) {
    return { error: err.message || 'Gagal membuat tautan paraf orang tua.' };
  }
}

/**
 * Hapus berkas media spesifik secara langsung dari cloud storage (Cloudinary, R2, atau Supabase)
 */
export async function deleteSubmissionMediaAction(mediaUrl: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Sesi Anda telah kedaluwarsa.' };
    }

    const success = await deleteTaskMedia(mediaUrl);
    return { success };
  } catch (err: any) {
    console.error('Error deleting media:', err);
    return { error: err.message || 'Gagal menghapus file media.' };
  }
}

/**
 * Guru / Admin menghapus penugasan beserta seluruh submission dan media berkasnya di cloud storage
 */
export async function deleteAssignment(assignmentId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Sesi Anda telah kedaluwarsa.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });

    if (!userProfile) {
      return { error: 'Profil pengguna tidak ditemukan.' };
    }

    const assignmentToDelete = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { teacherId: true, organizationId: true },
    });

    if (!assignmentToDelete) {
      return { error: 'Tugas tidak ditemukan.' };
    }

    const canManage = await canUserManageAssignment(userProfile, assignmentToDelete);
    if (!canManage) {
      return { error: 'Anda tidak memiliki hak akses untuk menghapus penugasan ini. Hanya pembuat tugas atau PJ wilayah yang berwenang.' };
    }

    // Ambil seluruh submission dan berkas medianya untuk dihapus dari Cloud Storage
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      select: { mediaFileUrl: true },
    });

    for (const sub of submissions) {
      if (sub.mediaFileUrl) {
        const urls = parseMediaUrls(sub.mediaFileUrl);
        await Promise.allSettled(urls.map((u) => deleteTaskMedia(u)));
      }
    }

    // Hapus seluruh riwayat verifikasi orang tua
    await prisma.assignmentParentVerification.deleteMany({
      where: { submission: { assignmentId } },
    });

    // Hapus seluruh submission
    await prisma.assignmentSubmission.deleteMany({
      where: { assignmentId },
    });

    // Hapus tugas
    await prisma.assignment.delete({
      where: { id: assignmentId },
    });

    revalidatePath('/tugas');
    return { success: true, deletedSubmissionCount: submissions.length };
  } catch (err: any) {
    console.error('Error deleting assignment:', err);
    return { error: err.message || 'Gagal menghapus penugasan.' };
  }
}

/**
 * Mengambil detail lengkap satu tugas berdasarkan ID
 * Auto-detect role user dan mengembalikan data sesuai perspektif role
 */
export async function getAssignmentDetail(assignmentId: string, selectedStudentId?: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      roles: true,
      organization: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
      generation: true,
      gamification: true,
      children: {
        include: {
          student: {
            include: {
              generation: true,
              gamification: true,
            },
          },
        },
      },
    },
  });

  if (!userProfile) {
    throw new Error('Profil pengguna tidak ditemukan');
  }

  const roleCodes = userProfile.roles.map((r) => r.role);
  const isSuperAdminOrDaerah = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isPj = isPjKelompok || isPjDesa || isSuperAdminOrDaerah;
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS') || isPj;
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isSantri = roleCodes.includes('SANTRI');

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      teacher: { select: { id: true, fullName: true, avatarUrl: true } },
      organization: { select: { id: true, name: true, type: true } },
      class: { select: { id: true, name: true } },
      material: { select: { id: true, title: true } },
      submissions: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              generation: { select: { id: true, name: true, code: true } },
            },
          },
          parentVerification: {
            include: {
              parent: { select: { fullName: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });

  if (!assignment) {
    throw new Error('Tugas tidak ditemukan');
  }

  const config = parseAssignmentConfig(assignment.attachmentUrl);
  const generations = await prisma.generation.findMany({
    orderBy: { minAge: 'asc' },
    select: { id: true, code: true, name: true },
  });
  const className = formatTargetSasaranLabel(config, assignment.class, generations);

  // ─── SANTRI: hanya submission sendiri ───
  if (isSantri) {
    const mySub = assignment.submissions.find((s) => s.studentId === userProfile.id) || null;
    return {
      role: 'SANTRI' as const,
      userProfile: {
        id: userProfile.id,
        fullName: userProfile.fullName,
        totalPoints: userProfile.gamification?.totalPoints || 0,
      },
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        taskType: assignment.taskType,
        requiresParentVerification: assignment.requiresParentVerification,
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        pointsReward: assignment.pointsReward,
        parentBonusPoints: assignment.parentBonusPoints,
        attachmentUrl: assignment.attachmentUrl,
        config,
        createdAt: assignment.createdAt.toISOString(),
        teacherName: assignment.teacher.fullName,
        teacherId: assignment.teacher.id,
        organizationName: assignment.organization.name,
        organizationType: assignment.organization.type || assignment.tierLevel,
        tierLevel: assignment.tierLevel,
        className,
        materialTitle: assignment.material?.title || null,
      },
      submission: mySub
        ? {
            id: mySub.id,
            submissionText: mySub.submissionText,
            mediaFileUrl: mySub.mediaFileUrl,
            status: mySub.status,
            score: mySub.score,
            teacherFeedback: mySub.teacherFeedback,
            submittedAt: mySub.submittedAt.toISOString(),
            parentVerification: mySub.parentVerification
              ? {
                  id: mySub.parentVerification.id,
                  isVerifiedByParent: mySub.parentVerification.isVerifiedByParent,
                  parentFeedback: mySub.parentVerification.parentFeedback,
                  magicToken: mySub.parentVerification.magicToken,
                  verifiedAt: mySub.parentVerification.verifiedAt
                    ? mySub.parentVerification.verifiedAt.toISOString()
                    : null,
                }
              : null,
          }
        : null,
    };
  }

  // ─── PENGAJAR / PJ: semua submission + grading info ───
  if (isPengajar) {
    const availableTeachers = await prisma.user.findMany({
      where: {
        roles: { some: { role: { in: ['PENGAJAR', 'WALI_KELAS'] } } },
        status: 'ACTIVE',
        organizationId: userProfile.organizationId || undefined,
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const isOwner = await canUserManageAssignment(userProfile, {
      organizationId: assignment.organization.id,
      teacherId: assignment.teacher.id,
    });
    const canGrade = isOwner || Boolean(config.assistantGraderIds?.includes(userProfile.id));

    return {
      role: 'PENGAJAR' as const,
      userProfile: {
        id: userProfile.id,
        fullName: userProfile.fullName,
      },
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        taskType: assignment.taskType,
        requiresParentVerification: assignment.requiresParentVerification,
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        pointsReward: assignment.pointsReward,
        parentBonusPoints: assignment.parentBonusPoints,
        attachmentUrl: assignment.attachmentUrl,
        config,
        createdAt: assignment.createdAt.toISOString(),
        className,
        materialTitle: assignment.material?.title || null,
        materialId: assignment.materialId || null,
        teacherId: assignment.teacher.id,
        teacherName: assignment.teacher.fullName,
        organizationName: assignment.organization.name,
        organizationType: assignment.organization.type || assignment.tierLevel,
        tierLevel: assignment.tierLevel,
      },
      submissions: assignment.submissions.map((sub) => ({
        id: sub.id,
        studentId: sub.student.id,
        studentName: sub.student.fullName,
        studentAvatar: sub.student.avatarUrl,
        generationName: sub.student.generation?.name || 'Santri',
        submissionText: sub.submissionText,
        mediaFileUrl: sub.mediaFileUrl,
        status: sub.status,
        score: sub.score,
        teacherFeedback: sub.teacherFeedback,
        submittedAt: sub.submittedAt.toISOString(),
        isVerifiedByParent: Boolean(sub.parentVerification?.isVerifiedByParent),
        parentVerifierName: sub.parentVerification?.parent?.fullName || null,
        parentFeedback: sub.parentVerification?.parentFeedback || null,
      })),
      stats: {
        totalSubmissions: assignment.submissions.length,
        pendingSubmissions: assignment.submissions.filter((s) => s.status === 'SUBMITTED').length,
        gradedSubmissions: assignment.submissions.filter((s) => s.status === 'GRADED').length,
        verifiedByParent: assignment.submissions.filter((s) => s.parentVerification?.isVerifiedByParent).length,
        avgScore: (() => {
          const graded = assignment.submissions.filter((s) => s.score !== null);
          if (graded.length === 0) return null;
          const total = graded.reduce((acc, s) => acc + (s.score || 0), 0);
          return Math.round(total / graded.length);
        })(),
      },
      isOwner,
      canGrade,
      availableTeachers,
    };
  }

  // ─── ORANG TUA: submission anak ───
  if (isOrangTua) {
    const childrenList = userProfile.children.map((c) => ({
      id: c.student.id,
      fullName: c.student.fullName,
      generationName: c.student.generation?.name || 'Santri',
    }));

    // Tentukan anak aktif: jika selectedStudentId diberikan dan cocok, gunakan itu; jika tidak, gunakan anak pertama
    const activeChild =
      (selectedStudentId && childrenList.find((c) => c.id === selectedStudentId)) ||
      childrenList[0] ||
      null;

    const targetChildId = activeChild?.id;

    // Ambil submission milik anak yang dipilih secara spesifik
    const childSub = targetChildId
      ? assignment.submissions.find((s) => s.studentId === targetChildId) || null
      : null;

    return {
      role: 'ORANG_TUA' as const,
      userProfile: {
        id: userProfile.id,
        fullName: userProfile.fullName,
      },
      childInfo: activeChild
        ? {
            id: activeChild.id,
            fullName: activeChild.fullName,
            generationName: activeChild.generationName,
          }
        : null,
      allChildren: childrenList,
      activeChildId: targetChildId,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        taskType: assignment.taskType,
        requiresParentVerification: assignment.requiresParentVerification,
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        pointsReward: assignment.pointsReward,
        parentBonusPoints: assignment.parentBonusPoints,
        attachmentUrl: assignment.attachmentUrl,
        config,
        createdAt: assignment.createdAt.toISOString(),
        teacherName: assignment.teacher.fullName,
        organizationName: assignment.organization.name,
        organizationType: assignment.organization.type || assignment.tierLevel,
        tierLevel: assignment.tierLevel,
        className,
        materialTitle: assignment.material?.title || null,
      },
      submission: childSub
        ? {
            id: childSub.id,
            submissionText: childSub.submissionText,
            mediaFileUrl: childSub.mediaFileUrl,
            status: childSub.status,
            score: childSub.score,
            teacherFeedback: childSub.teacherFeedback,
            submittedAt: childSub.submittedAt.toISOString(),
            studentName: childSub.student.fullName,
            parentVerification: childSub.parentVerification
              ? {
                  id: childSub.parentVerification.id,
                  isVerifiedByParent: childSub.parentVerification.isVerifiedByParent,
                  parentFeedback: childSub.parentVerification.parentFeedback,
                  magicToken: childSub.parentVerification.magicToken,
                  verifiedAt: childSub.parentVerification.verifiedAt
                    ? childSub.parentVerification.verifiedAt.toISOString()
                    : null,
                }
              : null,
          }
        : null,
    };
  }

  // ─── PJ: overview semua submission ───
  let pjClassName = assignment.class?.name;
  if (!pjClassName) {
    if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
      const generations = await prisma.generation.findMany({
        orderBy: { minAge: 'asc' },
        select: { id: true, code: true, name: true },
      });
      const genNames = generations
        .filter((g) => config.targetGenerationIds?.includes(g.id))
        .map((g) => g.name.split(' ')[0]);
      pjClassName = genNames.length > 0 ? genNames.join(', ') : `${config.targetGenerationIds.length} Generasi`;
    } else if (config.targetClassIds && config.targetClassIds.length > 0) {
      pjClassName = `${config.targetClassIds.length} Kelas Dipilih`;
    } else if (config.targetStudentIds && config.targetStudentIds.length > 0) {
      pjClassName = `${config.targetStudentIds.length} Santri Khusus`;
    } else {
      pjClassName = 'Semua Santri';
    }
  }

  return {
    role: 'PJ' as const,
    userProfile: {
      id: userProfile.id,
      fullName: userProfile.fullName,
    },
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      taskType: assignment.taskType,
      requiresParentVerification: assignment.requiresParentVerification,
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      pointsReward: assignment.pointsReward,
      parentBonusPoints: assignment.parentBonusPoints,
      attachmentUrl: assignment.attachmentUrl,
      config,
      createdAt: assignment.createdAt.toISOString(),
      teacherId: assignment.teacher.id,
      teacherName: assignment.teacher.fullName,
      organizationName: assignment.organization.name,
      organizationType: assignment.organization.type,
      className: pjClassName,
      materialTitle: assignment.material?.title || null,
    },
    submissions: assignment.submissions.map((sub) => ({
      id: sub.id,
      studentName: sub.student.fullName,
      generationName: sub.student.generation?.name || 'Santri',
      status: sub.status,
      score: sub.score,
      submittedAt: sub.submittedAt.toISOString(),
      isVerifiedByParent: Boolean(sub.parentVerification?.isVerifiedByParent),
    })),
    stats: {
      totalSubmissions: assignment.submissions.length,
      gradedCount: assignment.submissions.filter((s) => s.status === 'GRADED').length,
      verifiedCount: assignment.submissions.filter((s) => s.parentVerification?.isVerifiedByParent).length,
    },
    isOwner: await canUserManageAssignment(userProfile, {
      organizationId: assignment.organization.id,
      teacherId: assignment.teacher.id,
    }),
  };
}

/**
 * Pengajar / Admin mengupdate penugasan yang sudah dibuat
 */
export async function updateAssignment(assignmentId: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Tidak terautentikasi' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });

    if (!userProfile) {
      return { error: 'Profil pengguna tidak ditemukan.' };
    }

    // Validasi ownership (hanya pembuat atau admin/PJ yang bisa edit)
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { teacherId: true, organizationId: true },
    });

    if (!existingAssignment) {
      return { error: 'Tugas tidak ditemukan.' };
    }

    const canManage = await canUserManageAssignment(userProfile, existingAssignment);
    if (!canManage) {
      return { error: 'Anda tidak memiliki hak akses untuk mengedit tugas ini. Hanya pembuat tugas atau PJ wilayah yang berwenang.' };
    }

    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const materialId = (formData.get('materialId') as string) || null;
    const dueDateStr = formData.get('dueDate') as string;
    const pointsReward = parseInt((formData.get('pointsReward') as string) || '20', 10);
    const parentBonusPoints = parseInt((formData.get('parentBonusPoints') as string) || '10', 10);
    const requiresParentVerification = formData.get('requiresParentVerification') === 'true';
    const assignmentConfig = (formData.get('assignmentConfig') as string) || null;

    if (!title) {
      return { error: 'Judul tugas wajib diisi.' };
    }

    // Proses upload foto lampiran jika ada Base64
    let finalConfigStr = assignmentConfig;
    if (assignmentConfig) {
      try {
        const parsedConfig = parseAssignmentConfig(assignmentConfig);
        if (parsedConfig.taskAttachments?.photos && parsedConfig.taskAttachments.photos.length > 0) {
          const uploadedPhotos: string[] = [];
          for (const photo of parsedConfig.taskAttachments.photos) {
            const uploadedUrl = await uploadTaskImage(photo);
            uploadedPhotos.push(uploadedUrl);
          }
          parsedConfig.taskAttachments.photos = uploadedPhotos;
          finalConfigStr = serializeAssignmentConfig(parsedConfig);
        }
      } catch (err) {
        console.warn('Gagal memproses upload lampiran foto tugas:', err);
      }
    }

    const taskType = (formData.get('taskType') as TaskType) || undefined;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        title,
        description,
        ...(taskType ? { taskType } : {}),
        materialId: materialId ? materialId : null,
        dueDate: dueDateStr && dueDateStr.trim() ? new Date(dueDateStr) : null,
        pointsReward: Math.max(5, Math.min(pointsReward, 100)),
        parentBonusPoints: Math.max(0, Math.min(parentBonusPoints, 50)),
        requiresParentVerification,
        attachmentUrl: finalConfigStr || undefined,
        updatedAt: new Date(),
      },
    });

    revalidatePath('/tugas');
    revalidatePath(`/tugas/${assignmentId}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error updating assignment:', err);
    return { error: err.message || 'Gagal memperbarui tugas.' };
  }
}

/**
 * Mendapatkan data referensi lengkap untuk form buat dan edit tugas
 */
export async function getAssignmentFormData(assignmentId?: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      roles: true,
      organization: {
        include: {
          children: true,
        },
      },
    },
  });

  if (!userProfile) {
    throw new Error('Profil pengguna tidak ditemukan');
  }

  const roleCodes = userProfile.roles.map((r) => r.role);
  const isAuthorized =
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DAERAH');

  if (!isAuthorized) {
    throw new Error('Tidak memiliki akses untuk membuat atau mengedit tugas.');
  }

  const userOrgId = userProfile.organizationId;
  const childOrgIds = userProfile.organization?.children.map((c) => c.id) || [];
  const allowedOrgs = userOrgId ? [userOrgId, ...childOrgIds] : [];

  const [generations, classes, materials, rawStudents, teachers, existingAssignment] =
    await Promise.all([
      prisma.generation.findMany({
        orderBy: { minAge: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          minAge: true,
          maxAge: true,
          description: true,
        },
      }),
      prisma.class.findMany({
        where: allowedOrgs.length > 0 ? { organizationId: { in: allowedOrgs } } : undefined,
        select: { id: true, name: true, generationId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.material.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          description: true,
          targetGenerationId: true,
          targetGeneration: {
            select: { id: true, name: true, code: true },
          },
          checklistItems: {
            select: { id: true, itemTitle: true, pointsWeight: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { title: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          roles: { some: { role: 'SANTRI' } },
          status: 'ACTIVE',
          ...(allowedOrgs.length > 0 ? { organizationId: { in: allowedOrgs } } : {}),
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          generationId: true,
          generation: { select: { id: true, name: true, code: true } },
          organization: { select: { id: true, name: true, type: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          roles: { some: { role: { in: ['PENGAJAR', 'WALI_KELAS'] } } },
          status: 'ACTIVE',
          ...(allowedOrgs.length > 0 ? { organizationId: { in: allowedOrgs } } : {}),
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
        orderBy: { fullName: 'asc' },
      }),
      assignmentId
        ? prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: {
              material: { select: { id: true, title: true } },
            },
          })
        : Promise.resolve(null),
    ]);

  return {
    userProfile: {
      id: userProfile.id,
      fullName: userProfile.fullName,
      organizationName: userProfile.organization?.name || '',
    },
    availableGenerations: generations.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      minAge: g.minAge,
      maxAge: g.maxAge,
      description: g.description,
      studentCount: rawStudents.filter((s) => s.generationId === g.id).length,
    })),
    availableClasses: classes,
    availableMaterials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      targetGenerationId: m.targetGenerationId,
      targetGenerationName: m.targetGeneration?.name || null,
      targetGenerationCode: m.targetGeneration?.code || null,
      checklistCount: m.checklistItems.length,
      checklistItems: m.checklistItems,
    })),
    availableStudents: rawStudents.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      generationId: s.generationId,
      generationCode: s.generation?.code || null,
      generationName: s.generation?.name || 'Santri',
      organizationName: s.organization?.name || null,
      avatarUrl: s.avatarUrl,
    })),
    availableTeachers: teachers.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      avatarUrl: t.avatarUrl,
    })),
    existingAssignment: existingAssignment
      ? {
          id: existingAssignment.id,
          title: existingAssignment.title,
          description: existingAssignment.description,
          taskType: existingAssignment.taskType,
          materialId: existingAssignment.materialId,
          materialTitle: existingAssignment.material?.title || null,
          dueDate: existingAssignment.dueDate ? existingAssignment.dueDate.toISOString() : null,
          pointsReward: existingAssignment.pointsReward,
          parentBonusPoints: existingAssignment.parentBonusPoints,
          requiresParentVerification: existingAssignment.requiresParentVerification,
          config: parseAssignmentConfig(existingAssignment.attachmentUrl),
        }
      : null,
  };
}

/**
 * Pembuat tugas memperbarui daftar pengajar pembantu yang memiliki hak akses koreksi
 */
export async function updateAssignmentGraders({
  assignmentId,
  graderIds,
}: {
  assignmentId: string;
  graderIds: string[];
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { error: 'Tidak terautentikasi' };
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { teacherId: true, organizationId: true, attachmentUrl: true },
    });

    if (!assignment) {
      return { error: 'Tugas tidak ditemukan' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });
    if (!userProfile) {
      return { error: 'Profil pengguna tidak ditemukan.' };
    }

    const canManage = await canUserManageAssignment(userProfile, assignment);
    if (!canManage) {
      return { error: 'Hanya pembuat tugas atau PJ wilayah yang dapat mengatur akses koreksi.' };
    }

    const config = parseAssignmentConfig(assignment.attachmentUrl);
    config.assistantGraderIds = graderIds;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        attachmentUrl: serializeAssignmentConfig(config),
      },
    });

    revalidatePath(`/tugas/${assignmentId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Gagal memperbarui akses koreksi.' };
  }
}

/**
 * Mengambil data detail pengerjaan satu santri untuk halaman koreksi terpisah
 */
export async function getSubmissionForGrading(assignmentId: string, submissionId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: true },
  });

  if (!userProfile) {
    throw new Error('Profil pengguna tidak ditemukan');
  }

  const roleCodes = userProfile.roles.map((r) => r.role);
  const isAdmin = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      teacher: { select: { id: true, fullName: true, avatarUrl: true } },
      organization: { select: { id: true, name: true, type: true } },
      material: { select: { id: true, title: true } },
      submissions: {
        select: {
          id: true,
          status: true,
          score: true,
          student: { select: { id: true, fullName: true } },
        },
        orderBy: { submittedAt: 'asc' },
      },
    },
  });

  if (!assignment) {
    throw new Error('Tugas tidak ditemukan');
  }

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          generation: { select: { id: true, name: true, code: true } },
        },
      },
      parentVerification: {
        include: {
          parent: { select: { fullName: true } },
        },
      },
    },
  });

  if (!submission || submission.assignmentId !== assignmentId) {
    throw new Error('Pengumpulan tugas santri tidak ditemukan');
  }

  const config = parseAssignmentConfig(assignment.attachmentUrl);
  const isOwner = await canUserManageAssignment(userProfile, {
    organizationId: assignment.organization.id,
    teacherId: assignment.teacher.id,
  });
  const isAssistantGrader = Boolean(config.assistantGraderIds?.includes(userProfile.id));
  const canGrade = isOwner || isAssistantGrader;

  const allSubIds = assignment.submissions.map((s) => s.id);
  const currentIndex = allSubIds.indexOf(submissionId);
  const prevSubmissionId = currentIndex > 0 ? allSubIds[currentIndex - 1] : null;
  const nextSubmissionId =
    currentIndex >= 0 && currentIndex < allSubIds.length - 1 ? allSubIds[currentIndex + 1] : null;

  return {
    canGrade,
    isOwner,
    isAssistantGrader,
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      taskType: assignment.taskType,
      requiresParentVerification: assignment.requiresParentVerification,
      pointsReward: assignment.pointsReward,
      parentBonusPoints: assignment.parentBonusPoints,
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      teacherName: assignment.teacher.fullName,
      materialTitle: assignment.material?.title || null,
      config,
    },
    submission: {
      id: submission.id,
      studentId: submission.student.id,
      studentName: submission.student.fullName,
      studentAvatar: submission.student.avatarUrl,
      generationName: submission.student.generation?.name || 'Santri',
      submissionText: submission.submissionText,
      mediaFileUrl: submission.mediaFileUrl,
      status: submission.status,
      score: submission.score,
      teacherFeedback: submission.teacherFeedback,
      submittedAt: submission.submittedAt.toISOString(),
      isVerifiedByParent: Boolean(submission.parentVerification?.isVerifiedByParent),
      parentVerifierName: submission.parentVerification?.parent?.fullName || null,
      parentFeedback: submission.parentVerification?.parentFeedback || null,
    },
    navigation: {
      currentIndex: currentIndex + 1,
      totalSubmissions: allSubIds.length,
      prevSubmissionId,
      nextSubmissionId,
      allSubmissions: assignment.submissions.map((s) => ({
        id: s.id,
        studentName: s.student.fullName,
        status: s.status,
        score: s.score,
      })),
    },
  };
}
