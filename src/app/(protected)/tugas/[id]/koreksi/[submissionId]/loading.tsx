import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function StudentGradingLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-6">
        {/* Top Navbar Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-1">
              <div className="w-48 h-4 rounded bg-slate-200 animate-pulse" />
              <div className="w-28 h-3 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-8 rounded-xl bg-slate-100 animate-pulse" />
            <div className="w-20 h-8 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        {/* Student Profile Card Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="w-36 h-6 rounded-lg bg-slate-200 animate-pulse" />
              <div className="w-56 h-3 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="w-24 h-7 rounded-full bg-slate-100 animate-pulse" />
        </div>

        {/* Work Area Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-44 h-4 rounded bg-slate-200 animate-pulse" />
          <div className="w-full h-24 rounded-2xl bg-slate-100 animate-pulse" />
        </div>

        {/* Grading Form Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-48 h-4 rounded bg-slate-200 animate-pulse" />
          <div className="flex gap-2">
            <div className="w-20 h-10 rounded-xl bg-slate-200 animate-pulse" />
            <div className="w-12 h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="w-12 h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="w-12 h-10 rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="w-full h-20 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
