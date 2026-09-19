import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function TaskDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-6">
        {/* Back navigation button skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </div>
          <div className="w-32 h-4 rounded-md bg-slate-200 animate-pulse" />
        </div>

        {/* Main Header Card Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-24 h-6 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-20 h-6 rounded-full bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="w-3/4 h-8 rounded-xl bg-slate-200 animate-pulse" />
            <div className="w-1/2 h-4 rounded-lg bg-slate-100 animate-pulse" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex gap-4">
            <div className="w-32 h-10 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="w-32 h-10 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-40 h-5 rounded-lg bg-slate-200 animate-pulse" />
          <div className="space-y-2.5">
            <div className="w-full h-12 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="w-full h-12 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="w-full h-12 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
