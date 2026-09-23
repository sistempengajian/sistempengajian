'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, Users, UserX } from 'lucide-react';
import { ChildSelectorItem } from '@/app/(protected)/laporan/types';

interface ChildSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ChildSelectorItem[];
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  title?: string;
  subtitle?: string;
}

export default function ChildSelectorModal({
  isOpen,
  onClose,
  students,
  selectedStudentId,
  onSelectStudent,
  title = 'Pilih Ananda / Santri',
  subtitle = 'Pilih santri untuk melihat laporan perkembangan lengkap',
}: ChildSelectorModalProps) {
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const filtered = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.generationName.toLowerCase().includes(search.toLowerCase()) ||
      (s.className && s.className.toLowerCase().includes(search.toLowerCase()))
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        {/* Drag handle (Mobile) */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header Modal */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200/60">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {title}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        {students.length > 3 && (
          <div className="flex-shrink-0 p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau kelas..."
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* List Santri */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 space-y-1">
              <UserX className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Santri tidak ditemukan</p>
              <p className="text-[11px] text-slate-400">
                Tidak ada data yang cocok dengan pencarian
              </p>
            </div>
          ) : (
            filtered.map((s) => {
              const isSelected = s.id === selectedStudentId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelectStudent(s.id);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200/70'
                      }`}
                    >
                      {s.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs sm:text-sm truncate ${
                          isSelected ? 'font-bold text-teal-950' : 'font-semibold text-slate-900'
                        }`}
                      >
                        {s.fullName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 truncate">
                        <span className="font-medium text-teal-700">{s.generationName}</span>
                        {s.className && (
                          <>
                            <span>•</span>
                            <span className="truncate">{s.className}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-3.5 border-t border-slate-100 bg-slate-50/60 flex justify-end rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
