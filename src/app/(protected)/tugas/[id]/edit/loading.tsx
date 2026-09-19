import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function TaskEditLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-6">
        {/* Back Link Skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </div>
          <div className="w-36 h-4 rounded bg-slate-200 animate-pulse" />
        </div>

        {/* Header Card Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-2">
          <div className="w-56 h-7 rounded-xl bg-slate-200 animate-pulse" />
          <div className="w-96 max-w-full h-4 rounded bg-slate-100 animate-pulse" />
        </div>

        {/* Section Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-48 h-4 rounded bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-52 h-4 rounded bg-slate-200 animate-pulse" />
          <div className="w-full h-10 rounded-xl bg-slate-100 animate-pulse" />
          <div className="w-full h-24 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
