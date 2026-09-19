'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperInputProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  suffix?: string;
}

export default function StepperInput({
  value,
  min = 1,
  max = 10,
  onChange,
  disabled = false,
  label,
  suffix = 'Materi',
}: StepperInputProps) {
  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-xs font-bold text-slate-700">{label}</span>}
      <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/70 text-slate-700 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs"
          title="Kurangi"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="px-3.5 py-1 text-center min-w-[3.5rem]">
          <span className="font-extrabold text-sm text-slate-900 leading-none">{value}</span>
          {suffix && <span className="text-[10px] font-medium text-slate-500 block">{suffix}</span>}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/70 text-slate-700 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs"
          title="Tambah"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
