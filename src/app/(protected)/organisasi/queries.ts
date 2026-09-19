import prisma from '@/lib/prisma';
import { OrganizationType } from '@prisma/client';
import {
  OrganizationsOverviewData,
  OrganizationWithStats,
  OrganizationTreeNode,
  ParentOption,
} from '@/components/organisasi/types';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

/**
 * Mengambil data organisasi, statistik agregasi, dan struktur pohon hierarki
 * yang telah dibatasi secara ketat berdasarkan lingkup wewenang wilayah pengguna (Scoped RBAC).
 */
export async function getOrganizationsData(userId: string): Promise<OrganizationsOverviewData> {
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      organizationId: true,
      organization: {
        select: { type: true },
      },
      roles: {
        select: { role: true },
      },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');

  const canEdit = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;
  const canView = roleCodes.some((r) =>
    [
      'ADMIN_MASTER',
      'PJ_DAERAH',
      'PJ_DESA',
      'PJ_KELOMPOK',
      'PENGAJAR',
      'WALI_KELAS',
      'SANTRI',
      'ORANG_TUA',
    ].includes(r)
  );

  if (!canView) {
    return {
      organizations: [],
      tree: [],
      metrics: {
        totalDaerah: 0,
        totalDesa: 0,
        totalKelompok: 0,
        totalUsers: 0,
      },
      userPermissions: {
        canEdit: false,
        canView: false,
        roleCodes,
        userOrgId: userProfile?.organizationId || null,
        userOrgType: userProfile?.organization?.type || null,
        editableOrgIds: [],
        deletableOrgIds: [],
        canCreateOrg: false,
      },
    };
  }

  // 1. Dapatkan daftar ID organisasi yang berada dalam kewenangan wilayah pengguna
  const scopedOrgIds = await getScopedOrganizationIds(
    roleCodes,
    userProfile?.organizationId || null
  );

  // Jika non-admin dan tidak memiliki wilayah binaan yang valid
  if (scopedOrgIds !== null && scopedOrgIds.length === 0) {
    return {
      organizations: [],
      tree: [],
      metrics: {
        totalDaerah: 0,
        totalDesa: 0,
        totalKelompok: 0,
        totalUsers: 0,
      },
      userPermissions: {
        canEdit: false,
        canView: true,
        roleCodes,
        userOrgId: userProfile?.organizationId || null,
        userOrgType: userProfile?.organization?.type || null,
        editableOrgIds: [],
        deletableOrgIds: [],
        canCreateOrg: false,
      },
    };
  }

  const orgWhere: any = {};
  if (scopedOrgIds !== null) {
    orgWhere.id = { in: scopedOrgIds };
  }

  // 2. Fetch data organisasi dalam lingkup wilayah
  const rawOrganizations = await prisma.organization.findMany({
    where: orgWhere,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      _count: {
        select: {
          children: true,
          users: true,
          classes: true,
          materials: true,
          schedules: true,
        },
      },
    },
  });

  // 3. Hitung jumlah santri & pengajar spesifik per organisasi
  const usersByOrgAndRole = await prisma.user.findMany({
    where: {
      organizationId: scopedOrgIds !== null ? { in: scopedOrgIds } : { not: null },
    },
    select: {
      organizationId: true,
      roles: {
        select: { role: true },
      },
    },
  });

  const studentCountMap: Record<string, number> = {};
  const teacherCountMap: Record<string, number> = {};

  usersByOrgAndRole.forEach((u) => {
    if (!u.organizationId) return;
    const isStudent = u.roles.some((r) => r.role === 'SANTRI');
    const isTeacher = u.roles.some((r) => r.role === 'PENGAJAR' || r.role === 'WALI_KELAS');

    if (isStudent) {
      studentCountMap[u.organizationId] = (studentCountMap[u.organizationId] || 0) + 1;
    }
    if (isTeacher) {
      teacherCountMap[u.organizationId] = (teacherCountMap[u.organizationId] || 0) + 1;
    }
  });

  // 4. Susun daftar organisasi dengan statistik
  const organizations: OrganizationWithStats[] = rawOrganizations.map((org) => ({
    id: org.id,
    name: org.name,
    type: org.type,
    parentId: org.parentId,
    parentName: org.parent?.name || null,
    parentType: org.parent?.type || null,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    childrenCount: org._count.children,
    userCount: org._count.users,
    studentCount: studentCountMap[org.id] || 0,
    teacherCount: teacherCountMap[org.id] || 0,
    classCount: org._count.classes,
    materialCount: org._count.materials,
    scheduleCount: org._count.schedules,
  }));

  // 5. Hitung metrik terisolasi hanya untuk wilayah binaan ini
  let totalDaerah = 0;
  let totalDesa = 0;
  let totalKelompok = 0;
  let totalUsers = 0;

  organizations.forEach((org) => {
    if (org.type === 'DAERAH') totalDaerah++;
    else if (org.type === 'DESA') totalDesa++;
    else if (org.type === 'KELOMPOK') totalKelompok++;
    totalUsers += org.userCount;
  });

  // 6. Susun struktur pohon hierarki (Tree Structure) terisolasi
  const orgMap = new Map<string, OrganizationTreeNode>();
  organizations.forEach((org) => {
    orgMap.set(org.id, {
      id: org.id,
      name: org.name,
      type: org.type,
      parentId: org.parentId,
      children: [],
      stats: {
        users: org.userCount,
        classes: org.classCount,
        materials: org.materialCount,
      },
    });
  });

  const tree: OrganizationTreeNode[] = [];
  organizations.forEach((org) => {
    const node = orgMap.get(org.id);
    if (!node) return;

    // Masukkan sebagai anak hanya jika parent-nya ada dalam lingkup wilayah ini
    if (org.parentId && orgMap.has(org.parentId)) {
      const parentNode = orgMap.get(org.parentId);
      parentNode?.children.push(node);
    } else {
      // Jika parent di luar lingkup (misal Desa bagi PJ Desa), maka jadikan node ini sebagai root tampilan
      tree.push(node);
    }
  });

  // 7. Hitung hak akses edit & hapus granular per item organisasi
  const editableOrgIds: string[] = [];
  const deletableOrgIds: string[] = [];

  organizations.forEach((org) => {
    if (isAdmin) {
      editableOrgIds.push(org.id);
      deletableOrgIds.push(org.id);
    } else if (isPjDaerah) {
      editableOrgIds.push(org.id);
      // PJ Daerah boleh hapus Desa & Kelompok binaannya, tapi TIDAK boleh hapus Daerah
      if (org.type !== 'DAERAH') {
        deletableOrgIds.push(org.id);
      }
    } else if (isPjDesa) {
      // PJ Desa boleh edit Desanya dan Kelompok di bawahnya
      if (org.type === 'DESA' || org.type === 'KELOMPOK') {
        editableOrgIds.push(org.id);
      }
      // PJ Desa hanya boleh hapus Kelompok binaannya (TIDAK boleh hapus Desanya sendiri)
      if (org.type === 'KELOMPOK') {
        deletableOrgIds.push(org.id);
      }
    } else if (isPjKelompok) {
      // PJ Kelompok hanya boleh mengedit Kelompok binaannya sendiri
      if (org.type === 'KELOMPOK' && org.id === userProfile?.organizationId) {
        editableOrgIds.push(org.id);
      }
    }
  });

  const canCreateOrg = isAdmin || isPjDaerah || isPjDesa;

  return {
    organizations,
    tree,
    metrics: {
      totalDaerah,
      totalDesa,
      totalKelompok,
      totalUsers,
    },
    userPermissions: {
      canEdit,
      canView,
      roleCodes,
      userOrgId: userProfile?.organizationId || null,
      userOrgType: userProfile?.organization?.type || null,
      editableOrgIds,
      deletableOrgIds,
      canCreateOrg,
    },
  };
}

/**
 * Mengambil opsi induk wilayah (parent options) yang disaring khusus sesuai wewenang pengguna
 */
export async function getParentOptions(userId?: string): Promise<{
  daerahList: ParentOption[];
  desaList: ParentOption[];
}> {
  let scopedOrgIds: string[] | null = null;
  let isAdmin = false;
  let isPjDaerah = false;
  let isPjDesa = false;
  let userOrgId: string | null = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, roles: { select: { role: true } } },
    });
    if (user) {
      userOrgId = user.organizationId;
      const roleCodes = user.roles.map((r) => r.role);
      isAdmin = roleCodes.includes('ADMIN_MASTER');
      isPjDaerah = roleCodes.includes('PJ_DAERAH');
      isPjDesa = roleCodes.includes('PJ_DESA');
      scopedOrgIds = await getScopedOrganizationIds(roleCodes, userOrgId);
    }
  }

  // Jika bukan admin dan tidak ada wilayah binaan valid
  if (!isAdmin && scopedOrgIds !== null && scopedOrgIds.length === 0) {
    return { daerahList: [], desaList: [] };
  }

  const daerahWhere: any = { type: 'DAERAH' };
  if (!isAdmin) {
    if (isPjDaerah && userOrgId) {
      // PJ Daerah hanya bisa memilih Daerah miliknya sendiri sebagai induk Desa
      daerahWhere.id = userOrgId;
    } else {
      // Peran selain PJ Daerah & Admin tidak bisa membuat Desa (daerahList kosong)
      daerahWhere.id = { in: [] };
    }
  }

  const desaWhere: any = { type: 'DESA' };
  if (!isAdmin) {
    if (isPjDaerah && scopedOrgIds) {
      // PJ Daerah dapat memilih Desa-Desa di bawah Daerahnya sebagai induk Kelompok
      desaWhere.id = { in: scopedOrgIds };
    } else if (isPjDesa && userOrgId) {
      // PJ Desa hanya dapat memilih Desa miliknya sendiri sebagai induk Kelompok
      desaWhere.id = userOrgId;
    } else {
      desaWhere.id = { in: [] };
    }
  }

  const [daerahList, rawDesaList] = await Promise.all([
    prisma.organization.findMany({
      where: daerahWhere,
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.organization.findMany({
      where: desaWhere,
      select: {
        id: true,
        name: true,
        type: true,
        parent: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const desaList: ParentOption[] = rawDesaList.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    parentName: d.parent?.name || null,
  }));

  return { daerahList, desaList };
}

/**
 * Mengambil data detail organisasi untuk halaman edit beserta calon parent yang valid sesuai wewenang
 */
export async function getOrganizationById(
  id: string,
  userId: string
): Promise<{
  canEdit: boolean;
  organization: OrganizationWithStats | null;
  parentOptions: ParentOption[];
}> {
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      roles: { select: { role: true } },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');

  const canEditAny = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;
  if (!canEditAny) {
    return { canEdit: false, organization: null, parentOptions: [] };
  }

  const scopedOrgIds = await getScopedOrganizationIds(
    roleCodes,
    userProfile?.organizationId || null
  );

  // Jika organisasi target berada di luar wewenang wilayah pengguna
  if (scopedOrgIds !== null && !scopedOrgIds.includes(id)) {
    return { canEdit: false, organization: null, parentOptions: [] };
  }

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      parent: {
        select: { id: true, name: true, type: true },
      },
      _count: {
        select: {
          children: true,
          users: true,
          classes: true,
          materials: true,
          schedules: true,
        },
      },
    },
  });

  if (!org) {
    return { canEdit: true, organization: null, parentOptions: [] };
  }

  // Cek hierarki wewenang:
  // PJ Desa tidak boleh mengedit tingkatan Daerah
  if (isPjDesa && org.type === 'DAERAH') {
    return { canEdit: false, organization: null, parentOptions: [] };
  }

  // PJ Kelompok hanya boleh mengedit Kelompok binaannya sendiri
  if (isPjKelompok && (org.type !== 'KELOMPOK' || org.id !== userProfile?.organizationId)) {
    return { canEdit: false, organization: null, parentOptions: [] };
  }

  // Hitung santri & pengajar
  const users = await prisma.user.findMany({
    where: { organizationId: id },
    select: {
      roles: { select: { role: true } },
    },
  });

  const studentCount = users.filter((u) => u.roles.some((r) => r.role === 'SANTRI')).length;
  const teacherCount = users.filter((u) =>
    u.roles.some((r) => r.role === 'PENGAJAR' || r.role === 'WALI_KELAS')
  ).length;

  const organizationWithStats: OrganizationWithStats = {
    id: org.id,
    name: org.name,
    type: org.type,
    parentId: org.parentId,
    parentName: org.parent?.name || null,
    parentType: org.parent?.type || null,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    childrenCount: org._count.children,
    userCount: org._count.users,
    studentCount,
    teacherCount,
    classCount: org._count.classes,
    materialCount: org._count.materials,
    scheduleCount: org._count.schedules,
  };

  // Opsi parent terfilter berdasarkan scope pengguna
  let parentOptions: ParentOption[] = [];

  if (org.type === 'DESA') {
    const daerahWhere: any = {
      type: 'DAERAH',
      id: { not: org.id },
    };
    if (!isAdmin && isPjDaerah && userProfile?.organizationId) {
      daerahWhere.id = userProfile.organizationId;
    }
    const daerahs = await prisma.organization.findMany({
      where: daerahWhere,
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });
    parentOptions = daerahs;
  } else if (org.type === 'KELOMPOK') {
    const desaWhere: any = {
      type: 'DESA',
      id: { not: org.id },
    };
    if (!isAdmin) {
      if (isPjDaerah && scopedOrgIds) {
        desaWhere.id = { in: scopedOrgIds, not: org.id };
      } else if (isPjDesa && userProfile?.organizationId) {
        desaWhere.id = userProfile.organizationId;
      }
    }
    const desas = await prisma.organization.findMany({
      where: desaWhere,
      select: {
        id: true,
        name: true,
        type: true,
        parent: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    parentOptions = desas.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      parentName: d.parent?.name || null,
    }));
  }

  return {
    canEdit: true,
    organization: organizationWithStats,
    parentOptions,
  };
}
