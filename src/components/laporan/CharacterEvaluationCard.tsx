'use client';

import React from 'react';
import {
  Heart,
  Sparkles,
  MessageSquareQuote,
  TrendingUp,
  Tag,
  Smile,
  ShieldCheck,
} from 'lucide-react';
import { CharacterAnalytics } from '@/app/(protected)/laporan/types';

interface CharacterEvaluationCardProps {
  character: CharacterAnalytics;
}

export default function CharacterEvaluationCard({ character }: CharacterEvaluationCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-2xs shrink-0">
            <Heart className="w-5 h-5 text-amber-600 fill-amber-500/30" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Evaluasi Karakter &amp; Adab Sesi
            </h3>
            <p className="text-xs text-slate-500">
              Penilaian adab, keaktifan belajar, dan catatan buku penghubung guru
            </p>
          </div>
        </div>

        {character.evaluatedSessionsCount > 0 && (
          <span className="text-xs font-semibold text-slate-500 self-start sm:self-auto">
            Berdasarkan {character.evaluatedSessionsCount} sesi pengajian
          </span>
        )}
      </div>

      {/* Grid 2 Skor Rata-rata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nilai Adab & Akhlaq */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              Nilai Adab &amp; Akhlaq
            </span>
            <span className="text-xs text-amber-900/80 mt-0.5 block">
              Sopan santun, ketertiban, dan akhlaqul karimah
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black text-amber-950">
              {character.averageAdab}
            </span>
            <span className="text-xs font-bold text-amber-700"> / 100</span>
          </div>
        </div>

        {/* Nilai Keaktifan & Kesungguhan */}
        <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/70 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
              Keaktifan &amp; Tartil
            </span>
            <span className="text-xs text-teal-900/80 mt-0.5 block">
              Semangat menyimak, bertanya, dan kelancaran
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black text-teal-950">
              {character.averageKeaktifan}
            </span>
            <span className="text-xs font-bold text-teal-700"> / 100</span>
          </div>
        </div>
      </div>

      {/* Tag Pujian Guru (Feedback Cloud) */}
      {character.feedbackTags.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Pujian &amp; Apresiasi Guru</span>
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {character.feedbackTags.map(({ tag, count }) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs"
              >
                <span>{tag}</span>
                <span className="w-4 h-4 rounded-full bg-amber-200/80 text-amber-900 font-extrabold text-[9px] flex items-center justify-center">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buku Penghubung Digital (Teacher's Notes Feed) */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquareQuote className="w-3.5 h-3.5 text-teal-600" />
          <span>Buku Penghubung Guru &amp; Orang Tua</span>
        </h4>

        {character.teacherNotesFeed.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/60 rounded-2xl border border-slate-100">
            Belum ada catatan khusus dari ustadz/ustadzah pada periode ini.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {character.teacherNotesFeed.map((feed) => (
              <div
                key={feed.id}
                className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">
                      {feed.teacherName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 text-[11px] truncate">
                      {feed.sessionTitle}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {feed.date}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed italic bg-white/80 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  &quot;{feed.note}&quot;
                </p>

                {feed.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {feed.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/60"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
