import prisma from '@/lib/prisma';
import { UserRole, OrganizationType } from '@prisma/client';

/**
 * Mendapatkan daftar ID organisasi yang berada di bawah lingkup kewenangan pengguna (termasuk anak & cucu)
 * - ADMIN_MASTER: null (akses global / seluruh organisasi)
 * - PJ_DAERAH: ID Daerah + seluruh ID Desa di bawahnya + seluruh ID Kelompok di bawahnya
 * - PJ_DESA: ID Desa + seluruh ID Kelompok di bawahnya
 * - PJ_KELOMPOK: ID Kelompok
 * - Pengguna tanpa organizationId (dan bukan admin): [] (akses kosong demi keamanan)
 */
export async function getScopedOrganizationIds(
  userRoles: UserRole[],
  userOrgId: string | null
): Promise<string[] | null> {
  // Admin Master memiliki akses global tanpa batas wilayah
  if (userRoles.includes('ADMIN_MASTER')) {
    return null;
  }

  // Jika bukan admin dan tidak memiliki organisasi terdaftar, tolak akses
  if (!userOrgId) {
    return [];
  }

  const userOrg = await prisma.organization.findUnique({
    where: { id: userOrgId },
    include: {
      children: {
        include: {
          children: true, // KELOMPOK di bawah DESA jika user adalah DAERAH
        },
      },
    },
  });

  if (!userOrg) {
    return [userOrgId];
  }

  const ids: string[] = [userOrg.id];

  if (userRoles.includes('PJ_DAERAH')) {
    // Tambahkan seluruh Desa dan Kelompok di bawah Daerah ini
    for (const desa of userOrg.children) {
      ids.push(desa.id);
      if (desa.children) {
        for (const kelompok of desa.children) {
          ids.push(kelompok.id);
        }
      }
    }
  } else if (userRoles.includes('PJ_DESA')) {
    // Tambahkan seluruh Kelompok di bawah Desa ini
    for (const kelompok of userOrg.children) {
      ids.push(kelompok.id);
    }
  }

  return ids;
}

/**
 * Mendapatkan daftar peran (roles) yang berhak dilihat dan dikelola oleh pengguna
 */
export function getManageableRoles(userRoles: UserRole[]): UserRole[] {
  if (userRoles.includes('ADMIN_MASTER')) {
    return Object.values(UserRole);
  }

  if (userRoles.includes('PJ_DAERAH')) {
    return [
      'PJ_DESA',
      'PJ_KELOMPOK',
      'PENGAJAR',
      'WALI_KELAS',
      'ORANG_TUA',
      'SANTRI',
    ];
  }

  if (userRoles.includes('PJ_DESA')) {
    return ['PJ_KELOMPOK', 'PENGAJAR', 'WALI_KELAS', 'ORANG_TUA', 'SANTRI'];
  }

  if (userRoles.includes('PJ_KELOMPOK')) {
    return ['PENGAJAR', 'WALI_KELAS', 'ORANG_TUA', 'SANTRI'];
  }

  return [];
}

/**
 * Menentukan jenis tingkatan wilayah yang diwajibkan berdasarkan peran pengguna target:
 * - Santri, Orang Tua, Pengajar, Wali Kelas, PJ Kelompok -> KELOMPOK
 * - PJ Desa -> DESA
 * - PJ Daerah -> DAERAH
 */
export function getAllowedOrganizationTypeForRoles(
  roles: UserRole[]
): OrganizationType | null {
  if (roles.includes('PJ_DAERAH')) {
    return 'DAERAH';
  }
  if (roles.includes('PJ_DESA')) {
    return 'DESA';
  }
  if (
    roles.some((r) =>
      ['SANTRI', 'ORANG_TUA', 'PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK'].includes(r)
    )
  ) {
    return 'KELOMPOK';
  }
  return null;
}

/**
 * Filter opsi wilayah binaan untuk form kelola user:
 * 1. Batasi opsi hanya di bawah tingkatan PJ pengelola (jika non-admin).
 * 2. Sesuaikan opsi dengan peran pengguna yang dipilih.
 */
export function filterOrganizationsForUserManagement<
  T extends { type: OrganizationType }
>(
  organizations: T[],
  managerRoles: UserRole[],
  targetRoles: UserRole[]
): T[] {
  const requiredType = getAllowedOrganizationTypeForRoles(targetRoles);

  return organizations.filter((org) => {
    // 1. Batasi opsi hanya di bawah tingkatan PJ pengelola
    if (!managerRoles.includes('ADMIN_MASTER')) {
      if (managerRoles.includes('PJ_DAERAH') && org.type === 'DAERAH') {
        return false;
      }
      if (managerRoles.includes('PJ_DESA') && org.type !== 'KELOMPOK') {
        return false;
      }
    }

    // 2. Sesuaikan dengan tingkatan yang diwajibkan oleh peran pengguna target
    if (requiredType && org.type !== requiredType) {
      return false;
    }

    return true;
  });
}

/**
 * Validasi apakah kombinasi peran target, organisasi target, dan hak PJ manajer sah
 */
export function validateUserOrganizationRoleMatch(
  managerRoles: UserRole[],
  targetRoles: UserRole[],
  targetOrgType: OrganizationType | null
): { allowed: boolean; reason?: string } {
  const requiredType = getAllowedOrganizationTypeForRoles(targetRoles);

  if (requiredType && !targetOrgType) {
    const label =
      requiredType === 'KELOMPOK'
        ? 'Kelompok'
        : requiredType === 'DESA'
        ? 'Desa'
        : 'Daerah';
    return {
      allowed: false,
      reason: `Peran yang dipilih wajib bernaung pada wilayah binaan tingkat ${label}.`,
    };
  }

  if (requiredType && targetOrgType && targetOrgType !== requiredType) {
    if (requiredType === 'KELOMPOK') {
      return {
        allowed: false,
        reason:
          'Peran Santri, Orang Tua, Pengajar, Wali Kelas, dan PJ Kelompok hanya dapat bernaung pada tingkat Kelompok.',
      };
    }
    if (requiredType === 'DESA') {
      return {
        allowed: false,
        reason: 'Peran PJ Desa hanya dapat bernaung pada tingkat Desa.',
      };
    }
    if (requiredType === 'DAERAH') {
      return {
        allowed: false,
        reason: 'Peran PJ Daerah hanya dapat bernaung pada tingkat Daerah.',
      };
    }
  }

  // Batasi opsi hanya di bawah tingkatan PJ
  if (!managerRoles.includes('ADMIN_MASTER') && targetOrgType) {
    if (managerRoles.includes('PJ_DAERAH') && targetOrgType === 'DAERAH') {
      return {
        allowed: false,
        reason:
          'Akses ditolak: PJ Daerah hanya dapat menugaskan pengguna pada tingkat di bawahnya (Desa atau Kelompok).',
      };
    }
    if (managerRoles.includes('PJ_DESA') && targetOrgType !== 'KELOMPOK') {
      return {
        allowed: false,
        reason:
          'Akses ditolak: PJ Desa hanya dapat menugaskan pengguna pada tingkat di bawahnya (Kelompok).',
      };
    }
  }

  return { allowed: true };
}

/**
 * Validasi apakah pengelola (manager) berhak mengelola akun target (targetUser)
 */
export async function canManageTargetUser(
  manager: { id: string; roles: UserRole[]; organizationId: string | null },
  targetUser: { id: string; roles: UserRole[]; organizationId: string | null }
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin Master memiliki hak penuh atas seluruh user
  if (manager.roles.includes('ADMIN_MASTER')) {
    return { allowed: true };
  }

  // Pengelola non-admin sama sekali tidak boleh melihat/mengubah Super Admin
  if (targetUser.roles.includes('ADMIN_MASTER')) {
    return {
      allowed: false,
      reason:
        'Akses ditolak: Anda tidak memiliki wewenang untuk melihat atau mengubah akun Super Admin / Admin Master.',
    };
  }

  // Pengguna diperbolehkan mengedit profil dasarnya sendiri
  if (manager.id === targetUser.id) {
    return { allowed: true };
  }

  // Periksa apakah target memiliki peran di luar daftar yang diizinkan untuk dikelola
  const manageable = getManageableRoles(manager.roles);
  const hasUnmanageableRole = targetUser.roles.some((r) => !manageable.includes(r));
  if (hasUnmanageableRole) {
    return {
      allowed: false,
      reason:
        'Akses ditolak: Pengguna memiliki peran yang berada di luar tingkat kewenangan pengelolaan Anda.',
    };
  }

  // Periksa batas wilayah: target harus berada dalam scopedOrgIds
  const scopedOrgIds = await getScopedOrganizationIds(
    manager.roles,
    manager.organizationId
  );

  if (scopedOrgIds !== null) {
    if (!targetUser.organizationId || !scopedOrgIds.includes(targetUser.organizationId)) {
      return {
        allowed: false,
        reason: 'Akses ditolak: Pengguna berada di luar wilayah binaan Anda.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Validasi apakah pengelola berhak melakukan aksi pada organisasi target
 */
export async function canManageOrganizationItem(
  manager: { roles: UserRole[]; organizationId: string | null },
  targetOrg: { id: string; type: OrganizationType; parentId: string | null },
  action: 'VIEW' | 'EDIT' | 'DELETE'
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin Master memiliki hak penuh atas seluruh organisasi
  if (manager.roles.includes('ADMIN_MASTER')) {
    return { allowed: true };
  }

  const scopedOrgIds = await getScopedOrganizationIds(
    manager.roles,
    manager.organizationId
  );

  if (!scopedOrgIds || !scopedOrgIds.includes(targetOrg.id)) {
    return {
      allowed: false,
      reason: 'Akses ditolak: Organisasi berada di luar wilayah binaan Anda.',
    };
  }

  if (action === 'DELETE') {
    // PJ tidak boleh menghapus Daerah
    if (targetOrg.type === 'DAERAH') {
      return {
        allowed: false,
        reason: 'Akses ditolak: Hanya Admin Master yang berhak menghapus tingkatan Daerah.',
      };
    }

    // PJ Desa tidak boleh menghapus Desanya sendiri
    if (targetOrg.type === 'DESA' && !manager.roles.includes('PJ_DAERAH')) {
      return {
        allowed: false,
        reason:
          'Akses ditolak: Hanya PJ Daerah atau Admin Master yang berhak menghapus tingkatan Desa.',
      };
    }

    // PJ Kelompok tidak boleh menghapus organisasi apapun
    if (
      !manager.roles.includes('PJ_DAERAH') &&
      !manager.roles.includes('PJ_DESA')
    ) {
      return {
        allowed: false,
        reason:
          'Akses ditolak: PJ Kelompok tidak memiliki wewenang untuk menghapus tingkatan wilayah.',
      };
    }
  }

  if (action === 'EDIT') {
    // PJ Desa tidak boleh mengedit Daerah
    if (targetOrg.type === 'DAERAH' && !manager.roles.includes('PJ_DAERAH')) {
      return {
        allowed: false,
        reason: 'Akses ditolak: PJ Desa tidak berhak mengedit tingkatan Daerah induk.',
      };
    }

    // PJ Kelompok hanya boleh mengedit Kelompoknya sendiri
    if (
      targetOrg.type !== 'KELOMPOK' &&
      !manager.roles.includes('PJ_DAERAH') &&
      !manager.roles.includes('PJ_DESA')
    ) {
      return {
        allowed: false,
        reason:
          'Akses ditolak: PJ Kelompok hanya berhak mengedit Kelompok binaannya sendiri.',
      };
    }
  }

  return { allowed: true };
}
