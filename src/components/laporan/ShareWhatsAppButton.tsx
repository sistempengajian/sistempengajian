'use client';

import React, { useState } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, Phone } from 'lucide-react';
import { ChildDevelopmentReport } from '@/app/(protected)/laporan/types';
import { formatWhatsAppUrl } from '@/lib/whatsapp';

interface ShareWhatsAppButtonProps {
  report: ChildDevelopmentReport;
  userRoleCategory?: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
}

export default function ShareWhatsAppButton({ report, userRoleCategory }: ShareWhatsAppButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { student, attendance, curriculum, character } = report;
  const isSantri = userRoleCategory === 'SANTRI';

  // Bangun teks pesan WhatsApp rapi
  const latestTeacherNote =
    character.teacherNotesFeed[0]?.note ||
    (isSantri
      ? 'Santri aktif mengikuti kegiatan pengajian dengan tertib, disiplin, dan berakhlaqul karimah.'
      : 'Ananda mengikuti kegiatan pengajian dengan baik, tertib, dan berakhlaqul karimah.');

  const messageText = isSantri
    ? `*RAPOR CAPAIAN BELAJAR SANTRI*
----------------------------------------
*Nama:* ${student.fullName}
*Jenjang:* ${student.generationName} ${student.className ? `(${student.className})` : ''}
*Lembaga:* ${student.organizationName}

📊 *Rekap Kehadiran Saya:*
• Tingkat Kehadiran: *${attendance.percentage}%* (${attendance.attended}/${attendance.totalSessions} Sesi Hadir)
• Tepat Waktu: ${attendance.onTime}x | Terlambat: ${attendance.late}x
• Izin/Sakit: ${attendance.permission + attendance.sick}x | Alpa: ${attendance.absent}x
${attendance.currentStreak > 0 ? `• Kehadiran Beruntun: *${attendance.currentStreak} Sesi Berturut-turut* 🔥` : ''}

📖 *Penguasaan Materi & Kurikulum:*
• Target Tuntas: *${curriculum.completedItems} dari ${curriculum.totalChecklistItems} Materi (${curriculum.masteryPercentage}%)*
• Nilai Rata-rata Adab: *${character.averageAdab}/100*
• Nilai Keaktifan: *${character.averageKeaktifan}/100*

📝 *Catatan Wali Kelas / Pembina:*
"${latestTeacherNote}"

----------------------------------------
_Alhamdulillah Jazakumullahu Khairan Katsiran._
_Sistem Pengajian Terpadu_`
    : `*LAPORAN PERKEMBANGAN SANTRI*
----------------------------------------
*Nama:* ${student.fullName}
*Jenjang:* ${student.generationName} ${student.className ? `(${student.className})` : ''}
*Lembaga:* ${student.organizationName}

📊 *Rekap Kehadiran:*
• Tingkat Kehadiran: *${attendance.percentage}%* (${attendance.attended}/${attendance.totalSessions} Sesi Hadir)
• Tepat Waktu: ${attendance.onTime}x | Terlambat: ${attendance.late}x
• Izin/Sakit: ${attendance.permission + attendance.sick}x | Alpa: ${attendance.absent}x
${attendance.currentStreak > 0 ? `• Kehadiran Beruntun: *${attendance.currentStreak} Sesi Berturut-turut* 🔥` : ''}

📖 *Penguasaan Materi & Kurikulum:*
• Target Tuntas: *${curriculum.completedItems} dari ${curriculum.totalChecklistItems} Materi (${curriculum.masteryPercentage}%)*
• Nilai Rata-rata Adab: *${character.averageAdab}/100*
• Nilai Keaktifan: *${character.averageKeaktifan}/100*

📝 *Catatan Wali Kelas / Guru:*
"${latestTeacherNote}"

----------------------------------------
_Alhamdulillah Jazakumullahu Khairan Katsiran._
_Sistem Pengajian Terpadu_`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const directWaUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  const teacherWaUrl = student.homeroomTeacher?.phoneNumber
    ? formatWhatsAppUrl(
      student.homeroomTeacher.phoneNumber,
      isSantri
        ? `Assalamu'alaikum Ustadz/Ustadzah ${student.homeroomTeacher.fullName}, saya ${student.fullName}. Ingin berkonsultasi mengenai laporan evaluasi hasil belajar saya.`
        : `Assalamu'alaikum Ustadz/Ustadzah ${student.homeroomTeacher.fullName}, saya wali dari ananda ${student.fullName}. Ingin berkonsultasi mengenai laporan perkembangan belajar ananda.`
    )
    : null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tombol Buka Menu Bagikan WA */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span className='hidden sm:inline'>Bagikan ke WhatsApp</span>
        </button>

        {/* Tombol Konsultasi dengan Wali Kelas (Jika ada nomor telp) */}
        {teacherWaUrl && (
          <a
            href={teacherWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5 text-teal-600" />
            <span>Chat Wali Kelas</span>
          </a>
        )}
      </div>

      {/* Modal Dialog Ringkasan WhatsApp */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200/60">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Bagikan Ringkasan Perkembangan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Format pesan siap kirim untuk WhatsApp keluarga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Preview Teks Pesan */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                {messageText}
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-b-3xl">
              <button
                type="button"
                onClick={handleCopy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <a
                  href={directWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka WhatsApp Sekarang</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
