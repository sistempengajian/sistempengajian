'use client';

import React from 'react';
import {
  MapPin,
  Map,
  Landmark,
  Users,
  Building2,
  ChevronDown,
  X,
} from 'lucide-react';
import { OrganizationType } from '@prisma/client';
import { OrganizationSelectOption } from './OrganizationSelectModal';

interface OrganizationSelectTriggerProps {
  selectedOrg?: OrganizationSelectOption | null;
  onClick: () => void;
  onClear?: () => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm';
}

const TYPE_CONFIG = {
  DAERAH: {
    label: 'Daerah',
    icon: Map,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconBgClass: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  DESA: {
    label: 'Desa',
    icon: Landmark,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBgClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  KELOMPOK: {
    label: 'Kelompok',
    icon: Users,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBgClass: 'bg-sky-50 text-sky-600 border-sky-200',
  },
};

export default function OrganizationSelectTrigger({
  selectedOrg,
  onClick,
  onClear,
  placeholder = 'Pilih Wilayah Binaan...',
  allowClear = false,
  disabled = false,
  className = '',
  size = 'default',
}: OrganizationSelectTriggerProps) {
  const config = selectedOrg
    ? TYPE_CONFIG[selectedOrg.type] || TYPE_CONFIG.KELOMPOK
    : null;
  const IconComponent = config ? config.icon : Building2;

  if (size === 'sm') {
    return (
      <div className={`relative flex items-center ${className}`}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`w-full text-left px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-slate-50/70 text-xs font-semibold text-slate-800 transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <IconComponent
              className={`w-3.5 h-3.5 shrink-0 ${
                selectedOrg ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <span className="truncate">
              {selectedOrg ? selectedOrg.name : placeholder}
            </span>
            {selectedOrg && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border shrink-0 ${config?.badgeClass}`}
              >
                {config?.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {allowClear && selectedOrg && onClear && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="w-4 h-4 rounded-md hover:bg-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Hapus Wilayah"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 group flex items-center justify-between gap-3 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          selectedOrg
            ? 'border-slate-200/90 bg-white hover:border-emerald-500/80 hover:bg-emerald-50/10'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedOrg ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Icon Box */}
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${config?.iconBgClass}`}
            >
              <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                  {selectedOrg.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${config?.badgeClass}`}
                >
                  {config?.label}
                </span>
              </div>

              {selectedOrg.parentName ? (
                <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  Induk Pengayom:{' '}
                  <span className="text-slate-700 font-semibold">
                    {selectedOrg.parentName}
                  </span>
                </p>
              ) : (
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Tingkat Pusat Wilayah (Tanpa Induk)
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-400 py-1 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 block truncate">
                {placeholder}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                Klik untuk mencari dan memilih dari daftar wilayah binaan
              </span>
            </div>
          </div>
        )}

        {/* Action Button Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          {allowClear && selectedOrg && onClear && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Hapus Pilihan"
            >
              <X className="w-4 h-4" />
            </span>
          )}

          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
              selectedOrg
                ? 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {selectedOrg ? 'Ganti' : 'Pilih'}
          </span>
        </div>
      </button>
    </div>
  );
}
