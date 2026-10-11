'use client';

import React, { useState, useTransition } from 'react';
import {
  Bell,
  BellOff,
  Users,
  UserCheck,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { updateClassNotificationSettings } from '@/app/(protected)/kelas/actions';

interface ClassNotificationSettingsCardProps {
  classId: string;
  className: string;
  initialEnabled?: boolean;
  initialScope?: string;
  initialParentOption?: string;
  canEdit: boolean;
}

export function ClassNotificationSettingsCard({
  classId,
  className,
  initialEnabled = true,
  initialScope = 'BOTH',
  initialParentOption = 'ALL_PARENTS',
  canEdit,
}: ClassNotificationSettingsCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [scope, setScope] = useState<'BOTH' | 'PARENTS_ONLY' | 'STUDENTS_ONLY'>(
    (initialScope as any) || 'BOTH'
  );
  const [parentOption, setParentOption] = useState<'ALL_PARENTS' | 'SINGLE_PARENT'>(
    (initialParentOption as any) || 'ALL_PARENTS'
  );

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSave = (
    newEnabled = enabled,
    newScope = scope,
    newParentOption = parentOption
  ) => {
    if (!canEdit) return;

    setStatusMessage(null);
    startTransition(async () => {
      const res = await updateClassNotificationSettings({
        classId,
        waNotificationEnabled: newEnabled,
        waRecipientScope: newScope,
        waParentOption: newParentOption,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Pengaturan notifikasi berhasil diperbarui.',
        });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Gagal menyimpan pengaturan.',
        });
      }
    });
  };

  const handleToggleEnabled = () => {
    if (!canEdit) return;
    const nextVal = !enabled;
    setEnabled(nextVal);
    handleSave(nextVal, scope, parentOption);
  };

  const handleChangeScope = (newScope: 'BOTH' | 'PARENTS_ONLY' | 'STUDENTS_ONLY') => {
    if (!canEdit) return;
    setScope(newScope);
    handleSave(enabled, newScope, parentOption);
  };

  const handleChangeParentOption = (newOption: 'ALL_PARENTS' | 'SINGLE_PARENT') => {
    if (!canEdit) return;
    setParentOption(newOption);
    handleSave(enabled, scope, newOption);
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* Header Kartu */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              enabled
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Notifikasi WhatsApp Otomatis
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  enabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola pengiriman pesan pengumuman jadwal pengajian otomatis (H-1 & Hari-H) khusus kelas ini.
            </p>
          </div>
        </div>

        {/* Master Switch Toggle */}
        {canEdit && (
          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
              {enabled ? 'Notifikasi ON' : 'Notifikasi OFF'}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 ${
                enabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title={enabled ? 'Nonaktifkan notifikasi kelas' : 'Aktifkan notifikasi kelas'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Konten Opsi Pengaturan */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* Status Alert jika Nonaktif */}
        {!enabled && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Pengumuman Otomatis Dinonaktifkan untuk Kelas Ini</p>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                Santri dan Orang Tua kelas ini <strong>tidak akan menerima</strong> pesan pengingat jadwal otomatis (H-1 maupun countdown).
                Pesan tugas mengajar untuk Ustadz/Ustadzah tetap selalu dikirimkan.
              </p>
            </div>
          </div>
        )}

        {/* Opsi 1: Target Sasaran Penerima */}
        <div className={`space-y-3 transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Target Penerima Notifikasi</span>
            </label>
            <span className="text-[11px] text-slate-400">Pilih sasaran kontak pengumuman</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Opsi: Santri & Orang Tua */}
            <button
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => handleChangeScope('BOTH')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                scope === 'BOTH'
                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950 shadow-2xs'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50/80 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Users className={`w-4 h-4 ${scope === 'BOTH' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Keduanya</span>
                </div>
                {scope === 'BOTH' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Santri dan Orang Tua/Wali sama-sama menerima pengumuman jadwal.
              </p>
            </button>

            {/* Opsi: Hanya Orang Tua */}
            <button
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => handleChangeScope('PARENTS_ONLY')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 relative ${
                scope === 'PARENTS_ONLY'
                  ? 'bg-teal-50/60 border-teal-300 ring-2 ring-teal-500/20 text-teal-950 shadow-2xs'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50/80 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <UserCheck className={`w-4 h-4 ${scope === 'PARENTS_ONLY' ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>Hanya Orang Tua</span>
                </div>
                {scope === 'PARENTS_ONLY' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Pesan hanya ditujukan ke WhatsApp Orang Tua/Wali santri.
              </p>
              <span className="inline-flex self-start px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[9px] font-bold">
                Rekomendasi Caberawit
              </span>
            </button>

            {/* Opsi: Hanya Santri */}
            <button
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => handleChangeScope('STUDENTS_ONLY')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                scope === 'STUDENTS_ONLY'
                  ? 'bg-sky-50/60 border-sky-300 ring-2 ring-sky-500/20 text-sky-950 shadow-2xs'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50/80 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <User className={`w-4 h-4 ${scope === 'STUDENTS_ONLY' ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span>Hanya Santri</span>
                </div>
                {scope === 'STUDENTS_ONLY' && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Pesan hanya dikirim ke WhatsApp santri sendiri (kelas mandiri/dewasa).
              </p>
            </button>
          </div>
        </div>

        {/* Opsi 2: Pengaturan Kontak Orang Tua (Jika target melibatkan orang tua) */}
        {scope !== 'STUDENTS_ONLY' && (
          <div className={`p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Opsi Pengiriman ke Orang Tua</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Tentukan jumlah kontak ortu yang menerima notifikasi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  parentOption === 'ALL_PARENTS'
                    ? 'bg-white border-teal-300 ring-1 ring-teal-500/20 shadow-2xs'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="parentOption"
                  checked={parentOption === 'ALL_PARENTS'}
                  disabled={!canEdit || isPending}
                  onChange={() => handleChangeParentOption('ALL_PARENTS')}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Kedua Orang Tua (Ayah & Ibu)</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Notifikasi dikirim ke seluruh kontak orang tua/wali yang terdaftar di sistem.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  parentOption === 'SINGLE_PARENT'
                    ? 'bg-white border-teal-300 ring-1 ring-teal-500/20 shadow-2xs'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="parentOption"
                  checked={parentOption === 'SINGLE_PARENT'}
                  disabled={!canEdit || isPending}
                  onChange={() => handleChangeParentOption('SINGLE_PARENT')}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Salah Satu Saja</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Hanya kirim ke 1 orang tua per santri agar tidak terjadi dobel pesan ke satu keluarga.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Info Box Perlindungan Guru */}
        <div className="flex items-start gap-2.5 text-[11px] text-slate-500 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Catatan Pengajar:</strong> Pesan pengingat jadwal tugas mengajar untuk Ustadz/Ustadzah dan Badal
            tetap <strong>selalu dikirimkan 23 jam sebelum sesi</strong> tanpa dipengaruhi oleh pengaturan kelas di atas.
          </p>
        </div>

        {/* Feedback / Status Message */}
        {isPending && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Menyimpan perubahan ke server...</span>
          </div>
        )}

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
