import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

/**
 * Mengambil data pengguna aktif dari sesi Supabase dan mencocokkannya ke database Prisma
 * secara fleksibel (berdasarkan UUID Supabase, alamat email Google / manual, phone, atau username).
 *
 * Mengembalikan `effectiveUserId` yang merupakan ID database Prisma yang valid
 * agar seluruh relasi (jadwal, presensi, rapor, gamifikasi, kelas) dapat diakses dengan akurat.
 */
export async function getEffectiveAuthUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { authUser: null, dbUser: null, effectiveUserId: null };
  }

  const metaEmail = typeof authUser.user_metadata?.email === 'string'
    ? authUser.user_metadata.email.toLowerCase().trim()
    : null;
  const email = (authUser.email?.toLowerCase().trim() || metaEmail) || null;
  const usernamePrefix = email ? email.split('@')[0] : null;
  const phone = authUser.phone ? authUser.phone.replace(/[^0-9]/g, '') : null;

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: authUser.id },
        ...(email
          ? [
              { email: email },
              { email: { equals: email, mode: 'insensitive' as const } },
              ...(usernamePrefix ? [{ username: usernamePrefix }] : []),
            ]
          : []),
        ...(phone ? [{ phoneNumber: phone }] : []),
      ],
    },
    include: {
      organization: {
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
        },
      },
      generation: true,
      roles: true,
      gamification: true,
      children: {
        include: {
          student: {
            include: {
              organization: {
                include: {
                  parent: true,
                },
              },
              generation: true,
              gamification: true,
            },
          },
        },
      },
      homeroomClasses: {
        include: {
          generation: true,
          organization: true,
        },
      },
      scheduleAssignments: {
        select: { id: true },
        take: 1,
      },
    },
  });

  return {
    authUser,
    dbUser,
    effectiveUserId: dbUser?.id || authUser.id,
  };
}
