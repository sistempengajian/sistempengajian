import prisma from '@/lib/prisma';
import { UserRole, OrganizationType } from '@prisma/client';
import {
  UsersOverviewData,
  UserWithRelations,
  FormReferenceData,
  OrganizationOption,
  GenerationOption,
} from '@/components/users/types';
import {
  getScopedOrganizationIds,
  getManageableRoles,
  canManageTargetUser,
} from '@/lib/scoped-access';

/**
 * Mengambil data ikhtisar pengguna dengan filter, paginasi, dan isolasi RBAC ketat (Scoped RBAC)
 */
export async function getUsersOverview(
  currentUserId: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<UsersOverviewData> {
  // 1. Ambil profil dan peran pengguna aktif
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      roles: true,
      organization: true,
    },
  });

  if (!currentUser) {
    throw new Error('Pengguna tidak ditemukan atau sesi telah berakhir.');
  }

  const currentUserRoles = currentUser.roles.map((r) => r.role);
  const isAdmin = currentUserRoles.includes('ADMIN_MASTER');
  const isPjDaerah = currentUserRoles.includes('PJ_DAERAH');
  const isPjDesa = currentUserRoles.includes('PJ_DESA');
  const isPjKelompok = currentUserRoles.includes('PJ_KELOMPOK');
  const isPj = isPjDaerah || isPjDesa || isPjKelompok;

  const canManageUsers = isAdmin || isPj;

  // Daftar peran yang berhak dikelola dan ditugaskan
  const manageableRoles = getManageableRoles(currentUserRoles);
  const allowedRolesToAssign = manageableRoles;

  let userScopeRole: UserRole = 'SANTRI';
  if (isAdmin) userScopeRole = 'ADMIN_MASTER';
  else if (isPjDaerah) userScopeRole = 'PJ_DAERAH';
  else if (isPjDesa) userScopeRole = 'PJ_DESA';
  else if (isPjKelompok) userScopeRole = 'PJ_KELOMPOK';

  // 2. Lingkup organisasi
  const scopedOrgIds = await getScopedOrganizationIds(
    currentUserRoles,
    currentUser.organizationId
  );

  // Jika non-admin dan tidak memiliki wilayah binaan valid, kembalikan data kosong
  if (scopedOrgIds !== null && scopedOrgIds.length === 0) {
    return {
      users: [],
      metrics: {
        totalUsers: 0,
        totalSantri: 0,
        totalPengajar: 0,
        totalPj: 0,
        totalOrangTua: 0,
        totalAdmin: 0,
        activeUsers: 0,
      },
      pagination: {
        page: 1,
        limit: 16,
        total: 0,
        totalPages: 1,
      },
      currentUserPermissions: {
        canCreateUser: false,
        canEditUser: false,
        canDeleteUser: false,
        allowedRolesToAssign: [],
        manageableRoles: [],
        userScopeRole,
      },
    };
  }

  // 3. Tentukan peran-peran yang TIDAK boleh dilihat oleh pengguna (Proteksi Hirarkis)
  const excludedRoles: UserRole[] = [];
  if (!isAdmin) {
    // Non-admin sama sekali tidak boleh melihat akun Super Admin / Admin Master
    excludedRoles.push('ADMIN_MASTER');
  }
  if (!isAdmin && !isPjDaerah) {
    // Selain Admin Master dan PJ Daerah tidak boleh melihat PJ Daerah
    excludedRoles.push('PJ_DAERAH');
  }
  if (!isAdmin && !isPjDaerah && !isPjDesa) {
    // PJ Kelompok tidak boleh melihat PJ Desa
    excludedRoles.push('PJ_DESA');
  }

  // 4. Ekstraksi Search & Filter Params
  const roleFilter = typeof searchParams.role === 'string' ? searchParams.role : undefined;
  const orgFilter = typeof searchParams.organizationId === 'string' ? searchParams.organizationId : undefined;
  const genFilter = typeof searchParams.generationId === 'string' ? searchParams.generationId : undefined;
  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : undefined;

  const page = Math.max(1, parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1', 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(typeof searchParams.limit === 'string' ? searchParams.limit : '20', 10) || 20));
  const skip = (page - 1) * limit;

  // 5. Susun Prisma Where Clause
  const whereClause: any = {};

  // Batasan Scoped Organization
  if (scopedOrgIds !== null) {
    whereClause.organizationId = { in: scopedOrgIds };
  }

  // Filter organisasi spesifik (hanya jika berada dalam scope yang sah)
  if (orgFilter) {
    if (scopedOrgIds === null || scopedOrgIds.includes(orgFilter)) {
      whereClause.organizationId = orgFilter;
    } else {
      // Jika mencoba filter ke organisasi di luar kewenangan, paksa kosong
      whereClause.organizationId = '00000000-0000-0000-0000-000000000000';
    }
  }

  if (genFilter) {
    whereClause.generationId = genFilter;
  }

  if (statusFilter && statusFilter !== 'ALL') {
    whereClause.status = statusFilter;
  }

  // Filter peran dengan proteksi excludedRoles
  if (roleFilter && roleFilter !== 'ALL') {
    if (excludedRoles.includes(roleFilter as UserRole)) {
      // Jika mencoba filter peran terlarang (misal PJ meminta role ADMIN_MASTER), kembalikan kosong
      whereClause.id = '00000000-0000-0000-0000-000000000000';
    } else {
      whereClause.roles = {
        some: {
          role: roleFilter as UserRole,
        },
      };
    }
  } else if (excludedRoles.length > 0) {
    // Jika melihat semua peran, kecualikan akun Super Admin & peran di atas wewenangnya
    whereClause.roles = {
      none: {
        role: { in: excludedRoles },
      },
    };
  }

  if (search) {
    whereClause.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { organization: { name: { contains: search, mode: 'insensitive' } } },
      { generation: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // 6. Query paralel untuk data paginasi dan metrik ringkasan terisolasi
  const baseScopedWhere: any = {};
  if (scopedOrgIds !== null) {
    baseScopedWhere.organizationId = { in: scopedOrgIds };
  }
  if (excludedRoles.length > 0) {
    baseScopedWhere.roles = {
      none: { role: { in: excludedRoles } },
    };
  }

  const [
    rawUsers,
    totalCount,
    totalAll,
    totalSantri,
    totalPengajar,
    totalPj,
    totalOrangTua,
    totalAdmin,
    totalActive,
  ] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        organization: {
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        generation: true,
        roles: true,
        parents: {
          include: {
            parent: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
              },
            },
          },
        },
        children: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                gender: true,
                generation: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
                organization: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            homeroomClasses: true,
            assignmentsCreated: true,
            assignmentSubmissions: true,
            attendanceRecords: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { fullName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where: whereClause }),
    prisma.user.count({ where: baseScopedWhere }),
    prisma.user.count({
      where: {
        ...baseScopedWhere,
        roles: { some: { role: 'SANTRI' } },
      },
    }),
    prisma.user.count({
      where: {
        ...baseScopedWhere,
        roles: { some: { role: { in: ['PENGAJAR', 'WALI_KELAS'] } } },
      },
    }),
    prisma.user.count({
      where: {
        ...baseScopedWhere,
        roles: {
          some: { role: { in: ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH'] } },
        },
      },
    }),
    prisma.user.count({
      where: {
        ...baseScopedWhere,
        roles: { some: { role: 'ORANG_TUA' } },
      },
    }),
    isAdmin
      ? prisma.user.count({
          where: {
            ...baseScopedWhere,
            roles: { some: { role: 'ADMIN_MASTER' } },
          },
        })
      : Promise.resolve(0),
    prisma.user.count({
      where: {
        ...baseScopedWhere,
        status: 'ACTIVE',
      },
    }),
  ]);

  // 7. Transformasi data agar sesuai dengan UserWithRelations
  const users: UserWithRelations[] = rawUsers.map((u) => {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      gender: u.gender,
      avatarUrl: u.avatarUrl,
      birthPlace: u.birthPlace,
      birthDate: u.birthDate,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      organizationId: u.organizationId,
      organization: u.organization
        ? {
            id: u.organization.id,
            name: u.organization.name,
            type: u.organization.type,
            parentName: u.organization.parent?.name || null,
          }
        : null,
      generationId: u.generationId,
      generation: u.generation
        ? {
            id: u.generation.id,
            name: u.generation.name,
            code: u.generation.code,
            color: u.generation.color,
          }
        : null,
      roles: u.roles.map((r) => ({ id: r.id, role: r.role })),
      parents: u.parents.map((p) => ({
        id: p.id,
        relationshipType: p.relationshipType,
        parent: p.parent,
      })),
      children: u.children.map((c) => ({
        id: c.id,
        relationshipType: c.relationshipType,
        student: c.student,
      })),
      stats: {
        classesCount: u._count.homeroomClasses,
        assignmentsCount: u._count.assignmentsCreated,
        submissionsCount: u._count.assignmentSubmissions,
        attendancesCount: u._count.attendanceRecords,
      },
    };
  });

  return {
    users,
    metrics: {
      totalUsers: totalAll,
      totalSantri,
      totalPengajar,
      totalPj,
      totalOrangTua,
      totalAdmin,
      activeUsers: totalActive,
    },
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    currentUserPermissions: {
      canCreateUser: canManageUsers,
      canEditUser: canManageUsers,
      canDeleteUser: isAdmin || isPjDaerah,
      allowedRolesToAssign,
      manageableRoles,
      userScopeRole,
    },
  };
}

/**
 * Mengambil detail pengguna tunggal untuk formulir edit dengan validasi Scoped RBAC
 */
export async function getUserById(
  targetUserId: string,
  currentUserId: string
): Promise<UserWithRelations | null> {
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { roles: true },
  });

  if (!currentUser) return null;

  const rawUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      organization: {
        include: {
          parent: true,
        },
      },
      generation: true,
      roles: true,
      parents: {
        include: {
          parent: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      },
      children: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              generation: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              organization: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          homeroomClasses: true,
          assignmentsCreated: true,
          assignmentSubmissions: true,
          attendanceRecords: true,
        },
      },
    },
  });

  if (!rawUser) return null;

  // Validasi keamanan: manajer tidak boleh mengakses pengguna di luar wewenang
  const accessCheck = await canManageTargetUser(
    {
      id: currentUser.id,
      roles: currentUser.roles.map((r) => r.role),
      organizationId: currentUser.organizationId,
    },
    {
      id: rawUser.id,
      roles: rawUser.roles.map((r) => r.role),
      organizationId: rawUser.organizationId,
    }
  );

  if (!accessCheck.allowed) {
    return null;
  }

  return {
    id: rawUser.id,
    email: rawUser.email,
    username: rawUser.username,
    fullName: rawUser.fullName,
    phoneNumber: rawUser.phoneNumber,
    gender: rawUser.gender,
    avatarUrl: rawUser.avatarUrl,
    status: rawUser.status,
    createdAt: rawUser.createdAt,
    updatedAt: rawUser.updatedAt,
    organizationId: rawUser.organizationId,
    organization: rawUser.organization
      ? {
          id: rawUser.organization.id,
          name: rawUser.organization.name,
          type: rawUser.organization.type,
          parentName: rawUser.organization.parent?.name || null,
        }
      : null,
    generationId: rawUser.generationId,
    generation: rawUser.generation
      ? {
          id: rawUser.generation.id,
          name: rawUser.generation.name,
          code: rawUser.generation.code,
          color: rawUser.generation.color,
        }
      : null,
    roles: rawUser.roles.map((r) => ({ id: r.id, role: r.role })),
    parents: rawUser.parents.map((p) => ({
      id: p.id,
      relationshipType: p.relationshipType,
      parent: p.parent,
    })),
    children: rawUser.children.map((c) => ({
      id: c.id,
      relationshipType: c.relationshipType,
      student: c.student,
    })),
    stats: {
      classesCount: rawUser._count.homeroomClasses,
      assignmentsCount: rawUser._count.assignmentsCreated,
      submissionsCount: rawUser._count.assignmentSubmissions,
      attendancesCount: rawUser._count.attendanceRecords,
    },
  };
}

/**
 * Mengambil data referensi untuk formulir tambah & edit pengguna yang disaring sesuai wewenang
 */
export async function getFormReferenceData(
  currentUserId: string
): Promise<FormReferenceData> {
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { roles: true },
  });

  if (!currentUser) {
    throw new Error('Sesi tidak valid.');
  }

  const currentUserRoles = currentUser.roles.map((r) => r.role);
  const scopedOrgIds = await getScopedOrganizationIds(
    currentUserRoles,
    currentUser.organizationId
  );

  const orgWhere: any = {};
  if (scopedOrgIds !== null) {
    orgWhere.id = { in: scopedOrgIds };
  }

  const [rawOrgs, rawGenerations] = await Promise.all([
    prisma.organization.findMany({
      where: orgWhere,
      include: {
        parent: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.generation.findMany({
      orderBy: { minAge: 'asc' },
    }),
  ]);

  const organizations: OrganizationOption[] = rawOrgs.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    parentId: o.parentId,
    parentName: o.parent?.name || null,
  }));

  const generations: GenerationOption[] = rawGenerations.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    color: g.color,
  }));

  const manageableRoles = getManageableRoles(currentUserRoles);

  const ALL_ROLE_DESCRIPTIONS = [
    {
      role: UserRole.SANTRI,
      label: 'Santri Binaan',
      description: 'Peserta pengajian generasi unggul berkarakter.',
    },
    {
      role: UserRole.ORANG_TUA,
      label: 'Orang Tua / Wali',
      description: 'Pendamping santri di rumah untuk verifikasi tugas & notifikasi absensi.',
    },
    {
      role: UserRole.PENGAJAR,
      label: 'Pengajar / Ustadz',
      description: 'Dewan guru pengampu materi, kurikulum, dan koreksi penugasan.',
    },
    {
      role: UserRole.WALI_KELAS,
      label: 'Wali Kelas',
      description: 'Ustadz pembina utama kelas dan monitoring perkembangan adab santri.',
    },
    {
      role: UserRole.PJ_KELOMPOK,
      label: 'PJ Kelompok',
      description: 'Penanggung jawab pembinaan pengajian tingkat kelompok (masjid).',
    },
    {
      role: UserRole.PJ_DESA,
      label: 'PJ Desa',
      description: 'Supervisi pengajian tingkat desa dan koordinasi kelompok binaan.',
    },
    {
      role: UserRole.PJ_DAERAH,
      label: 'PJ Daerah',
      description: 'Koordinator wilayah tingkat daerah / kota / kabupaten.',
    },
    {
      role: UserRole.ADMIN_MASTER,
      label: 'Admin Master',
      description: 'Super administrator pengelola sistem pusat.',
    },
  ];

  // Hanya kembalikan peran yang berhak dikelola/ditugaskan oleh pengguna
  const availableRoles = ALL_ROLE_DESCRIPTIONS.filter((r) =>
    manageableRoles.includes(r.role)
  );

  return {
    organizations,
    generations,
    availableRoles,
  };
}
