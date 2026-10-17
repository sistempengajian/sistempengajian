'use client';

import React, { useState, useTransition } from 'react';
import { Bell, Smartphone, Check, Loader2, Users, ShieldAlert, Sparkles } from 'lucide-react';
import { updateNotificationPreferences } from '@/app/(protected)/profil/actions';

interface NotificationPreferencesCardProps {
  initialH1?: boolean;
  initialCountdown?: boolean;
  initialPreferredParent?: string | null;
  isParentOrStudent?: boolean;
}

export default function NotificationPreferencesCard({
  initialH1 = true,
  initialCountdown = true,
  initialPreferredParent = 'ALL',
  isParentOrStudent = true,
}: NotificationPreferencesCardProps) {
  const [notifyH1, setNotifyH1] = useState(initialH1);
  const [notifyCountdown, setNotifyCountdown] = useState(initialCountdown);
  const [preferredParent, setPreferredParent] = useState(initialPreferredParent || 'ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleSave = (
    newH1: boolean,
    newCountdown: boolean,
    newParent: string
  ) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateNotificationPreferences({
        waNotifyH1: newH1,
        waNotifyCountdown: newCountdown,
        waPreferredParent: newParent as any,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: res.message || 'Preferensi notifikasi WhatsApp berhasil disimpan.',
        });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal menyimpan preferensi notifikasi.',
        });
      }
    });
  };

  const toggleH1 = () => {
    const val = !notifyH1;
    setNotifyH1(val);
    handleSave(val, notifyCountdown, preferredParent);
  };

  const toggleCountdown = () => {
    const val = !notifyCountdown;
    setNotifyCountdown(val);
    handleSave(notifyH1, val, preferredParent);
  };

  const changePreferredParent = (val: string) => {
    setPreferredParent(val);
    handleSave(notifyH1, notifyCountdown, val);
  };

  return (
    <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200/60">
            <Bell className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Preferensi Notifikasi WhatsApp</h3>
            <p className="text-[11px] text-slate-500">Atur pesan pengingat jadwal dan saluran kontak keluarga</p>
          </div>
        </div>

        {isPending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Menyimpan...
          </span>
        )}
      </div>

      {feedback && (
        <div
          className={`mb-4 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in-50 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="space-y-3.5">
        {/* Toggle 1: Pengingat H-1 */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
          <div className="pr-4">
            <h4 className="text-xs font-bold text-slate-800">Pengingat Jadwal H-1 (Sore Hari Sebelumnya)</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
              Menerima ringkasan jadwal, materi pengajian, dan tautan formulir persiapan izin.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifyH1}
            onClick={toggleH1}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              notifyH1 ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                notifyH1 ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Pengingat Countdown 2 Jam */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
          <div className="pr-4">
            <h4 className="text-xs font-bold text-slate-800">Pengingat Hitung Mundur (Countdown H-2 Jam)</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
              Menerima pesan pengingat persiapan keberangkatan santri 2 jam sebelum sesi dimulai.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifyCountdown}
            onClick={toggleCountdown}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              notifyCountdown ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                notifyCountdown ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Opsi 3: Penerima Kontak Utama Keluarga */}
        {isParentOrStudent && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Nomor Kontak Orang Tua Utama
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                Pilih nomor orang tua mana yang menerima pengingat pengajian WhatsApp:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {[
                { id: 'ALL', label: 'Kedua Orang Tua (Ayah & Ibu)' },
                { id: 'AYAH', label: 'Hanya Ayah' },
                { id: 'IBU', label: 'Hanya Ibu' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => changePreferredParent(opt.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all flex items-center justify-between ${
                    preferredParent === opt.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {preferredParent === opt.id && (
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
