'use client';

import React, { useState, useMemo } from 'react';
import { ParentEngagementSummary, ParentVerificationItem } from '@/app/(protected)/analisis/types';
import {
  HeartHandshake,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  MessageCircle,
  Users,
  ShieldCheck,
} from 'lucide-react';
import CircularGauge from './CircularGauge';

interface ParentEngagementCardProps {
  engagement?: ParentEngagementSummary;
}

export const ParentEngagementCard: React.FC<ParentEngagementCardProps> = ({ engagement }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'ACTIVE'>('ALL');

  if (!engagement || !engagement.hasVerificationTasks || engagement.parentItems.length === 0) {
    return null;
  }

  const {
    totalRequiredTasks,
    totalVerifiedTasks,
    totalPendingTasks,
    overallVerificationRate,
    parentItems,
  } = engagement;

  const activeParentsCount = parentItems.filter((p) => p.status === 'AKTIF').length;
  const pendingParentsCount = parentItems.filter((p) => p.totalPending > 0).length;

  // Filter list by tab & search
  const filteredParents = useMemo(() => {
    return parentItems.filter((item) => {
      // Tab filter
      if (activeTab === 'PENDING' && item.totalPending === 0) return false;
      if (activeTab === 'ACTIVE' && item.status !== 'AKTIF') return false;

      // Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchStudent = item.studentName.toLowerCase().includes(query);
        const matchParent = item.parentName.toLowerCase().includes(query);
        const matchClass = item.className.toLowerCase().includes(query);
        return matchStudent || matchParent || matchClass;
      }
      return true;
    });
  }, [parentItems, activeTab, searchQuery]);

  const generateWaLink = (item: ParentVerificationItem) => {
    if (!item.parentPhone) return '#';
    const cleanPhone = item.parentPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
    const text = encodeURIComponent(
      `Assalamu'alaikum Wr. Wb. Bapak/Ibu ${item.parentName}, wali dari ananda *${item.studentName}*.\n\nKami mengingatkan bahwa terdapat *${item.totalPending} tugas pengajian* ananda yang masih menunggu paraf/persetujuan orang tua pada periode ini. Mohon bantuannya untuk memeriksa dan memaraf tugas ananda melalui aplikasi. Terima kasih. Jazakumullahu khaira.`
    );
    return `https://wa.me/${formattedPhone}?text=${text}`;
  };

  return (
    <div className="rounded-3xl border border-indigo-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-2xs">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Keaktifan Paraf Tugas Orang Tua</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/70">
                  <ShieldCheck className="h-3 w-3" />
                  Sinergi Rumah &amp; Pengajian
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring partisipasi orang tua dalam memeriksa &amp; memaraf penugasan santri
              </p>
            </div>
          </div>
        </div>

        {/* Global Rate Gauge & Status */}
        <div className="flex items-center gap-3 self-start lg:self-auto bg-indigo-50/60 p-2 rounded-2xl border border-indigo-100">
          <CircularGauge
            value={overallVerificationRate}
            size={42}
            strokeWidth={4.5}
            strokeColor="stroke-indigo-600"
            trackColor="stroke-indigo-200"
          >
            <span className="text-[11px] font-black text-indigo-950">{overallVerificationRate}%</span>
          </CircularGauge>
          <div className="pr-2">
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
              Total Terparaf
            </span>
            <span className="text-xs font-black text-slate-900">
              {totalVerifiedTasks} / {totalRequiredTasks} Penugasan
            </span>
          </div>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Tugas</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-900">{totalRequiredTasks}</span>
            <span className="text-[10px] text-slate-400 font-semibold">kali paraf</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sudah Diparaf</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-black text-emerald-800">{totalVerifiedTasks}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">({overallVerificationRate}%)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3">
          <div className="flex items-center gap-1.5 text-amber-700">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Menunggu Paraf</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-black text-amber-800">{totalPendingTasks}</span>
            <span className="text-[10px] text-amber-600 font-semibold">tugas</span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3">
          <div className="flex items-center gap-1.5 text-indigo-700">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Wali Sangat Aktif</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-black text-indigo-800">{activeParentsCount}</span>
            <span className="text-[10px] text-indigo-600 font-semibold">dari {parentItems.length} wali</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 pt-3 border-t border-slate-100">
        {/* Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-indigo-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua ({parentItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'PENDING'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Perlu Diparaf</span>
            {pendingParentsCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingParentsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sangat Aktif ({activeParentsCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari santri atau wali..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Parent List / Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
        {filteredParents.length === 0 ? (
          <div className="col-span-2 py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            Tidak ada data orang tua yang sesuai dengan filter pencarian.
          </div>
        ) : (
          filteredParents.map((item) => {
            const hasPending = item.totalPending > 0;
            const waLink = generateWaLink(item);

            return (
              <div
                key={item.studentId}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white p-3.5 transition shadow-2xs space-y-2.5"
              >
                {/* Header: Student & Parent Names */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">{item.studentName}</span>
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                        {item.className}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Wali: <strong className="text-slate-700 font-semibold">{item.parentName}</strong>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${
                      item.status === 'AKTIF'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : item.status === 'SEDANG'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {item.status === 'AKTIF' && <CheckCircle2 className="h-3 w-3" />}
                    {item.status === 'SEDANG' && <Clock className="h-3 w-3" />}
                    {item.status === 'PERLU_DIPACU' && <AlertTriangle className="h-3 w-3" />}
                    <span>
                      {item.status === 'AKTIF'
                        ? 'Aktif'
                        : item.status === 'SEDANG'
                        ? 'Cukup'
                        : 'Perlu Dipacu'}
                    </span>
                  </span>
                </div>

                {/* Progress Bar Paraf */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Progres Paraf:</span>
                    <span className="font-bold text-slate-800">
                      {item.totalVerified}/{item.totalRequired} Selesai ({item.verificationRate}%)
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.verificationRate >= 80
                          ? 'bg-emerald-500'
                          : item.verificationRate >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.verificationRate}%` }}
                    />
                  </div>
                </div>

                {/* Footer Actions: Last verification date & WA reminder */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                  <span className="text-slate-400">
                    {item.lastVerifiedAt
                      ? `Terakhir diparaf: ${new Date(item.lastVerifiedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : 'Belum ada paraf'}
                  </span>

                  {hasPending && item.parentPhone ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-lg transition"
                      title="Kirim pengingat paraf via WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3 text-emerald-600" />
                      <span>Ingatkan WA</span>
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ParentEngagementCard;
