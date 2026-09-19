'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Check,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { updateAssignmentGraders } from '@/app/(protected)/tugas/actions';

export interface TeacherGraderOption {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface ManageGradersModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId?: string;
  availableTeachers?: TeacherGraderOption[];
  teachers?: TeacherGraderOption[];
  currentGraderIds?: string[];
  selectedGraderIds?: string[];
  onSuccess?: (updatedIds: string[]) => void;
  onSave?: (updatedIds: string[]) => void | Promise<void>;
}

export default function ManageGradersModal({
  isOpen,
  onClose,
  assignmentId,
  availableTeachers,
  teachers,
  currentGraderIds,
  selectedGraderIds,
  onSuccess,
  onSave,
}: ManageGradersModalProps) {
  const teacherList = availableTeachers || teachers || [];
  const initialIds = currentGraderIds || selectedGraderIds || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTeacher = (teacherId: string) => {
    setSelectedIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    );
  };

  const filteredTeachers = teacherList.filter((t) =>
    t.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      if (onSave) {
        await onSave(selectedIds);
        onClose();
        return;
      }

      if (assignmentId) {
        const res = await updateAssignmentGraders({
          assignmentId,
          graderIds: selectedIds,
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          if (onSuccess) onSuccess(selectedIds);
          onClose();
        }
      } else {
        if (onSuccess) onSuccess(selectedIds);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan akses koreksi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Hak Akses Koreksi Tugas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Beri izin pengajar lain untuk membantu memeriksa tugas ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Alert */}
        <div className="p-3 mx-4 mt-3 bg-amber-50/80 border border-amber-200/60 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Secara default, hanya pembuat tugas yang dapat mengoreksi. Centang pengajar di bawah untuk
            memberikan akses evaluasi & pemberian nilai.
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama pengajar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Teachers List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-[220px]">
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-400 text-xs">
              Tidak ada pengajar yang cocok dengan pencarian.
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const isChecked = selectedIds.includes(teacher.id);
              return (
                <div
                  key={teacher.id}
                  onClick={() => toggleTeacher(teacher.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-amber-50/60 border-amber-400 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {teacher.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {teacher.fullName}
                      </p>
                      <p className="text-[10px] text-slate-400">Pengajar Organisasi</p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      isChecked
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {selectedIds.length} Pengajar Dipilih
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Akses</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
