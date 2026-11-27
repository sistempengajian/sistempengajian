import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { requireProtectedAuth } from '@/lib/auth';
import { resolveGlobalActiveRole } from '@/lib/role-context-server';
import PageContainer from '@/components/ui/PageContainer';
import {
  loadDirectSchedule,
  isUserAssignedTeacher,
  buildAvailablePresensiRoles,
} from './lib/presensi-queries';
import TeacherCockpitServer from './views/TeacherCockpitServer';
import StudentScannerServer from './views/StudentScannerServer';
import ParentMonitorServer from './views/ParentMonitorServer';
import PjMonitorServer from './views/PjMonitorServer';

export default async function PresensiPage({
  searchParams,
}: {
  searchParams?: Promise<{
    scheduleId?: string;
    studentId?: string;
    tab?: string;
    role?: string;
    mode?: string;
  }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedScheduleId = resolvedParams.scheduleId;
  const { dbUser: userProfile } = await requireProtectedAuth('full');

  const directSchedule = await loadDirectSchedule(requestedScheduleId);
  const roleCodes = userProfile.roles.map((r) => r.role);

  const isAssignedTeacherOfRequestedSchedule = isUserAssignedTeacher(
    directSchedule,
    userProfile.id
  );

  const isPengajar =
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    Boolean(directSchedule && isAssignedTeacherOfRequestedSchedule);
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPjOrAdmin =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('ADMIN_MASTER');
  const hasDualRole = isPengajar && isSantri;

  const explicitRoleParam = resolvedParams.role || resolvedParams.mode;

  const availablePresensiRoles = buildAvailablePresensiRoles({
    roleCodes,
    isPjOrAdmin,
    isPengajar,
    isOrangTua,
    isSantri,
    requestedScheduleId,
  });

  const { activeRole } = await resolveGlobalActiveRole({
    searchParamRole: explicitRoleParam,
    availableRoleIds: availablePresensiRoles.map((r) => r.id),
  });

  // Guard akses jadwal pengajar lain jika bukan PJ/Admin dan bukan dual-role santri
  if (
    requestedScheduleId &&
    isPengajar &&
    !isPjOrAdmin &&
    !isAssignedTeacherOfRequestedSchedule &&
    !isSantri
  ) {
    return (
      <PageContainer variant="standard" className="space-y-4">
        <div className="bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-200/60">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Ditolak</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Anda tidak terdaftar sebagai pengajar pada sesi jadwal ini. Hanya pengajar utama, pengajar pendamping, pengajar badal, atau wali kelas yang dapat mengakses presensi sesi ini.
          </p>
          <Link
            href="/presensi"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Presensi Saya
          </Link>
        </div>
      </PageContainer>
    );
  }

  // Jika membuka link sesi spesifik (?scheduleId=...) tanpa override peran eksplisit, hormati peran pengajar/PJ bila berhak atas sesi tersebut
  const shouldRenderCockpit =
    (activeRole === 'teacher' && (isPengajar || (isPjOrAdmin && Boolean(requestedScheduleId)))) ||
    (!explicitRoleParam &&
      Boolean(requestedScheduleId) &&
      (isAssignedTeacherOfRequestedSchedule || isPjOrAdmin));

  if (shouldRenderCockpit) {
    return (
      <TeacherCockpitServer
        userProfile={userProfile}
        directSchedule={directSchedule}
        roleCodes={roleCodes}
        isPengajar={isPengajar}
        isPjOrAdmin={isPjOrAdmin}
        hasDualRole={hasDualRole}
        availablePresensiRoles={availablePresensiRoles}
        tabParam={resolvedParams.tab}
      />
    );
  }

  if (activeRole === 'student' && isSantri) {
    return (
      <StudentScannerServer
        userProfile={userProfile}
        requestedScheduleId={requestedScheduleId}
        tabParam={resolvedParams.tab}
        availablePresensiRoles={availablePresensiRoles}
      />
    );
  }

  if (activeRole === 'parent' && isOrangTua) {
    return (
      <ParentMonitorServer
        userProfile={userProfile}
        availablePresensiRoles={availablePresensiRoles}
        preselectedScheduleId={
          typeof resolvedParams.scheduleId === 'string'
            ? resolvedParams.scheduleId
            : undefined
        }
        preselectedStudentId={
          typeof resolvedParams.studentId === 'string'
            ? resolvedParams.studentId
            : undefined
        }
        tabParam={resolvedParams.tab}
      />
    );
  }

  if (isPjOrAdmin) {
    return (
      <PjMonitorServer
        roleCodes={roleCodes}
        organizationId={userProfile.organizationId}
        availablePresensiRoles={availablePresensiRoles}
      />
    );
  }

  if (isPengajar) {
    return (
      <TeacherCockpitServer
        userProfile={userProfile}
        directSchedule={directSchedule}
        roleCodes={roleCodes}
        isPengajar={isPengajar}
        isPjOrAdmin={isPjOrAdmin}
        hasDualRole={hasDualRole}
        availablePresensiRoles={availablePresensiRoles}
        tabParam={resolvedParams.tab}
      />
    );
  }

  if (isOrangTua) {
    return (
      <ParentMonitorServer
        userProfile={userProfile}
        availablePresensiRoles={availablePresensiRoles}
        preselectedScheduleId={
          typeof resolvedParams.scheduleId === 'string'
            ? resolvedParams.scheduleId
            : undefined
        }
        preselectedStudentId={
          typeof resolvedParams.studentId === 'string'
            ? resolvedParams.studentId
            : undefined
        }
        tabParam={resolvedParams.tab}
      />
    );
  }

  return (
    <StudentScannerServer
      userProfile={userProfile}
      requestedScheduleId={requestedScheduleId}
      tabParam={resolvedParams.tab}
      availablePresensiRoles={availablePresensiRoles}
    />
  );
}
