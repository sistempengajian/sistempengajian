import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getRoleTheme } from '@/lib/theme';
import { getAuthUserLean, getEffectiveAuthUser } from '@/lib/auth';
import {
  getUpcomingScheduleForUser,
  getCachedUpcomingSchedule,
  getStudentCurriculumMetrics,
  getChildrenProgressMetrics,
  getPjTerritoryMetrics,
  getAdminGlobalMetrics,
  type ChildProgressMetric,
} from './queries';


import DashboardHero from '@/components/dashboard/DashboardHero';
import StatusGridSection from '@/components/dashboard/StatusGridSection';
import UpcomingScheduleCard from '@/components/dashboard/UpcomingScheduleCard';
import StudentCurriculumSection from '@/components/dashboard/StudentCurriculumSection';
import ParentChildrenProgressSection from '@/components/dashboard/ParentChildrenProgressSection';
import TeacherClassEvaluationSection from '@/components/dashboard/TeacherClassEvaluationSection';
import PjTerritoryMonitoringSection from '@/components/dashboard/PjTerritoryMonitoringSection';
import AdminMasterControlSection from '@/components/dashboard/AdminMasterControlSection';
import QuickActionsGrid from '@/components/dashboard/QuickActionsGrid';
import { DashboardMetricsSkeleton } from '@/components/dashboard/DashboardMetricsSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Heavy async component — fetches all DB metrics concurrently.
// Wrapped in <Suspense> so the page shell renders immediately while this streams.
// ─────────────────────────────────────────────────────────────────────────────
async function DashboardMetrics({
  profileId,
  roleCodes,
  organizationId,
  generationId,
  childrenGenerationIds,
  homeroomClassIds,
  isSantri,
  isOrangTua,
  isPengajar,
  isWaliKelas,
  isPj,
  isAdmin,
  theme,
  kelompokName,
  childrenRaw,
  gamification,
}: {
  profileId: string;
  roleCodes: string[];
  organizationId: string | null | undefined;
  generationId: string | null | undefined;
  childrenGenerationIds: string[];
  homeroomClassIds: string[];
  isSantri: boolean;
  isOrangTua: boolean;
  isPengajar: boolean;
  isWaliKelas: boolean;
  isPj: boolean;
  isAdmin: boolean;
  theme: ReturnType<typeof getRoleTheme> & { roleTitle: string };
  kelompokName: string;
  // Minimal children/gamification shape forwarded from lean profile
  childrenRaw: Array<{ student: { id: string; fullName: string; generationId?: string | null; generation?: { name: string } | null }; relationshipType?: string | null }>;
  gamification: { totalPoints: number } | null | undefined;
}) {
  // Use getEffectiveAuthUser inside this async component — React.cache() deduplicates
  // within the render pass, and Redis provides cross-request caching.
  const { dbUser: profile } = await getEffectiveAuthUser();

  if (!profile) return null;

  // All heavy queries run concurrently
  const [
    nextSchedule,
    studentMetrics,
    childrenMetricsMap,
    pjMetrics,
    adminMetrics,
  ] = await Promise.all([
    getCachedUpcomingSchedule({
      userId: profileId,
      roles: roleCodes as any,
      organizationId,
      generationId,
      childrenGenerationIds,
      homeroomClassIds,
    }),
    isSantri
      ? getStudentCurriculumMetrics(profileId, generationId)
      : Promise.resolve(null),
    isOrangTua
      ? getChildrenProgressMetrics(profile.children)
      : Promise.resolve<Record<string, ChildProgressMetric>>({}),
    isPj
      ? getPjTerritoryMetrics(roleCodes as any, organizationId)
      : Promise.resolve(null),
    isAdmin
      ? getAdminGlobalMetrics()
      : Promise.resolve(null),
  ]);

  // Fallback material fetch
  const targetGenId = nextSchedule?.class?.generationId || generationId;
  const scheduledMaterial =
    nextSchedule?.scheduleMaterials?.[0]?.material ||
    (await prisma.material.findFirst({
      where: {
        isActive: true,
        ...(targetGenId ? { targetGenerationId: targetGenId } : {}),
      },
      include: { targetGeneration: true },
      orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
    }));

  const targetMaterialGenCode =
    scheduledMaterial?.targetGeneration?.code ||
    profile.generation?.code ||
    'CABERAWIT';
  const targetMaterialUrl = scheduledMaterial
    ? `/kurikulum?gen=${targetMaterialGenCode}#material-${scheduledMaterial.id}`
    : `/kurikulum?gen=${targetMaterialGenCode}`;

  const defaultRoleParam = isSantri
    ? 'role=student'
    : isOrangTua
      ? 'role=parent'
      : isPengajar || isWaliKelas
        ? 'role=teacher'
        : 'role=manage';

  const defaultScheduleHref = `/jadwal?${defaultRoleParam}`;

  const pendingApprovalsCount = isPj
    ? pjMetrics?.pendingApprovals ?? 0
    : isAdmin
      ? await prisma.schedule.count({
          where: {
            scheduleType: 'PRIVATE_REMEDIAL',
            approvalStatus: 'PENDING',
          },
        })
      : 0;

  return (
    <>
      {/* 2. Grid Status Modal */}
      <StatusGridSection
        roleKey={theme.roleKey}
        theme={theme}
        data={{
          fullName: profile.fullName,
          generationName: profile.generation?.name,
          gamification: profile.gamification,
          childrenList: profile.children.map(({ student, relationshipType }) => ({
            id: student.id,
            fullName: student.fullName,
            generationName: student.generation?.name,
            points: student.gamification?.totalPoints,
            relationshipType: relationshipType ?? undefined,
            curriculumProgressPercent:
              childrenMetricsMap[student.id]?.curriculumPercentage,
          })),
          homeroomClassesCount: profile.homeroomClasses.length,
          pendingApprovalsCount,
          nextScheduleTitle: nextSchedule?.title,
          nextScheduleTime: nextSchedule
            ? `${new Date(nextSchedule.startTime).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })} • ${new Date(nextSchedule.startTime).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })} WIB`
            : undefined,
          nextScheduleVenue: nextSchedule?.venuePlaceName,
          hafalanProgressPercent: studentMetrics?.overallPercentage,
          recentPassedMaterials: studentMetrics?.recentPassedMaterials,
          alpaCount: studentMetrics?.alpaCount,
          badgesList: studentMetrics?.badgesList,
        }}
      />

      {/* 3. Sesi Pengajian Terdekat */}
      <UpcomingScheduleCard
        nextSchedule={nextSchedule}
        scheduledMaterial={scheduledMaterial}
        theme={theme}
        defaultScheduleHref={defaultScheduleHref}
        targetMaterialUrl={targetMaterialUrl}
      />

      {/* 4. Tampilan Khusus Peran */}
      {isSantri && (
        <StudentCurriculumSection
          generationName={profile.generation?.name}
          theme={theme}
          studentMetrics={studentMetrics}
        />
      )}

      {isOrangTua && (
        <ParentChildrenProgressSection
          childrenList={profile.children}
          childrenMetricsMap={childrenMetricsMap}
        />
      )}

      {(isPengajar || isWaliKelas) && <TeacherClassEvaluationSection />}

      {isPj && (
        <PjTerritoryMonitoringSection
          pjMetrics={pjMetrics}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      )}

      {isAdmin && (
        <AdminMasterControlSection adminMetrics={adminMetrics} />
      )}

      {/* 5. Menu Utama Sistem — also available in shell, duplicated here for pendingApprovalsCount */}
      <QuickActionsGrid
        generationName={profile.generation?.name}
        theme={theme}
        isSantri={isSantri}
        isOrangTua={isOrangTua}
        isPengajar={isPengajar}
        isWaliKelas={isWaliKelas}
        isPj={isPj}
        isAdmin={isAdmin}
        pendingApprovalsCount={pendingApprovalsCount}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell — uses getAuthUserLean (lightweight, Redis-cached) so Hero renders
// in < 500 ms. Heavy metrics stream in via Suspense.
// ─────────────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  // Use lean profile for instant auth guard + Hero render
  const { authUser, dbUser: leanProfile } = await getAuthUserLean();

  if (!authUser) {
    redirect('/login');
  }

  if (!leanProfile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(
      '/login?auth_error=' +
        encodeURIComponent(
          'Profil pengguna tidak ditemukan di database. Silakan masuk kembali.'
        )
    );
  }

  const roleCodes = leanProfile.roles.map((r) => r.role);
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPengajar = roleCodes.includes('PENGAJAR');
  const isWaliKelas = roleCodes.includes('WALI_KELAS');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isAdmin = roleCodes.includes('ADMIN_MASTER');

  const kelompokName = leanProfile.organization?.name || 'Kelompok Binaan';

  const baseTheme = getRoleTheme(roleCodes);
  const theme = {
    ...baseTheme,
    roleTitle: isSantri
      ? `Santri • ${leanProfile.generation?.name || 'Reguler'}`
      : baseTheme.roleTitle,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Hero Section — renders immediately using lean profile */}
      <DashboardHero
        fullName={leanProfile.fullName}
        generationName={leanProfile.generation?.name}
        kelompokName={kelompokName}
        theme={theme}
        isSantri={isSantri}
        isPengajar={isPengajar}
        isWaliKelas={isWaliKelas}
        isOrangTua={isOrangTua}
      />

      {/* Heavy metrics stream in while skeleton is shown */}
      <Suspense fallback={<DashboardMetricsSkeleton />}>
        <DashboardMetrics
          profileId={leanProfile.id}
          roleCodes={roleCodes}
          organizationId={leanProfile.organizationId}
          generationId={leanProfile.generationId}
          childrenGenerationIds={[]}
          homeroomClassIds={[]}
          isSantri={isSantri}
          isOrangTua={isOrangTua}
          isPengajar={isPengajar}
          isWaliKelas={isWaliKelas}
          isPj={isPj}
          isAdmin={isAdmin}
          theme={theme}
          kelompokName={kelompokName}
          childrenRaw={[]}
          gamification={null}
        />
      </Suspense>
    </div>
  );
}
