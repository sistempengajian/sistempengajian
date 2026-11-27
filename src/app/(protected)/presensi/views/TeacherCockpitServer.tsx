import React from 'react';
import Link from 'next/link';
import { Calendar, QrCode } from 'lucide-react';
import { formatWibTime } from '@/lib/utils';
import PageContainer from '@/components/ui/PageContainer';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ClassroomCockpit from '@/components/presensi/ClassroomCockpit';
import type { RoleTabItem } from '@/components/navigation/RoleNavTabs';
import {
  PresensiUserProfile,
  loadDirectSchedule,
  loadTeacherCockpitData,
  resolveCockpitTab,
} from '../lib/presensi-queries';

interface TeacherCockpitServerProps {
  userProfile: PresensiUserProfile;
  directSchedule: Awaited<ReturnType<typeof loadDirectSchedule>>;
  roleCodes: string[];
  isPengajar: boolean;
  isPjOrAdmin: boolean;
  hasDualRole: boolean;
  availablePresensiRoles: RoleTabItem[];
  tabParam?: string;
}

export default async function TeacherCockpitServer({
  userProfile,
  directSchedule,
  roleCodes,
  isPengajar,
  isPjOrAdmin,
  hasDualRole,
  availablePresensiRoles: _availablePresensiRoles,
  tabParam,
}: TeacherCockpitServerProps) {
  const data = await loadTeacherCockpitData({
    userProfile,
    directSchedule,
    roleCodes,
    isPengajar,
    isPjOrAdmin,
  });

  if (!data.activeSchedule) {
    return (
      <PageContainer variant="standard" className="space-y-4">
        <div className="bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto border border-teal-200/60">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Belum Ada Sesi Pengajian Terjadwal
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Anda tidak memiliki jadwal pengajian aktif saat ini. Buat atau aktifkan jadwal di menu Jadwal Pengajian.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/jadwal"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Buka Kalender Jadwal
            </Link>
            {hasDualRole && (
              <Link
                href="/presensi?role=student"
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200/80 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                Buka Presensi Santri
              </Link>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  const initialCockpitTab = resolveCockpitTab(tabParam);

  return (
    <PageContainer variant="standard" className="space-y-4">
      <ErrorBoundary sectionName="Cockpit Presensi">
        <ClassroomCockpit
          key={data.activeSchedule.id}
          sessionId={data.session.id}
          scheduleId={data.activeSchedule.id}
          scheduleTitle={data.activeSchedule.title}
          scheduleTierLevel={data.activeSchedule.tierLevel}
          organizationName={data.activeSchedule.organization?.name}
          venueName={data.activeSchedule.venuePlaceName}
          scheduleDate={data.scheduleDate}
          startTime={formatWibTime(data.activeSchedule.startTime)}
          endTime={formatWibTime(data.activeSchedule.endTime)}
          students={data.studentItems}
          materials={data.resolvedMaterials}
          initialTotalMaterials={data.totalMaterialsCount}
          initialHasMore={data.initialHasMore}
          generations={data.allGenerations}
          initialProgress={data.initialProgress}
          initialEvaluatedStudentIds={data.initialEvaluatedStudentIds}
          canCompleteDaerah={data.canCompleteDaerah}
          canCompleteDesa={data.canCompleteDesa}
          availableSchedules={data.availableSchedulesProp}
          isSessionActive={data.isSessionActive}
          closedAt={
            data.session.closedAt ? data.session.closedAt.toISOString() : null
          }
          initialQrPayload={data.initialQrPayload}
          classes={data.classesProp}
          teacherInfo={data.teacherInfo}
          teachersList={data.teachersList}
          currentTeachingSummaryNotes={
            data.activeSchedule.teachingSummaryNotes || null
          }
          plannedChecklistItemIds={
            data.activeSchedule.plannedChecklistItemIds || []
          }
          previousSessionNotes={data.previousSessionNotes}
          initialTab={initialCockpitTab}
          sessionMonth={data.sessionMonth}
          sessionYear={data.sessionYear}
          initialScopeCounts={data.initialScopeCounts}
        />
      </ErrorBoundary>
    </PageContainer>
  );
}
