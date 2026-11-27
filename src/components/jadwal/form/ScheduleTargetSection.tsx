'use client';

import React from 'react';
import {
  Users,
  Globe,
  GraduationCap,
  Layers,
  CheckCircle2,
  Search,
  Check,
} from 'lucide-react';
import { RollingTargetScope } from '@prisma/client';
import type {
  AvailableClass,
  AvailableGeneration,
  ScopedOrganization,
} from '../InteractiveCalendar';

interface ScheduleTargetSectionProps {
  targetScope: RollingTargetScope;
  setTargetScope: (scope: RollingTargetScope) => void;
  selectedOrgObj: ScopedOrganization | undefined;
  primaryClassId: string;
  setPrimaryClassId: (id: string) => void;
  isCombinedSession: boolean;
  setIsCombinedSession: (v: boolean) => void;
  additionalClassIds: string[];
  setAdditionalClassIds: (ids: string[]) => void;
  toggleAdditionalClass: (classId: string) => void;
  classSearchQuery: string;
  setClassSearchQuery: (q: string) => void;
  filteredClasses: AvailableClass[];
  availableGenerations: AvailableGeneration[];
  selectedGenerationId: string;
  setSelectedGenerationId: (id: string) => void;
}

export default function ScheduleTargetSection({
  targetScope,
  setTargetScope,
  selectedOrgObj,
  primaryClassId,
  setPrimaryClassId,
  isCombinedSession,
  setIsCombinedSession,
  additionalClassIds,
  setAdditionalClassIds,
  toggleAdditionalClass,
  classSearchQuery,
  setClassSearchQuery,
  filteredClasses,
  availableGenerations,
  selectedGenerationId,
  setSelectedGenerationId,
}: ScheduleTargetSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
          <Users className="w-4 h-4 text-teal-600" />
          <span>2. Target Peserta Pengajian</span>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Tentukan audiens kajian
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setTargetScope(RollingTargetScope.WILAYAH_UMUM)}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
            targetScope === RollingTargetScope.WILAYAH_UMUM
              ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <Globe className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold leading-snug">Umum Se-wilayah</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Terbuka bagi seluruh jamaah &amp; santri di wilayah
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTargetScope(RollingTargetScope.KELAS)}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
            targetScope === RollingTargetScope.KELAS
              ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold leading-snug">Berdasarkan Kelas</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih satu atau lebih kelas/halaqah khusus
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTargetScope(RollingTargetScope.GENERASI)}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
            targetScope === RollingTargetScope.GENERASI
              ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold leading-snug">
              Berdasarkan Jenjang Usia
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih satu atau lebih jenjang usia santri
            </p>
          </div>
        </button>
      </div>

      {targetScope === RollingTargetScope.WILAYAH_UMUM && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            Sesi ini ditujukan untuk{' '}
            <strong>seluruh peserta / jamaah umum</strong> pada cakupan{' '}
            <strong className="text-slate-900">
              {selectedOrgObj?.name || 'wilayah terpilih'}
            </strong>
            .
          </span>
        </div>
      )}

      {targetScope === RollingTargetScope.KELAS && (
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-teal-600" />
                <span>
                  Kelas Utama (Induk Sesi){' '}
                  <span className="text-rose-500">*</span>
                </span>
              </label>
              <span className="text-xs text-slate-500">Wajib dipilih</span>
            </div>

            {(filteredClasses.length > 5 || classSearchQuery.trim().length > 0) && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  placeholder="Cari nama kelas atau jenjang..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-400"
                />
              </div>
            )}

            <select
              value={primaryClassId}
              onChange={(e) => {
                const newPrimary = e.target.value;
                setPrimaryClassId(newPrimary);
                setAdditionalClassIds(
                  additionalClassIds.filter((id) => id !== newPrimary)
                );
              }}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-medium text-slate-800"
              required={targetScope === RollingTargetScope.KELAS}
            >
              <option value="">-- Pilih Kelas Utama --</option>
              {filteredClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}{' '}
                  {cls.generation?.name ? `(${cls.generation.name})` : ''} —{' '}
                  {cls.tierLevel}
                </option>
              ))}
            </select>
          </div>

          {primaryClassId && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCombinedSession}
                  onChange={(e) => {
                    setIsCombinedSession(e.target.checked);
                    if (!e.target.checked) setAdditionalClassIds([]);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Sesi Gabungan (Gabung dengan Kelas Lain)</span>
                {isCombinedSession && additionalClassIds.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 ml-auto">
                    +{additionalClassIds.length} Kelas Tambahan
                  </span>
                )}
              </label>
              <p className="text-xs text-slate-500 pl-6.5">
                Centang jika pengajian ini diselenggarakan bersama dengan kelas binaan lain di tempat/waktu yang sama.
              </p>

              {isCombinedSession && (
                <div className="pt-2 pl-6.5 space-y-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Pilih Kelas yang Digabungkan:
                    </span>
                    <span className="text-xs text-slate-500">
                      Total {1 + additionalClassIds.length} kelas dalam sesi ini
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 p-1 border border-slate-200/80 rounded-xl bg-white">
                    {filteredClasses.filter((c) => c.id !== primaryClassId)
                      .length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Tidak ada kelas lain yang tersedia di wilayah ini.
                      </div>
                    ) : (
                      filteredClasses
                        .filter((c) => c.id !== primaryClassId)
                        .map((cls) => {
                          const isSelected = additionalClassIds.includes(cls.id);
                          return (
                            <div
                              key={cls.id}
                              onClick={() => toggleAdditionalClass(cls.id)}
                              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                                isSelected
                                  ? 'bg-teal-50/80 border-teal-400/80 text-teal-950 font-semibold shadow-2xs'
                                  : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                    isSelected
                                      ? 'bg-teal-600 border-teal-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  )}
                                </div>
                                <span className="text-xs truncate">
                                  {cls.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 text-xs">
                                {cls.generation?.name && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    {cls.generation.name}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {cls.tierLevel}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {targetScope === RollingTargetScope.GENERASI && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Pilih 1 Jenjang Usia Sasaran:
            </span>
            <span className="text-xs text-slate-500">
              Kurikulum pengajian disesuaikan per jenjang
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {availableGenerations.map((gen) => {
              const isSelected = selectedGenerationId === gen.id;
              return (
                <button
                  key={gen.id}
                  type="button"
                  onClick={() => setSelectedGenerationId(gen.id)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-2 ring-teal-400/30 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-xs">{gen.name}</span>
                  <span className="text-xs text-slate-500 font-normal">
                    {gen.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
