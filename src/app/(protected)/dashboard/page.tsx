import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getRoleTheme } from '@/lib/theme';
import { getEffectiveAuthUser } from '@/lib/auth';
import {
  getUpcomingScheduleForUser,
  getStudentCurriculumMetrics,
  getChildrenProgressMetrics,
  getPjTerritoryMetrics,
  getAdminGlobalMetrics,
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

export default async function DashboardPage() {
  const { authUser, dbUser: profile } = await getEffectiveAuthUser();

  if (!authUser) {
    redirect('/login');
  }

  if (!profile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(
      '/login?auth_error=' +
        encodeURIComponent(
          'Profil pengguna tidak ditemukan di database. Silakan masuk kembali.'
        )
    );
  }

  // Determine user role flags
  const roleCodes = profile.roles.map((r) => r.role);
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPengajar = roleCodes.includes('PENGAJAR');
  const isWaliKelas = roleCodes.includes('WALI_KELAS');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isAdmin = roleCodes.includes('ADMIN_MASTER');

  const childrenGenerationIds = profile.children
    .map((c) => c.student.generationId)
    .filter(Boolean) as string[];

  const homeroomClassIds = profile.homeroomClasses.map((c) => c.id);

  // Fetch upcoming schedule and role-specific metrics concurrently
  const [
    nextSchedule,
    studentMetrics,
    childrenMetricsMap,
    pjMetrics,
    adminMetrics,
  ] = await Promise.all([
    getUpcomingScheduleForUser({
      userId: profile.id,
      roles: roleCodes,
      organizationId: profile.organizationId,
      generationId: profile.generationId,
      childrenGenerationIds,
      homeroomClassIds,
    }),
    isSantri
      ? getStudentCurriculumMetrics(profile.id, profile.generationId)
      : Promise.resolve(null),
    isOrangTua
      ? getChildrenProgressMetrics(profile.children)
      : Promise.resolve<Record<string, import('./queries').ChildProgressMetric>>({}),
    isPj
      ? getPjTerritoryMetrics(roleCodes, profile.organizationId)
      : Promise.resolve(null),
    isAdmin
      ? getAdminGlobalMetrics()
      : Promise.resolve(null),
  ]);

  // Fetch target material from schedule or fallback to generation syllabus
  const targetGenId = nextSchedule?.class?.generationId || profile.generationId;
  const scheduledMaterial =
    nextSchedule?.scheduleMaterials?.[0]?.material ||
    (await prisma.material.findFirst({
      where: {
        isActive: true,
        ...(targetGenId ? { targetGenerationId: targetGenId } : {}),
      },
      include: {
        targetGeneration: true,
      },
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

  // Nama wilayah (kelompoknya saja)
  const kelompokName = profile.organization?.name || 'Kelompok Binaan';

  // Theme definition per role
  const baseTheme = getRoleTheme(roleCodes);
  const theme = {
    ...baseTheme,
    roleTitle: isSantri
      ? `Santri • ${profile.generation?.name || 'Reguler'}`
      : baseTheme.roleTitle,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Hero Section */}
      <DashboardHero
        fullName={profile.fullName}
        generationName={profile.generation?.name}
        kelompokName={kelompokName}
        theme={theme}
        isSantri={isSantri}
        isPengajar={isPengajar}
        isWaliKelas={isWaliKelas}
        isOrangTua={isOrangTua}
      />

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

      {/* 5. Menu Utama Sistem */}
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
    </div>
  );
}
