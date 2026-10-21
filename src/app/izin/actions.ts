'use server';

import prisma from '@/lib/prisma';
import { isHoneypotTriggered } from '@/lib/security-utils';
import {
  verifyStudentAbsenceRequestToken,
  verifyStudentAbsenceApprovalToken,
  generateStudentAbsenceApprovalToken,
} from '@/lib/studentAbsenceToken';
import {
  sendStudentAbsenceRequestInvitationNotification,
  sendStudentAbsenceDecisionNotification,
} from '@/lib/whatsapp/triggers';
import { normalizePhoneNumber } from '@/lib/whatsapp/utils';

/**
 * Format tanggal & jam sesi lokal Indonesia
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
 * 1. Mengambil data awal halaman pengajuan izin santri
 */
export async function getStudentAbsencePageData(token: string) {
  const verified = verifyStudentAbsenceRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.studentId || !verified.submitterUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan pengajuan izin tidak sah atau telah kedaluwarsa.',
    };
  }

  try {
    const [schedule, student, submitter] = await Promise.all([
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
        where: { id: verified.studentId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          avatarUrl: true,
          generation: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.submitterUserId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          phoneNumber: true,
        },
      }),
    ]);

    if (!schedule || !student) {
      return {
        success: false,
        error: 'Data jadwal atau profil santri tidak ditemukan.',
      };
    }

    // Ambil permohonan terkini jika ada
    const currentRequest = await prisma.studentAbsenceRequest.findFirst({
      where: {
        scheduleId: schedule.id,
        studentId: student.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        approvals: {
          include: {
            approverUser: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    });

    return {
      success: true,
      schedule,
      student,
      submitter,
      submitterRole: verified.submitterRole,
      currentRequest,
    };
  } catch (err: any) {
    console.error('Error in getStudentAbsencePageData:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat formulir izin santri.',
    };
  }
}

/**
 * 2. Polling status real-time permohonan izin santri (setiap 10 detik)
 */
export async function getStudentAbsenceRequestStatus(token: string) {
  const verified = verifyStudentAbsenceRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.studentId) {
    return {
      success: false,
      error: verified.error || 'Tautan tidak valid.',
    };
  }

  try {
    const currentRequest = await prisma.studentAbsenceRequest.findFirst({
      where: {
        scheduleId: verified.scheduleId,
        studentId: verified.studentId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        approvals: {
          include: {
            approverUser: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    });

    return {
      success: true,
      currentRequest,
    };
  } catch (err: any) {
    console.error('Error in getStudentAbsenceRequestStatus:', err);
    return {
      success: false,
      error: 'Gagal mengecek status persetujuan izin terkini.',
    };
  }
}

/**
 * 3. Submit Permohonan Izin / Sakit Santri Mandiri
 */
export async function submitStudentAbsenceRequest({
  token,
  absenceType,
  notes,
  attachmentUrl,
  website_url,
}: {
  token: string;
  absenceType: 'IZIN' | 'SAKIT';
  notes: string;
  attachmentUrl?: string;
  website_url?: string;
}) {
  if (isHoneypotTriggered({ website_url })) {
    return {
      success: false,
      error: 'Permintaan tidak valid terdeteksi (bot protection).',
    };
  }

  const verified = verifyStudentAbsenceRequestToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.studentId || !verified.submitterUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan tidak sah atau telah kedaluwarsa.',
    };
  }

  const trimmedNotes = (notes || '').trim();
  if (!trimmedNotes || trimmedNotes.length < 3) {
    return {
      success: false,
      error: 'Mohon cantumkan catatan/keterangan alasan berhalangan hadir dengan jelas (minimal 3 karakter).',
    };
  }

  try {
    const [schedule, student, submitter] = await Promise.all([
      prisma.schedule.findUnique({
        where: { id: verified.scheduleId },
        include: {
          organization: true,
          class: true,
          targetClasses: { include: { class: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.studentId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          phoneNumber: true,
          generationId: true,
          generation: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.submitterUserId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          phoneNumber: true,
        },
      }),
    ]);

    if (!schedule || !student) {
      return {
        success: false,
        error: 'Data jadwal atau santri tidak ditemukan.',
      };
    }

    // Batalkan request PENDING yang lama jika ada
    await prisma.studentAbsenceRequest.updateMany({
      where: {
        scheduleId: schedule.id,
        studentId: student.id,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    const isSubmittedByParent = verified.submitterRole === 'PARENT';
    const initialApprovedCount = isSubmittedByParent ? 1 : 0;

    // Buat request baru
    const newRequest = await prisma.studentAbsenceRequest.create({
      data: {
        scheduleId: schedule.id,
        studentId: student.id,
        submittedByUserId: verified.submitterUserId,
        submittedByRole: verified.submitterRole || 'STUDENT',
        absenceType,
        notes: trimmedNotes,
        attachmentUrl: attachmentUrl || null,
        status: 'PENDING',
        approvedCount: initialApprovedCount,
      },
    });

    // Jika diajukan langsung oleh Orang Tua, suara Orang Tua otomatis sah 1 approval
    if (isSubmittedByParent) {
      await prisma.studentAbsenceApproval.create({
        data: {
          requestId: newRequest.id,
          approverUserId: verified.submitterUserId,
          approverRole: 'PARENT',
          action: 'APPROVED',
          notes: 'Diajukan langsung oleh Orang Tua / Wali Santri',
        },
      });
    }

    const { dayDate, startTime, endTime } = formatSessionDateTime(
      schedule.startTime,
      schedule.endTime
    );

    // Ekstraksi kelas santri
    const className =
      student.generation?.name ? `Kelas ${student.generation.name}` :
      (schedule.targetClasses.map((tc) => tc.class.name).filter(Boolean).join(', ') ||
      schedule.class?.name ||
      'Santri');

    // Struktur data approver yang akan dikirimi notifikasi WhatsApp
    interface ApproverRecipient {
      userId: string;
      fullName: string;
      gender?: string | null;
      phoneNumber: string;
      approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
      relationshipType?: string | null;
    }

    // Menggunakan Map dengan normalized phone number untuk menjamin 1 nomor HP HANYA menerima 1 pesan!
    const approverMap = new Map<string, ApproverRecipient>();

    // 1. Orang Tua / Wali Santri (Hanya jika diajukan oleh SANTRI sendiri)
    if (!isSubmittedByParent) {
      const parentRelations = await prisma.studentParentRelation.findMany({
        where: { studentUserId: student.id },
        include: { parent: true },
      });

      for (const rel of parentRelations) {
        const norm = normalizePhoneNumber(rel.parent.phoneNumber);
        if (!norm || rel.parent.id === verified.submitterUserId) continue;

        approverMap.set(norm, {
          userId: rel.parent.id,
          fullName: rel.parent.fullName,
          gender: rel.parent.gender,
          phoneNumber: rel.parent.phoneNumber!,
          approverRole: 'PARENT',
          relationshipType: rel.relationshipType,
        });
      }
    }

    // 2. Wali Kelas (Prioritaskan Wali Kelas spesifik dari jenjang/kelas santri)
    let targetHomeroomTeachers: Array<{
      id: string;
      fullName: string;
      gender: any;
      phoneNumber: string | null;
    }> = [];

    // Cari kelas spesifik berdasarkan generationId santri di organisasi yang sama
    if (student.generationId) {
      const studentClasses = await prisma.class.findMany({
        where: {
          organizationId: schedule.organizationId,
          generationId: student.generationId,
          homeroomTeacherId: { not: null },
        },
        include: {
          homeroomTeacher: {
            select: { id: true, fullName: true, gender: true, phoneNumber: true },
          },
        },
      });

      for (const sc of studentClasses) {
        if (sc.homeroomTeacher?.phoneNumber) {
          targetHomeroomTeachers.push(sc.homeroomTeacher);
        }
      }
    }

    // Jika belum ditemukan dari jenjang santri, cari dari jadwal
    if (targetHomeroomTeachers.length === 0) {
      if (schedule.class?.homeroomTeacherId) {
        const ht = await prisma.user.findUnique({
          where: { id: schedule.class.homeroomTeacherId },
          select: { id: true, fullName: true, gender: true, phoneNumber: true },
        });
        if (ht?.phoneNumber) targetHomeroomTeachers.push(ht);
      }

      if (schedule.targetClasses?.length) {
        for (const tc of schedule.targetClasses) {
          if (tc.class?.homeroomTeacherId) {
            const ht = await prisma.user.findUnique({
              where: { id: tc.class.homeroomTeacherId },
              select: { id: true, fullName: true, gender: true, phoneNumber: true },
            });
            if (ht?.phoneNumber && !targetHomeroomTeachers.some((t) => t.id === ht.id)) {
              targetHomeroomTeachers.push(ht);
            }
          }
        }
      }
    }

    // Masukkan Wali Kelas ke approverMap (jika nomor belum pernah terdaftar)
    for (const ht of targetHomeroomTeachers) {
      const norm = normalizePhoneNumber(ht.phoneNumber);
      if (!norm || ht.id === verified.submitterUserId) continue;

      if (!approverMap.has(norm)) {
        approverMap.set(norm, {
          userId: ht.id,
          fullName: ht.fullName,
          gender: ht.gender,
          phoneNumber: ht.phoneNumber!,
          approverRole: 'HOMEROOM_TEACHER',
        });
      }
    }

    // 3. PJ Wilayah (PJ Kelompok / PJ Desa)
    const pjUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        organizationId: schedule.organizationId,
        roles: { some: { role: { in: ['PJ_KELOMPOK', 'PJ_DESA'] } } },
        phoneNumber: { not: null },
      },
      select: { id: true, fullName: true, gender: true, phoneNumber: true },
    });

    for (const pj of pjUsers) {
      const norm = normalizePhoneNumber(pj.phoneNumber);
      if (!norm || pj.id === verified.submitterUserId) continue;

      // Anti-Double: Jika nomor HP sudah ada di map (misal sudah terdaftar sebagai Wali Kelas), lewati agar tidak dobel pesan
      if (!approverMap.has(norm)) {
        approverMap.set(norm, {
          userId: pj.id,
          fullName: pj.fullName,
          gender: pj.gender,
          phoneNumber: pj.phoneNumber!,
          approverRole: 'PJ',
        });
      }
    }

    // Eksekusi pengiriman notifikasi aman (1 nomor HP = Tepat 1 Pesan)
    for (const recipient of approverMap.values()) {
      const confirmToken = generateStudentAbsenceApprovalToken(
        newRequest.id,
        recipient.userId,
        recipient.approverRole
      );

      await sendStudentAbsenceRequestInvitationNotification({
        recipientPhone: recipient.phoneNumber,
        recipientName: recipient.fullName,
        recipientGender: recipient.gender,
        relationshipType: recipient.relationshipType,
        approverRole: recipient.approverRole,
        studentName: student.fullName,
        className,
        scheduleTitle: schedule.title,
        dayDate,
        startTime,
        endTime,
        venueName: schedule.venuePlaceName,
        organizationName: schedule.organization.name,
        absenceType,
        reasonNotes: trimmedNotes,
        hasAttachment: Boolean(attachmentUrl),
        confirmToken,
        requestId: newRequest.id,
        recipientUserId: recipient.userId,
      }).catch((e) =>
        console.error(`Gagal kirim notif izin ke ${recipient.approverRole} (${recipient.fullName}):`, e)
      );
    }

    return {
      success: true,
      request: newRequest,
      message: 'Permohonan izin berhasil diajukan dan dikirimkan ke pihak terkait.',
    };
  } catch (err: any) {
    console.error('Error in submitStudentAbsenceRequest:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memproses permohonan izin.',
    };
  }
}

/**
 * 4. Mengambil data awal halaman konfirmasi izin (Ortu, Wali Kelas, PJ)
 */
export async function getStudentAbsenceConfirmPageData(token: string) {
  const verified = verifyStudentAbsenceApprovalToken(token);
  if (!verified.valid || !verified.requestId || !verified.targetUserId || !verified.approverRole) {
    return {
      success: false,
      error: verified.error || 'Tautan konfirmasi tidak valid atau telah kedaluwarsa.',
    };
  }

  try {
    const [request, approverUser] = await Promise.all([
      prisma.studentAbsenceRequest.findUnique({
        where: { id: verified.requestId },
        include: {
          schedule: {
            include: {
              organization: true,
              class: true,
              targetClasses: { include: { class: true } },
            },
          },
          student: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              avatarUrl: true,
              generation: { select: { id: true, name: true } },
            },
          },
          submittedByUser: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              phoneNumber: true,
            },
          },
          approvals: {
            include: {
              approverUser: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.targetUserId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          roles: { select: { role: true } },
        },
      }),
    ]);

    if (!request || !approverUser) {
      return {
        success: false,
        error: 'Data permohonan izin atau profil peninjau tidak ditemukan.',
      };
    }

    // Validasi wewenang peran peninjau agar tidak terjadi ketidaksesuaian hak akses
    const userRoleCodes = approverUser.roles.map((r) => r.role);
    if (verified.approverRole === 'PJ') {
      const isRealPj = userRoleCodes.some((r) =>
        ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
      );
      if (!isRealPj) {
        return {
          success: false,
          error: `Pengguna ${approverUser.fullName} bukan merupakan PJ Wilayah yang berwenang.`,
        };
      }
    } else if (verified.approverRole === 'HOMEROOM_TEACHER') {
      const isRealHomeroom = userRoleCodes.includes('WALI_KELAS');
      if (!isRealHomeroom) {
        return {
          success: false,
          error: `Pengguna ${approverUser.fullName} bukan merupakan Wali Kelas yang berwenang.`,
        };
      }
    }

    // Cek apakah peninjau ini sudah pernah konfirmasi
    const myApproval = request.approvals.find((a) => a.approverUserId === approverUser.id);

    return {
      success: true,
      request,
      approverUser,
      approverRole: verified.approverRole,
      myApproval,
    };
  } catch (err: any) {
    console.error('Error in getStudentAbsenceConfirmPageData:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan saat memuat data konfirmasi izin.',
    };
  }
}

/**
 * 5. Eksekusi Konfirmasi Izin Santri (Setujui / Tolak + Update Presensi jika >= 2)
 */
export async function confirmStudentAbsenceRequest({
  token,
  action,
  notes,
}: {
  token: string;
  action: 'APPROVE' | 'REJECT';
  notes?: string;
}) {
  const verified = verifyStudentAbsenceApprovalToken(token);
  if (!verified.valid || !verified.requestId || !verified.targetUserId || !verified.approverRole) {
    return {
      success: false,
      error: verified.error || 'Tautan konfirmasi tidak valid atau telah kedaluwarsa.',
    };
  }

  try {
    const request = await prisma.studentAbsenceRequest.findUnique({
      where: { id: verified.requestId },
      include: {
        schedule: {
          include: {
            organization: true,
          },
        },
        student: true,
        submittedByUser: true,
      },
    });

    if (!request) {
      return { success: false, error: 'Permohonan izin tidak ditemukan.' };
    }

    const approverUser = await prisma.user.findUnique({
      where: { id: verified.targetUserId },
      select: {
        id: true,
        fullName: true,
        gender: true,
        roles: { select: { role: true } },
      },
    });

    if (!approverUser) {
      return { success: false, error: 'Pengguna peninjau tidak ditemukan.' };
    }

    // Validasi wewenang peran peninjau sebelum persetujuan dieksekusi
    const userRoleCodes = approverUser.roles.map((r) => r.role);
    if (verified.approverRole === 'PJ') {
      const isRealPj = userRoleCodes.some((r) =>
        ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
      );
      if (!isRealPj) {
        return {
          success: false,
          error: `Pengguna ${approverUser.fullName} bukan merupakan PJ Wilayah yang berwenang.`,
        };
      }
    } else if (verified.approverRole === 'HOMEROOM_TEACHER') {
      const isRealHomeroom = userRoleCodes.includes('WALI_KELAS');
      if (!isRealHomeroom) {
        return {
          success: false,
          error: `Pengguna ${approverUser.fullName} bukan merupakan Wali Kelas yang berwenang.`,
        };
      }
    }

    const approverName = approverUser.fullName || 'Pihak Terkait';
    const actionStr = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // 1. Simpan / perbarui approval record
    await prisma.studentAbsenceApproval.upsert({
      where: {
        requestId_approverUserId: {
          requestId: request.id,
          approverUserId: verified.targetUserId,
        },
      },
      create: {
        requestId: request.id,
        approverUserId: verified.targetUserId,
        approverRole: verified.approverRole,
        action: actionStr,
        notes: notes ? notes.trim() : null,
      },
      update: {
        action: actionStr,
        notes: notes ? notes.trim() : null,
      },
    });

    // 2. Hitung jumlah persetujuan terkini
    const approvedApprovals = await prisma.studentAbsenceApproval.findMany({
      where: {
        requestId: request.id,
        action: 'APPROVED',
      },
      include: {
        approverUser: { select: { fullName: true } },
      },
    });

    const currentApprovedCount = approvedApprovals.length;
    const isFullyApproved = currentApprovedCount >= 2;

    // 3. Update status request
    await prisma.studentAbsenceRequest.update({
      where: { id: request.id },
      data: {
        approvedCount: currentApprovedCount,
        status: isFullyApproved ? 'APPROVED' : request.status,
      },
    });

    // 4. OTOMATISASI STATUS PRESENSI PENGAJAR JIKA APPROVED COUNT >= 2
    if (isFullyApproved) {
      // Pastikan ada AttendanceSession untuk jadwal ini
      let session = await prisma.attendanceSession.findFirst({
        where: { scheduleId: request.scheduleId },
      });

      if (!session) {
        session = await prisma.attendanceSession.create({
          data: {
            scheduleId: request.scheduleId,
            dynamicQrSecret: `auto-${request.scheduleId.substring(0, 8)}`,
            isActive: true,
          },
        });
      }

      const approverNames = approvedApprovals.map((a) => a.approverUser.fullName).join(' & ');
      const absenceStatus = request.absenceType === 'SAKIT' ? 'SAKIT' : 'IZIN';
      const notesInfo = `[${request.absenceType} Mandiri]: ${request.notes} (Dikonfirmasi oleh: ${approverNames})`;

      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: request.studentId,
          },
        },
        create: {
          sessionId: session.id,
          studentId: request.studentId,
          status: absenceStatus,
          notes: notesInfo,
          method: 'MANUAL_TEACHER',
        },
        update: {
          status: absenceStatus,
          notes: notesInfo,
        },
      });
    }

    const { dayDate } = formatSessionDateTime(
      request.schedule.startTime,
      request.schedule.endTime
    );

    // 5. Kirim WhatsApp notifikasi hasil konfirmasi ke santri / pengaju
    const recipientUser = request.submittedByUser;
    if (recipientUser.phoneNumber) {
      await sendStudentAbsenceDecisionNotification({
        recipientPhone: recipientUser.phoneNumber,
        recipientName: recipientUser.fullName,
        recipientGender: recipientUser.gender,
        isParent: request.submittedByRole === 'PARENT',
        studentName: request.student.fullName,
        scheduleTitle: request.schedule.title,
        dayDate,
        absenceType: request.absenceType,
        approverRole: verified.approverRole,
        approverName,
        notes: notes ? notes.trim() : null,
        currentApprovedCount,
        totalRequiredApprovals: 2,
        isFullyApproved,
        organizationName: request.schedule.organization.name,
        requestId: request.id,
        recipientUserId: recipientUser.id,
      }).catch((e) => console.error('Gagal kirim notif keputusan izin ke pemohon:', e));
    }

    return {
      success: true,
      message:
        action === 'APPROVE'
          ? `Konfirmasi persetujuan berhasil disimpan (${currentApprovedCount}/2 persetujuan).`
          : 'Konfirmasi penolakan izin telah dicatat.',
      currentApprovedCount,
      isFullyApproved,
    };
  } catch (err: any) {
    console.error('Error in confirmStudentAbsenceRequest:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memproses konfirmasi.',
    };
  }
}
