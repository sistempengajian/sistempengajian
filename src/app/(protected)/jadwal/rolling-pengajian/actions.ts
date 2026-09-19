'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { RollingTargetScope, TierLevel, UserRole } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

export interface RollingPengajianInput {
  name: string;
  description?: string | null;
  targetScope: RollingTargetScope;
  classIds?: string[];
  generationIds?: string[];
  materialRollingId: string;
  teacherRollingId: string;
  venuePlaceName: string;
  venueType?: string | null;
}

export interface ServerUserContext {
  userId: string;
  organizationId?: string | null;
  roleCodes: UserRole[];
}

/**
 * Mengambil daftar data referensi (Template Materi, Template Pengajar, Kelas, dan Generasi)
 * yang tersedia untuk wilayah pengguna aktif.
 */
export async function getRollingReferenceData(userCtx?: ServerUserContext) {
  let userId = userCtx?.userId;
  let organizationId = userCtx?.organizationId;
  let roleCodes = userCtx?.roleCodes;

  if (!userId || !roleCodes) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Anda harus login untuk mengakses data ini.', data: null };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        organization: true,
      },
    });

    userId = user.id;
    organizationId = userProfile?.organizationId;
    roleCodes = userProfile?.roles.map((r) => r.role as UserRole) || [];
  }

  const isAdmin = roleCodes.includes('ADMIN_MASTER');

  if (!organizationId && !isAdmin) {
    return { error: 'Pengguna tidak terdaftar dalam wilayah.', data: null };
  }

  // Get inclusive organization IDs:
  // 1. Current org and ancestors (so Kelompok can see templates from parent Desa and grandparent Daerah)
  // 2. Descendants (so Daerah can see all Desa and Kelompok)
  let orgFilter: { in: string[] } | undefined = undefined;

  if (!isAdmin && organizationId) {
    const orgIds = new Set<string>([organizationId]);

    // Ancestors
    const currOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { parent: { include: { parent: true } } },
    });
    if (currOrg?.parentId) orgIds.add(currOrg.parentId);
    if (currOrg?.parent?.parentId) orgIds.add(currOrg.parent.parentId);

    // Descendants based on roles
    const scopedOrgIds = await getScopedOrganizationIds(roleCodes, organizationId);
    if (scopedOrgIds) {
      scopedOrgIds.forEach((id) => orgIds.add(id));
    }

    orgFilter = { in: Array.from(orgIds) };
  }

  try {
    const [classes, generations, materialRollings, teacherRollings] = await Promise.all([
      // 1. Kelas di wilayah (selalu dimuat)
      prisma.class.findMany({
        where: orgFilter ? { organizationId: orgFilter } : {},
        select: {
          id: true,
          name: true,
          academicYear: true,
          generation: { select: { id: true, name: true, code: true } },
          organization: { select: { id: true, name: true, type: true } },
        },
        orderBy: { name: 'asc' },
      }),

      // 2. Jenjang Usia / Generasi (selalu dimuat)
      prisma.generation.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          minAge: true,
          maxAge: true,
        },
        orderBy: { minAge: 'asc' },
      }),

      // 3. Template Material Rolling
      (prisma as any).materialRolling
        ? prisma.materialRolling.findMany({
            where: {
              isActive: true,
              ...(orgFilter ? { organizationId: orgFilter } : {}),
            },
            include: {
              targetGeneration: { select: { id: true, name: true, code: true } },
              organization: { select: { id: true, name: true, type: true } },
              queues: {
                orderBy: { stepOrder: 'asc' },
                include: {
                  items: {
                    orderBy: { slotIndex: 'asc' },
                    include: {
                      material: { select: { id: true, title: true, creatorTierLevel: true } },
                    },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),

      // 4. Template Teacher Rolling
      (prisma as any).teacherRolling
        ? prisma.teacherRolling.findMany({
            where: {
              isActive: true,
              ...(orgFilter ? { organizationId: orgFilter } : {}),
            },
            include: {
              organization: { select: { id: true, name: true, type: true } },
              queues: {
                orderBy: { stepOrder: 'asc' },
                include: {
                  items: {
                    orderBy: { slotIndex: 'asc' },
                    include: {
                      teacher: { select: { id: true, fullName: true, avatarUrl: true } },
                      substituteTeacher: { select: { id: true, fullName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      data: {
        classes,
        generations,
        materialRollings,
        teacherRollings,
      },
    };
  } catch (err: any) {
    console.error('Error fetching rolling reference data:', err);
    return { error: err.message || 'Gagal memuat data referensi.', data: null };
  }
}

/**
 * Mengambil daftar Pengajian Rolling dalam lingkup organisasi user
 */
export async function getRollingPengajianList(userCtx?: ServerUserContext) {
  let organizationId = userCtx?.organizationId;
  let roleCodes = userCtx?.roleCodes;

  if (!organizationId || !roleCodes) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Anda harus login untuk mengakses data ini.', data: [] };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        organization: true,
      },
    });

    if (!userProfile?.organizationId) {
      return { error: 'Pengguna tidak terdaftar dalam wilayah.', data: [] };
    }

    organizationId = userProfile.organizationId;
    roleCodes = userProfile.roles.map((r) => r.role as UserRole);
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, organizationId);

  const whereClause: any = {};
  if (scopedOrgIds !== null) {
    whereClause.organizationId = { in: scopedOrgIds };
  }

  if (!(prisma as any).rollingPengajian) {
    console.warn('prisma.rollingPengajian is not loaded yet in this process.');
    return { data: [], error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    const list = await prisma.rollingPengajian.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        materialRolling: {
          include: {
            targetGeneration: { select: { id: true, name: true } },
            queues: {
              orderBy: { stepOrder: 'asc' },
              include: {
                items: {
                  orderBy: { slotIndex: 'asc' },
                  include: {
                    material: { select: { id: true, title: true, creatorTierLevel: true } },
                  },
                },
              },
            },
          },
        },
        teacherRolling: {
          include: {
            queues: {
              orderBy: { stepOrder: 'asc' },
              include: {
                items: {
                  orderBy: { slotIndex: 'asc' },
                  include: {
                    teacher: { select: { id: true, fullName: true, avatarUrl: true } },
                    substituteTeacher: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
        targetClasses: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                generation: { select: { id: true, name: true } },
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: list };
  } catch (err: any) {
    console.error('Error fetching rolling pengajian list:', err);
    return { error: err.message || 'Gagal memuat daftar pengajian rolling.', data: [] };
  }
}

/**
 * Membuat data Pengajian Rolling baru (Blueprint Gabungan Tahap 1 & 2)
 */
export async function createRollingPengajian(input: RollingPengajianInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk membuat pengajian rolling.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama kegiatan pengajian wajib diisi.' };
  }

  if (!input.materialRollingId) {
    return { error: 'Pilih salah satu template Rolling Materi (Tahap 1).' };
  }

  if (!input.teacherRollingId) {
    return { error: 'Pilih salah satu template Rolling Pengajar (Tahap 2).' };
  }

  const venuePlaceName = input.venuePlaceName?.trim();
  if (!venuePlaceName) {
    return { error: 'Nama tempat/masjid pengajian bawaan wajib diisi.' };
  }

  // Validasi multi-target sesuai targetScope
  if (input.targetScope === 'KELAS') {
    if (!input.classIds || input.classIds.length === 0) {
      return { error: 'Pilih minimal satu kelas untuk sasaran pengajian ini.' };
    }
  } else if (input.targetScope === 'GENERASI') {
    if (!input.generationIds || input.generationIds.length === 0) {
      return { error: 'Pilih minimal satu jenjang usia/generasi untuk sasaran pengajian ini.' };
    }
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      organization: true,
      roles: true,
    },
  });

  if (!userProfile?.organization) {
    return { error: 'Organisasi wilayah pengguna tidak ditemukan.' };
  }

  const tierLevel = userProfile.organization.type as TierLevel;

  if (!(prisma as any).rollingPengajian) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        // 1. Buat master pengajian rolling
        const pengajian = await tx.rollingPengajian.create({
          data: {
            name,
            description: input.description?.trim() || null,
            targetScope: input.targetScope,
            tierLevel,
            organizationId: userProfile.organizationId!,
            materialRollingId: input.materialRollingId,
            teacherRollingId: input.teacherRollingId,
            venuePlaceName,
            venueType: input.venueType || 'MASJID',
          },
        });

        // 2. Hubungkan target multi-kelas jika KELAS via createMany
        if (input.targetScope === 'KELAS' && input.classIds && input.classIds.length > 0) {
          await tx.rollingPengajianClass.createMany({
            data: input.classIds.map((cId) => ({
              rollingPengajianId: pengajian.id,
              classId: cId,
            })),
          });
        }

        // 3. Hubungkan target multi-generasi jika GENERASI via createMany
        if (input.targetScope === 'GENERASI' && input.generationIds && input.generationIds.length > 0) {
          await tx.rollingPengajianGeneration.createMany({
            data: input.generationIds.map((gId) => ({
              rollingPengajianId: pengajian.id,
              generationId: gId,
            })),
          });
        }

        return pengajian;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajian');
    return { success: true, data: created };
  } catch (err: any) {
    console.error('Error creating rolling pengajian:', err);
    return { error: err.message || 'Gagal menyimpan pengajian rolling.' };
  }
}

/**
 * Mengedit data Pengajian Rolling beserta sasaran multi-targetnya
 */
export async function updateRollingPengajian(id: string, input: RollingPengajianInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengedit pengajian rolling.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama kegiatan pengajian wajib diisi.' };
  }

  if (!input.materialRollingId) {
    return { error: 'Pilih salah satu template Rolling Materi (Tahap 1).' };
  }

  if (!input.teacherRollingId) {
    return { error: 'Pilih salah satu template Rolling Pengajar (Tahap 2).' };
  }

  const venuePlaceName = input.venuePlaceName?.trim();
  if (!venuePlaceName) {
    return { error: 'Nama tempat/masjid pengajian bawaan wajib diisi.' };
  }

  if (input.targetScope === 'KELAS') {
    if (!input.classIds || input.classIds.length === 0) {
      return { error: 'Pilih minimal satu kelas untuk sasaran pengajian ini.' };
    }
  } else if (input.targetScope === 'GENERASI') {
    if (!input.generationIds || input.generationIds.length === 0) {
      return { error: 'Pilih minimal satu jenjang usia/generasi untuk sasaran pengajian ini.' };
    }
  }

  if (!(prisma as any).rollingPengajian) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Update master pengajian rolling
        await tx.rollingPengajian.update({
          where: { id },
          data: {
            name,
            description: input.description?.trim() || null,
            targetScope: input.targetScope,
            materialRollingId: input.materialRollingId,
            teacherRollingId: input.teacherRollingId,
            venuePlaceName,
            venueType: input.venueType || 'MASJID',
          },
        });

        // 2. Refresh target classes via createMany
        await tx.rollingPengajianClass.deleteMany({
          where: { rollingPengajianId: id },
        });

        if (input.targetScope === 'KELAS' && input.classIds && input.classIds.length > 0) {
          await tx.rollingPengajianClass.createMany({
            data: input.classIds.map((cId) => ({
              rollingPengajianId: id,
              classId: cId,
            })),
          });
        }

        // 3. Refresh target generations via createMany
        await tx.rollingPengajianGeneration.deleteMany({
          where: { rollingPengajianId: id },
        });

        if (input.targetScope === 'GENERASI' && input.generationIds && input.generationIds.length > 0) {
          await tx.rollingPengajianGeneration.createMany({
            data: input.generationIds.map((gId) => ({
              rollingPengajianId: id,
              generationId: gId,
            })),
          });
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajian');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating rolling pengajian:', err);
    return { error: err.message || 'Gagal memperbarui pengajian rolling.' };
  }
}

/**
 * Menghapus data Pengajian Rolling
 */
export async function deleteRollingPengajian(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk menghapus pengajian rolling.' };
  }

  if (!(prisma as any).rollingPengajian) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.rollingPengajian.delete({
      where: { id },
    });

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajian');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting rolling pengajian:', err);
    return { error: err.message || 'Gagal menghapus pengajian rolling.' };
  }
}
