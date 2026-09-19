'use client';

import React, { useState, useTransition } from 'react';
import { requestPrivateRemedial } from '@/app/(protected)/private-remedial/actions';
import { Users, Clock, MapPin, Sparkles, Check, AlertCircle } from 'lucide-react';

interface Student {
  id: string;
  fullName: string;
  generation?: {
    name: string;
  } | null;
}

interface Teacher {
  id: string;
  fullName: string;
}

export default function PrivateRemedialForm({
  availableStudents,
  availableTeachers,
  currentUserId,
}: {
  availableStudents: Student[];
  availableTeachers: Teacher[];
  currentUserId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [venuePlaceName, setVenuePlaceName] = useState('Masjid Baitul Makmur (Ruang Khusus Remedial)');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [teacherId, setTeacherId] = useState(currentUserId);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((s) => s !== id));
      setErrorMessage(null);
    } else {
      if (selectedStudentIds.length >= 5) {
        setErrorMessage('Batas maksimal kuota pengajian private adalah 5 santri.');
        return;
      }
      setSelectedStudentIds([...selectedStudentIds, id]);
      setErrorMessage(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedStudentIds.length === 0) {
      setErrorMessage('Pilih minimal 1 santri untuk bimbingan private.');
      return;
    }

    if (selectedStudentIds.length > 5) {
      setErrorMessage('Maksimal kuota adalah 5 santri per sesi.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('venuePlaceName', venuePlaceName);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('teacherId', teacherId);
    selectedStudentIds.forEach((id) => formData.append('studentIds', id));

    startTransition(async () => {
      const res = await requestPrivateRemedial(formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        alert('Pengajuan pengajian private remedial berhasil dikirim ke antrean persetujuan PJ!');
        setTitle('');
        setSelectedStudentIds([]);
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="bg-white/65 backdrop-blur-xl rounded-2xl border border-slate-200/60 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span>Inisiasi Pengajian Private &amp; Remedial</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Bimbingan capaian khusus untuk santri yang tertinggal. Kuota dibatasi <strong>1–5 santri</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm shadow-purple-600/20 active:scale-95 transition-all"
        >
          {isOpen ? 'Tutup Form' : '+ Buat Pengajuan'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-100 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topik Pengajian / Materi Remedial
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Remedial Setoran Surat An-Naba' & Tajwid Idgham"
              className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tempat / Ruang Pengajian
              </label>
              <input
                type="text"
                required
                value={venuePlaceName}
                onChange={(e) => setVenuePlaceName(e.target.value)}
                placeholder="Nama Masjid / Rumah"
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ustadz Pembimbing
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waktu Mulai
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waktu Selesai
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Pilih Santri (Kuota 1 - 5) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Pilih Santri Bimbingan (Maksimal 5 Orang per Sesi)
              </label>
              <div className="flex items-center gap-2">
                {/* 5-slot visual dots */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((slot) => (
                    <span
                      key={slot}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        slot <= selectedStudentIds.length
                          ? 'bg-purple-600 ring-2 ring-purple-200'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    selectedStudentIds.length >= 5
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}
                >
                  {selectedStudentIds.length} / 5 Terpilih
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-2xl">
              {availableStudents.map((s) => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold'
                        : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div>{s.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {s.generation?.name || 'Caberawit'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm disabled:opacity-50"
            >
              {isPending ? 'Mengajukan...' : 'Kirim Pengajuan ke PJ'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
