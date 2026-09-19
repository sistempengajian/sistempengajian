import React from 'react';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getAssignmentDetail } from '../actions';
import StudentTaskDetail from '@/components/tugas/detail/StudentTaskDetail';
import TeacherTaskDetail from '@/components/tugas/detail/TeacherTaskDetail';
import ParentTaskDetail from '@/components/tugas/detail/ParentTaskDetail';
import PjTaskDetail from '@/components/tugas/detail/PjTaskDetail';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { title: true, description: true },
    });
    if (!assignment) {
      return { title: 'Tugas Tidak Ditemukan' };
    }
    return {
      title: `${assignment.title} | Tugas Pengajian`,
      description: assignment.description || 'Detail tugas pengajian',
    };
  } catch {
    return {
      title: 'Tugas Tidak Ditemukan',
    };
  }
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ studentId?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  let data: Awaited<ReturnType<typeof getAssignmentDetail>>;
  try {
    data = await getAssignmentDetail(id, resolvedSearchParams?.studentId);
  } catch {
    notFound();
  }

  return (
    <>
      {data.role === 'SANTRI' && (
        <StudentTaskDetail data={data as Extract<typeof data, { role: 'SANTRI' }>} />
      )}
      {data.role === 'PENGAJAR' && (
        <TeacherTaskDetail data={data as Extract<typeof data, { role: 'PENGAJAR' }>} />
      )}
      {data.role === 'ORANG_TUA' && (
        <ParentTaskDetail data={data as Extract<typeof data, { role: 'ORANG_TUA' }>} />
      )}
      {data.role === 'PJ' && (
        <PjTaskDetail data={data as Extract<typeof data, { role: 'PJ' }>} />
      )}
    </>
  );
}
