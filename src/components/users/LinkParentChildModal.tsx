'use client';

import React, { useState } from 'react';
import {
  X,
  Link2,
  Search,
  UserCheck,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Users,
} from 'lucide-react';
import { ParentRelationType } from '@prisma/client';
import { UserWithRelations } from './types';
import {
  linkParentChild,
  unlinkParentChild,
  searchParentCandidates,
} from '@/app/(protected)/users/actions';

interface LinkParentChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UserWithRelations | null;
  onSuccess: () => void;
}

export default function LinkParentChildModal({
  isOpen,
  onClose,
  student,
  onSuccess,
}: LinkParentChildModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [relationType, setRelationType] = useState<ParentRelationType>('AYAH');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const results = await searchParentCandidates(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mencari calon orang tua.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async () => {
    if (!selectedParentId) {
      setErrorMessage('Silakan pilih salah satu calon orang tua dari hasil pencarian.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await linkParentChild(
        student.id,
        selectedParentId,
        relationType
      );

      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(res.message);
      setIsSubmitting(false);
      setSelectedParentId(null);
      setSearchResults([]);
      setSearchQuery('');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (relationId: string) => {
    setUnlinkingId(relationId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await unlinkParentChild(relationId);
      if (!res.success) {
        setErrorMessage(res.message);
        setUnlinkingId(null);
        return;
      }

      setSuccessMessage(res.message);
      setUnlinkingId(null);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memutuskan hubungan orang tua.');
      setUnlinkingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <Link2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Tautkan Orang Tua ke Santri
              </h3>
              <span className="text-[11px] text-slate-500 block">
                Santri: <strong>{student.fullName}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Orang Tua yang Sudah Terhubung */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Orang Tua / Wali Terhubung Saat Ini:
            </span>

            {student.parents && student.parents.length > 0 ? (
              <div className="space-y-2">
                {student.parents.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {p.parent.fullName}
                        </span>
                        <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {p.relationshipType}
                        </span>
                      </div>
                      {p.parent.phoneNumber && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{p.parent.phoneNumber}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={unlinkingId === p.id}
                      onClick={() => handleUnlink(p.id)}
                      className="px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {unlinkingId === p.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Putuskan</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                Santri ini belum memiliki akun orang tua yang terhubung.
              </p>
            )}
          </div>

          {/* 2. Cari Akun Orang Tua */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 block">
              Cari &amp; Tambahkan Orang Tua:
            </span>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ketik nama lengkap atau nomor WA orang tua..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Cari</span>
              </button>
            </div>

            {/* Hasil Pencarian */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Pilih salah satu akun orang tua:
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {searchResults.map((parent) => {
                    const isSelected = selectedParentId === parent.id;
                    return (
                      <button
                        key={parent.id}
                        type="button"
                        onClick={() => setSelectedParentId(parent.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {parent.fullName}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {parent.phoneNumber || parent.email || 'Tanpa no HP'}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                            Dipilih
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Pilih Tipe Hubungan */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Tipe Hubungan Keluarga:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['AYAH', 'IBU', 'WALI'] as ParentRelationType[]).map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setRelationType(rel)}
                        className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          relationType === rel
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {rel === 'AYAH' ? 'Ayah' : rel === 'IBU' ? 'Ibu' : 'Wali'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Selesai
          </button>

          {selectedParentId && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleLink}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>Tautkan Sekarang</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
