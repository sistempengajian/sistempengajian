import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { DashboardMetricsSkeleton } from '@/components/dashboard/DashboardMetricsSkeleton';

export default function DashboardLoading() {
  return (
    <PageContainer variant="standard" className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Boxless Hero Greeting Skeleton */}
      <div className="pt-1 pb-0.5 pl-1 space-y-2.5 pr-12 sm:pr-0">
        <div className="h-7 w-64 bg-emerald-900/10 rounded-xl animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-6 w-28 bg-emerald-500/15 rounded-full animate-pulse" />
          <div className="h-6 w-36 bg-white/80 rounded-full animate-pulse" />
        </div>
      </div>

      {/* 2. Streaming Metrics Mirror Skeleton (anti-CLS) */}
      <DashboardMetricsSkeleton />
    </PageContainer>
  );
}
