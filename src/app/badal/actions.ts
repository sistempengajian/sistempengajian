'use server';

import prisma from '@/lib/prisma';
import {
  verifySubstituteRequestToken,
  generateSubstituteRequestToken,
  verifySubstituteConfirmToken,
  generateSubstituteConfirmToken,
} from '@/lib/badalToken';
import {
  sendSubstituteRequestInvitationNotification,
  sendSubstituteDecisionNotification,
} from '@/lib/whatsapp/triggers';

/**
 * Format tanggal & waktu lokal Indonesia
 */
function formatSessionDateTime(startDate: Date, endDate: Date) {
  const dayDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(startDate);

  const startTime = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(startDate);

  const endTime = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(endDate);

  return { dayDate, startTime, endTime };
}

/**
 * 1. Mengambil data inisial halaman pengajuan Ustadz Badal
 */
export async function getSubstituteRequestPageData(token: string) {
  const verified = verifySubstituteRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.teacherUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan pengajuan badal tidak valid atau telah kedaluwarsa.',
    };
  }

  try {
    const [schedule, requesterTeacher] = await Promise.all([
      prisma.schedule.findUnique({
        where: { id: verified.scheduleId },
        include: {
          organization: { select: { id: true, name: true, type: true } },
          class: { select: { id: true, name: true } },
          targetClasses: {
            include: {
              class: { select: { id: true, name: true } },
            },
          },
          scheduleMaterials: {
            include: {
              material: { select: { id: true, title: true, description: true } },
            },
            orderBy: { slotIndex: 'asc' },
          },
          teachers: {
            include: {
              teacher: { select: { id: true, fullName: true, gender: true } },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.teacherUserId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          avatarUrl: true,
          phoneNumber: true,
        },
      }),
    ]);

    if (!schedule || !requesterTeacher) {
      return {
        success: false,
        error: 'Data jadwal atau profil pengajar tidak ditemukan.',
      };
    }

    // Ambil daftar rekan Ustadz yang ada di organisasi terkait
    const availableTeachers = await prisma.user.findMany({
      where: {
        organizationId: schedule.organizationId,
        id: { not: requesterTeacher.id },
        status: 'ACTIVE',
        roles: {
          some: {
            role: { in: ['PENGAJAR', 'WALI_KELAS'] },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        gender: true,
        avatarUrl: true,
        phoneNumber: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // Ambil permohonan terkini jika ada
    const currentRequest = await prisma.substituteRequest.findFirst({
      where: {
        scheduleId: schedule.id,
        requesterTeacherId: requesterTeacher.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        substituteTeacher: {
          select: { id: true, fullName: true, gender: true, avatarUrl: true },
        },
        actionByUser: {
          select: { id: true, fullName: true },
        },
      },
    });

    return {
      success: true,
      schedule,
      requesterTeacher,
      availableTeachers,
      currentRequest,
    };
  } catch (err: any) {
    console.error('Error in getSubstituteRequestPageData:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat data pengajuan badal.',
    };
  }
}

/**
 * 2. Polling status real-time pengajuan badal (setiap 10 detik)
 */
export async function getSubstituteRequestStatus(token: string) {
  const verified = verifySubstituteRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.teacherUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan tidak valid.',
    };
  }

  try {
    const currentRequest = await prisma.substituteRequest.findFirst({
      where: {
        scheduleId: verified.scheduleId,
        requesterTeacherId: verified.teacherUserId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        substituteTeacher: {
          select: { id: true, fullName: true, gender: true, avatarUrl: true },
        },
        actionByUser: {
          select: { id: true, fullName: true },
        },
      },
    });

    return {
      success: true,
      currentRequest,
    };
  } catch (err: any) {
    console.error('Error in getSubstituteRequestStatus:', err);
    return {
      success: false,
      error: 'Gagal mengecek status pengajuan terkini.',
    };
  }
}

/**
 * 3. Kirim Pengajuan Badal Baru
 */
export async function submitSubstituteRequest({
  token,
  substituteTeacherId,
  reason,
}: {
  token: string;
  substituteTeacherId: string;
  reason: string;
}) {
  const verified = verifySubstituteRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.teacherUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan tidak sah atau telah kedaluwarsa.',
    };
  }

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    return {
      success: false,
      error: 'Mohon cantumkan catatan/alasan berhalangan mengajar dengan jelas (minimal 3 karakter).',
    };
  }

  if (!substituteTeacherId || substituteTeacherId === verified.teacherUserId) {
    return {
      success: false,
      error: 'Silakan pilih rekan Ustadz calon badal yang valid.',
    };
  }

  try {
    const [schedule, requesterTeacher, substituteTeacher] = await Promise.all([
      prisma.schedule.findUnique({
        where: { id: verified.scheduleId },
        include: {
          organization: true,
          class: true,
          targetClasses: { include: { class: true } },
          scheduleMaterials: {
            include: { material: true },
            orderBy: { slotIndex: 'asc' },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.teacherUserId },
        select: { id: true, fullName: true, gender: true, phoneNumber: true },
      }),
      prisma.user.findUnique({
        where: { id: substituteTeacherId },
        select: { id: true, fullName: true, gender: true, phoneNumber: true },
      }),
    ]);

    if (!schedule || !requesterTeacher || !substituteTeacher) {
      return {
        success: false,
        error: 'Data jadwal atau Ustadz tidak ditemukan.',
      };
    }

    // Batalkan request PENDING yang lama jika ada
    await prisma.substituteRequest.updateMany({
      where: {
        scheduleId: schedule.id,
        requesterTeacherId: requesterTeacher.id,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    // Simpan request baru
    const newRequest = await prisma.substituteRequest.create({
      data: {
        scheduleId: schedule.id,
        requesterTeacherId: requesterTeacher.id,
        substituteTeacherId: substituteTeacher.id,
        reason: trimmedReason,
        status: 'PENDING',
      },
      include: {
        substituteTeacher: {
          select: { id: true, fullName: true, gender: true, avatarUrl: true },
        },
        actionByUser: {
          select: { id: true, fullName: true },
        },
      },
    });

    const { dayDate, startTime, endTime } = formatSessionDateTime(
      schedule.startTime,
      schedule.endTime
    );

    const classNames =
      schedule.targetClasses.map((tc) => tc.class.name).filter(Boolean).join(', ') ||
      schedule.class?.name ||
      'Santri';

    const materialTitles =
      schedule.scheduleMaterials.map((sm) => sm.material.title).filter(Boolean).join(', ') ||
      'Materi Terjadwal';

    // 1. Kirim WA ke Calon Badal
    if (substituteTeacher.phoneNumber) {
      const confirmTokenBadal = generateSubstituteConfirmToken(
        newRequest.id,
        substituteTeacher.id,
        'SUBSTITUTE'
      );

      await sendSubstituteRequestInvitationNotification({
        recipientPhone: substituteTeacher.phoneNumber,
        recipientName: substituteTeacher.fullName,
        recipientGender: substituteTeacher.gender,
        isPj: false,
        scheduleTitle: schedule.title,
        dayDate,
        startTime,
        endTime,
        venueName: schedule.venuePlaceName,
        organizationName: schedule.organization.name,
        generationClassName: classNames,
        materialTitle: materialTitles,
        requesterName: requesterTeacher.fullName,
        reason: trimmedReason,
        confirmToken: confirmTokenBadal,
        requestId: newRequest.id,
        recipientUserId: substituteTeacher.id,
      }).catch((e) => console.error('Gagal kirim notif badal ke calon guru:', e));
    }

    // 2. Kirim WA ke PJ Wilayah (PJ Kelompok / PJ Desa)
    const pjUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        organizationId: schedule.organizationId,
        roles: {
          some: {
            role: { in: ['PJ_KELOMPOK', 'PJ_DESA'] },
          },
        },
        phoneNumber: { not: null },
      },
    });

    for (const pj of pjUsers) {
      if (!pj.phoneNumber || pj.id === substituteTeacher.id || pj.id === requesterTeacher.id) {
        continue;
      }

      const confirmTokenPj = generateSubstituteConfirmToken(newRequest.id, pj.id, 'PJ');

      await sendSubstituteRequestInvitationNotification({
        recipientPhone: pj.phoneNumber,
        recipientName: pj.fullName,
        recipientGender: pj.gender,
        isPj: true,
        scheduleTitle: schedule.title,
        dayDate,
        startTime,
        endTime,
        venueName: schedule.venuePlaceName,
        organizationName: schedule.organization.name,
        generationClassName: classNames,
        materialTitle: materialTitles,
        requesterName: requesterTeacher.fullName,
        reason: trimmedReason,
        confirmToken: confirmTokenPj,
        requestId: newRequest.id,
        recipientUserId: pj.id,
      }).catch((e) => console.error(`Gagal kirim notif badal ke PJ (${pj.fullName}):`, e));
    }

    return {
      success: true,
      request: newRequest,
      message: 'Pengajuan guru badal berhasil dikirim ke calon pengganti & PJ Wilayah.',
    };
  } catch (err: any) {
    console.error('Error in submitSubstituteRequest:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan saat memproses pengajuan badal.',
    };
  }
}

/**
 * 4. Batalkan Pengajuan Badal
 */
export async function cancelSubstituteRequest({
  token,
  requestId,
}: {
  token: string;
  requestId: string;
}) {
  const verified = verifySubstituteRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.teacherUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan tidak valid.',
    };
  }

  try {
    await prisma.substituteRequest.updateMany({
      where: {
        id: requestId,
        requesterTeacherId: verified.teacherUserId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    return {
      success: true,
      message: 'Pengajuan badal berhasil dibatalkan.',
    };
  } catch (err: any) {
    console.error('Error in cancelSubstituteRequest:', err);
    return {
      success: false,
      error: 'Gagal membatalkan pengajuan.',
    };
  }
}

/**
 * 5. Mengambil data inisial halaman konfirmasi (Calon Badal & PJ Wilayah)
 */
export async function getSubstituteConfirmPageData(token: string) {
  const verified = verifySubstituteConfirmToken(token);
  if (!verified.valid || !verified.requestId || !verified.targetUserId || !verified.targetRole) {
    return {
      success: false,
      error: verified.error || 'Tautan konfirmasi badal tidak valid atau telah kedaluwarsa.',
    };
  }

  try {
    const [request, reviewer] = await Promise.all([
      prisma.substituteRequest.findUnique({
        where: { id: verified.requestId },
        include: {
          schedule: {
            include: {
              organization: true,
              class: true,
              targetClasses: { include: { class: true } },
              scheduleMaterials: {
                include: { material: true },
                orderBy: { slotIndex: 'asc' },
              },
            },
          },
          requesterTeacher: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              avatarUrl: true,
              phoneNumber: true,
            },
          },
          substituteTeacher: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              avatarUrl: true,
              phoneNumber: true,
            },
          },
          actionByUser: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.targetUserId },
        select: { id: true, fullName: true, gender: true },
      }),
    ]);

    if (!request || !reviewer) {
      return {
        success: false,
        error: 'Data permohonan atau identitas peninjau tidak ditemukan.',
      };
    }

    return {
      success: true,
      request,
      reviewer,
      targetRole: verified.targetRole,
    };
  } catch (err: any) {
    console.error('Error in getSubstituteConfirmPageData:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat konfirmasi badal.',
    };
  }
}

/**
 * 6. Eksekusi Konfirmasi: Setujui (APPROVE) atau Tolak (REJECT)
 */
export async function confirmSubstituteRequest({
  token,
  action,
  notes,
}: {
  token: string;
  action: 'APPROVE' | 'REJECT';
  notes?: string;
}) {
  const verified = verifySubstituteConfirmToken(token);
  if (!verified.valid || !verified.requestId || !verified.targetUserId || !verified.targetRole) {
    return {
      success: false,
      error: verified.error || 'Tautan konfirmasi tidak valid atau telah kedaluwarsa.',
    };
  }

  try {
    const request = await prisma.substituteRequest.findUnique({
      where: { id: verified.requestId },
      include: {
        schedule: {
          include: {
            organization: true,
          },
        },
        requesterTeacher: true,
        substituteTeacher: true,
      },
    });

    if (!request) {
      return { success: false, error: 'Permohonan badal tidak ditemukan.' };
    }

    if (request.status !== 'PENDING') {
      return {
        success: false,
        error: `Permohonan ini telah selesai diproses sebelumnya dengan status ${request.status}.`,
      };
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: verified.targetUserId },
      select: { id: true, fullName: true, gender: true },
    });

    const reviewerName =
      reviewer?.fullName ||
      (verified.targetRole === 'PJ' ? 'PJ Wilayah' : request.substituteTeacher.fullName);

    const { dayDate } = formatSessionDateTime(
      request.schedule.startTime,
      request.schedule.endTime
    );

    if (action === 'APPROVE') {
      // 1. Update status request ke APPROVED
      await prisma.substituteRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          actionByUserId: verified.targetUserId,
          actionAt: new Date(),
          actionNotes: notes ? notes.trim() : null,
        },
      });

      // 2. Hubungkan Ustadz Badal ke ScheduleTeacher
      await prisma.scheduleTeacher.upsert({
        where: {
          scheduleId_teacherId: {
            scheduleId: request.scheduleId,
            teacherId: request.substituteTeacherId,
          },
        },
        create: {
          scheduleId: request.scheduleId,
          teacherId: request.substituteTeacherId,
          isSubstitute: true,
          isPrimary: false,
        },
        update: {
          isSubstitute: true,
        },
      });

      // 3. Kirim notifikasi WA konfirmasi sukses ke Ustadz Pemohon
      if (request.requesterTeacher.phoneNumber) {
        await sendSubstituteDecisionNotification({
          requesterPhone: request.requesterTeacher.phoneNumber,
          requesterName: request.requesterTeacher.fullName,
          requesterGender: request.requesterTeacher.gender,
          isApproved: true,
          scheduleTitle: request.schedule.title,
          dayDate,
          substituteName: request.substituteTeacher.fullName,
          approverName: reviewerName,
          notes: notes ? notes.trim() : null,
          organizationName: request.schedule.organization.name,
          requestId: request.id,
          requesterUserId: request.requesterTeacherId,
        }).catch((e) => console.error('Gagal kirim notif persetujuan badal:', e));
      }

      return {
        success: true,
        message: `Alhamdulillah, permohonan Guru Badal atas nama ${request.substituteTeacher.fullName} telah berhasil disetujui.`,
      };
    } else {
      // REJECT
      const reasonNotes = (notes || '').trim() || 'Belum bersedia / berhalangan hadir';

      // 1. Update status ke REJECTED
      await prisma.substituteRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          actionByUserId: verified.targetUserId,
          actionAt: new Date(),
          actionNotes: reasonNotes,
        },
      });

      // 2. Buat token baru pengajuan untuk pemohon mengajukan ulang ke badal lain
      const reapplyToken = generateSubstituteRequestToken(
        request.scheduleId,
        request.requesterTeacherId
      );

      // 3. Kirim notifikasi penolakan via WA ke pemohon
      if (request.requesterTeacher.phoneNumber) {
        await sendSubstituteDecisionNotification({
          requesterPhone: request.requesterTeacher.phoneNumber,
          requesterName: request.requesterTeacher.fullName,
          requesterGender: request.requesterTeacher.gender,
          isApproved: false,
          scheduleTitle: request.schedule.title,
          dayDate,
          approverName: reviewerName,
          notes: reasonNotes,
          organizationName: request.schedule.organization.name,
          requestToken: reapplyToken,
          requestId: request.id,
          requesterUserId: request.requesterTeacherId,
        }).catch((e) => console.error('Gagal kirim notif penolakan badal:', e));
      }

      return {
        success: true,
        message: 'Permohonan Guru Badal telah ditolak dan pengajar utama telah diberitahu.',
      };
    }
  } catch (err: any) {
    console.error('Error in confirmSubstituteRequest:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memproses konfirmasi.',
    };
  }
}
