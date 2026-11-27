import React, { Suspense } from 'react';
import prisma from '@/lib/prisma';
import { getRoleTheme } from '@/lib/theme';
import { getEffectiveAuthUser, requireProtectedAuth } from '@/lib/auth';
import {
  getCachedUpcomingSchedules,
  getStudentCurriculumMetrics,
  getChildrenProgressMetrics,
  getTeacherDashboardMetrics,
  getPjTerritoryMetrics,
  getAdminGlobalMetrics,
  type ChildProgressMetric,
} from './queries';
import { formatWibDate, formatWibTime } from '@/lib/utils';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import {
  buildGlobalRoleItems,
  getScopedRoleCodesForTab,
  type RoleTabId,
} from '@/lib/role-context';
import {
  getCachedUserRoleSignals,
  resolveGlobalActiveRole,
} from '@/lib/role-context-server';


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
import PageContainer from '@/components/ui/PageContainer';

// ─────────────────────────────────────────────────────────────────────────────
// Heavy async component — fetches only active role DB metrics concurrently.
// Wrapped in <Suspense> so the page shell renders immediately while this streams.
// ─────────────────────────────────────────────────────────────────────────────
async function DashboardMetrics({
  profileId,
  activeRoleTabId,
  activeRoleCodes,
  organizationId,
  generationId,
  allIsSantri,
  allIsOrangTua,
  allIsPengajar,
  allIsWaliKelas,
  allIsPj,
  allIsAdmin,
  activeIsSantri,
  activeIsOrangTua,
  activeIsPengajar,
  activeIsWaliKelas,
  activeIsPj,
  activeIsAdmin,
  theme,
  kelompokName,
}: {
  profileId: string;
  activeRoleTabId: RoleTabId;
  activeRoleCodes: string[];
  organizationId: string | null | undefined;
  generationId: string | null | undefined;
  allIsSantri: boolean;
  allIsOrangTua: boolean;
  allIsPengajar: boolean;
  allIsWaliKelas: boolean;
  allIsPj: boolean;
  allIsAdmin: boolean;
  activeIsSantri: boolean;
  activeIsOrangTua: boolean;
  activeIsPengajar: boolean;
  activeIsWaliKelas: boolean;
  activeIsPj: boolean;
  activeIsAdmin: boolean;
  theme: ReturnType<typeof getRoleTheme> & { roleTitle: string };
  kelompokName: string;
}) {
  // Use getEffectiveAuthUser inside this async component — React.cache() deduplicates
  // within the render pass, and Redis provides cross-request caching.
  const { dbUser: profile } = await getEffectiveAuthUser();

  if (!profile) return null;

  const organizationHierarchyIds = [
    profile.organizationId,
    profile.organization?.parentId,
    profile.organization?.parent?.parentId,
  ].filter(Boolean) as string[];

  const homeroomClassIds = profile.homeroomClasses.map((c) => c.id);

  const childrenScopes = profile.children.map(({ student }) => ({
    organizationId: student.organizationId,
    parentOrgId: student.organization?.parentId ?? null,
    generationId: student.generationId,
  }));

  const childrenGenerationIds = Array.from(
    new Set(
      profile.children
        .map((c) => c.student.generationId)
        .filter(Boolean) as string[]
    )
  );

  // All heavy queries run concurrently scoped to active role tab
  const [
    upcomingSchedules,
    studentMetrics,
    childrenMetricsMap,
    teacherMetrics,
    pjMetrics,
    adminMetrics,
    extraPendingCount,
  ] = await Promise.all([
    getCachedUpcomingSchedules({
      userId: profileId,
      roles: activeRoleCodes as any,
      organizationId,
      organizationHierarchyIds,
      generationId,
      childrenGenerationIds,
      childrenScopes,
      homeroomClassIds,
    }),
    activeIsSantri
      ? getStudentCurriculumMetrics(profileId, generationId, organizationHierarchyIds)
      : Promise.resolve(null),
    activeIsOrangTua
      ? getChildrenProgressMetrics(profile.children)
      : Promise.resolve<Record<string, ChildProgressMetric>>({}),
    activeIsPengajar || activeIsWaliKelas
      ? getTeacherDashboardMetrics(profileId, homeroomClassIds)
      : Promise.resolve(null),
    activeIsPj
      ? getPjTerritoryMetrics(activeRoleCodes as any, organizationId)
      : Promise.resolve(null),
    activeIsAdmin
      ? getAdminGlobalMetrics()
      : Promise.resolve(null),
    (allIsAdmin || allIsPj) && !activeIsAdmin && !activeIsPj
      ? prisma.schedule
          .count({
            where: {
              scheduleType: 'PRIVATE_REMEDIAL',
              approvalStatus: 'PENDING',
              ...(!allIsAdmin && organizationId
                ? { organizationId }
                : {}),
            },
          })
          .catch(() => 0)
      : Promise.resolve(0),
  ]);

  const nextSchedule = upcomingSchedules[0] ?? null;
  const defaultScheduleHref = `/jadwal?role=${activeRoleTabId}`;
  const renderedAtIso = new Date().toISOString();

  const pendingApprovalsCount = activeIsAdmin
    ? adminMetrics?.pendingApprovals ?? 0
    : activeIsPj
      ? pjMetrics?.pendingApprovals ?? 0
      : extraPendingCount;

  return (
    <>
      {/* 2. Grid Status Modal */}
      <StatusGridSection
        roleKey={theme.roleKey}
        theme={theme}
        data={{
          fullName: profile.fullName,
          kelompokName,
          generationName: profile.generation?.name,
          gamification: profile.gamification,
          childrenList: profile.children.map(({ student, relationshipType }) => {
            const m = childrenMetricsMap[student.id];
            return {
              id: student.id,
              fullName: student.fullName,
              generationName: student.generation?.name,
              points: student.gamification?.totalPoints,
              relationshipType: relationshipType ?? undefined,
              curriculumProgressPercent: m?.curriculumPercentage ?? 0,
              monthlyProgressPercent: m?.monthlyPercentage ?? 0,
              attendancePercentage: m?.attendancePercentage ?? 0,
              attendanceHadir: m?.attendanceHadir ?? 0,
              attendanceTotal: m?.attendanceTotal ?? 0,
            };
          }),
          homeroomClassesCount: profile.homeroomClasses.length,
          teacherMonthlySessionsCount: teacherMetrics?.monthlySessionsCount ?? 0,
          teacherPendingGradingsCount: teacherMetrics?.pendingGradingsCount ?? 0,
          pendingApprovalsCount,
          dbHealth: adminMetrics?.dbHealth ?? 'Normal',
          nextScheduleTitle: nextSchedule?.title,
          nextScheduleTime: nextSchedule
            ? `${formatWibDate(nextSchedule.startTime, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })} • ${formatWibTime(nextSchedule.startTime)} WIB`
            : undefined,
          nextScheduleVenue: nextSchedule?.venuePlaceName,
          hafalanProgressPercent: studentMetrics?.overall.percentage ?? 0,
          monthlyProgressPercent: studentMetrics?.monthly.percentage ?? 0,
          monthlyProgressCompleted: studentMetrics?.monthly.completed ?? 0,
          monthlyProgressTotal: studentMetrics?.monthly.total ?? 0,
          monthlyAttendancePercent: studentMetrics?.monthlyAttendance.percentage ?? 0,
          monthlyAttendanceHadir: studentMetrics?.monthlyAttendance.hadir ?? 0,
          monthlyAttendanceTotal: studentMetrics?.monthlyAttendance.total ?? 0,
          monthLabel: studentMetrics?.monthLabel,
          recentPassedMaterials: studentMetrics?.recentPassedMaterials,
          alpaCount: studentMetrics?.alpaCount,
          badgesList: studentMetrics?.badgesList,
          pendingTasksCount: studentMetrics?.pendingTasksCount ?? 0,
          pendingTasksList: studentMetrics?.pendingTasksList ?? [],
        }}
      />

      {/* 3. Slider 3 Sesi Pengajian Terdekat */}
      <UpcomingScheduleCard
        schedules={upcomingSchedules}
        theme={theme}
        defaultScheduleHref={defaultScheduleHref}
        renderedAtIso={renderedAtIso}
      />

      {/* 4. Tampilan Khusus Peran Aktif */}
      {activeIsSantri && (
        <StudentCurriculumSection
          generationName={profile.generation?.name}
          theme={theme}
          studentMetrics={studentMetrics}
        />
      )}

      {activeIsOrangTua && (
        <ParentChildrenProgressSection
          childrenList={profile.children}
          childrenMetricsMap={childrenMetricsMap}
        />
      )}

      {(activeIsPengajar || activeIsWaliKelas) && <TeacherClassEvaluationSection />}

      {activeIsPj && (
        <PjTerritoryMonitoringSection
          pjMetrics={pjMetrics}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      )}

      {activeIsAdmin && (
        <AdminMasterControlSection adminMetrics={adminMetrics} />
      )}

      {/* 5. Menu Utama Sistem — disinkronkan dengan peran aktif & tetap menyediakan tab cepat */}
      <QuickActionsGrid
        generationName={profile.generation?.name}
        theme={theme}
        isSantri={allIsSantri}
        isOrangTua={allIsOrangTua}
        isPengajar={allIsPengajar}
        isWaliKelas={allIsWaliKelas}
        isPj={allIsPj}
        isAdmin={allIsAdmin}
        pendingApprovalsCount={pendingApprovalsCount}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell — uses getAuthUserLean (lightweight, Redis-cached) so Hero renders
// in < 500 ms. Heavy metrics stream in via Suspense.
// ─────────────────────────────────────────────────────────────────────────────
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; view?: string }>;
}) {
  const [{ dbUser: leanProfile }, resolvedSearchParams] = await Promise.all([
    requireProtectedAuth('lean'),
    searchParams,
  ]);

  const roleCodes = leanProfile.roles.map((r) => r.role);
  const roleSignals = await getCachedUserRoleSignals(leanProfile.id);

  const {
    items: availableRoleTabs,
    isAdmin: allIsAdmin,
    isPj: allIsPj,
    isTeacher: allIsPengajar,
    isParent: allIsOrangTua,
    isSantri: allIsSantri,
  } = buildGlobalRoleItems({
    roleCodes,
    hasChildren: roleSignals.hasChildren,
    hasHomeroomClasses: roleSignals.hasHomeroomClasses,
    hasScheduleAssignments: roleSignals.hasScheduleAssignments,
    generationId: leanProfile.generationId,
    generationName: leanProfile.generation?.name,
    organizationId: leanProfile.organizationId,
  });
  const allIsWaliKelas = roleCodes.includes('WALI_KELAS') || roleSignals.hasHomeroomClasses;

  const { activeRole: activeRoleTabId } = await resolveGlobalActiveRole({
    searchParamRole: resolvedSearchParams.role || resolvedSearchParams.view,
    availableRoleIds: availableRoleTabs.map((t) => t.id),
  });

  const activeRoleCodes =
    availableRoleTabs.length > 0
      ? getScopedRoleCodesForTab(activeRoleTabId, roleCodes)
      : roleCodes;
  const activeIsSantri = activeRoleTabId === 'student';
  const activeIsOrangTua = activeRoleTabId === 'parent';
  const activeIsPengajar = activeRoleTabId === 'teacher';
  const activeIsWaliKelas =
    activeIsPengajar && (roleCodes.includes('WALI_KELAS') || roleSignals.hasHomeroomClasses);
  const activeIsPj =
    activeRoleTabId === 'manage' &&
    (roleCodes.includes('PJ_KELOMPOK') ||
      roleCodes.includes('PJ_DESA') ||
      roleCodes.includes('PJ_DAERAH'));
  const activeIsAdmin =
    activeRoleTabId === 'manage' && roleCodes.includes('ADMIN_MASTER');

  const kelompokName = leanProfile.organization?.name || 'Kelompok Binaan';
  const theme = getRoleTheme(activeRoleCodes);

  return (
    <PageContainer variant="standard" className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Hero Section — renders immediately using lean profile & active role theme */}
      <DashboardHero
        fullName={leanProfile.fullName}
        generationName={leanProfile.generation?.name}
        kelompokName={kelompokName}
        theme={theme}
        isSantri={activeIsSantri}
        isPengajar={activeIsPengajar}
        isWaliKelas={activeIsWaliKelas}
        isOrangTua={activeIsOrangTua}
      />

      {/* Heavy metrics stream in while skeleton is shown */}
      <ErrorBoundary sectionName="Ringkasan Dashboard">
        <Suspense key={activeRoleTabId} fallback={<DashboardMetricsSkeleton />}>
          <DashboardMetrics
            profileId={leanProfile.id}
            activeRoleTabId={activeRoleTabId}
            activeRoleCodes={activeRoleCodes}
            organizationId={leanProfile.organizationId}
            generationId={leanProfile.generationId}
            allIsSantri={allIsSantri}
            allIsOrangTua={allIsOrangTua}
            allIsPengajar={allIsPengajar}
            allIsWaliKelas={allIsWaliKelas}
            allIsPj={allIsPj}
            allIsAdmin={allIsAdmin}
            activeIsSantri={activeIsSantri}
            activeIsOrangTua={activeIsOrangTua}
            activeIsPengajar={activeIsPengajar}
            activeIsWaliKelas={activeIsWaliKelas}
            activeIsPj={activeIsPj}
            activeIsAdmin={activeIsAdmin}
            theme={theme}
            kelompokName={kelompokName}
          />
        </Suspense>
      </ErrorBoundary>
    </PageContainer>
  );
}
