import { Prisma, UserRole } from '@prisma/client';

/**
 * Filter standar untuk memastikan hanya akun pengguna aktif yang disertakan
 * dalam query operasional (presensi, jadwal, kelas, materi, notifikasi).
 */
export const ACTIVE_USER_STATUS = 'ACTIVE' as const;

export const ACTIVE_USER_WHERE: Prisma.UserWhereInput = {
  status: ACTIVE_USER_STATUS,
};

/**
 * Helper untuk menyusun klausul where santri aktif
 */
export function whereActiveStudent(
  additionalWhere?: Prisma.UserWhereInput
): Prisma.UserWhereInput {
  return {
    ...ACTIVE_USER_WHERE,
    roles: {
      some: {
        role: UserRole.SANTRI,
      },
    },
    ...(additionalWhere || {}),
  };
}

/**
 * Helper untuk menyusun klausul where pengajar/ustadz aktif
 */
export function whereActiveTeacher(
  additionalWhere?: Prisma.UserWhereInput,
  allowedRoles: UserRole[] = [UserRole.PENGAJAR, UserRole.WALI_KELAS]
): Prisma.UserWhereInput {
  return {
    ...ACTIVE_USER_WHERE,
    roles: {
      some: {
        role: { in: allowedRoles },
      },
    },
    ...(additionalWhere || {}),
  };
}

/**
 * Helper untuk menyusun klausul where PJ wilayah aktif
 */
export function whereActivePj(
  additionalWhere?: Prisma.UserWhereInput,
  allowedRoles: UserRole[] = [UserRole.PJ_KELOMPOK, UserRole.PJ_DESA, UserRole.PJ_DAERAH]
): Prisma.UserWhereInput {
  return {
    ...ACTIVE_USER_WHERE,
    roles: {
      some: {
        role: { in: allowedRoles },
      },
    },
    ...(additionalWhere || {}),
  };
}
