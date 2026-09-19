import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getAssignmentDetail, getAssignmentFormData } from '../../actions';
import TaskEditForm from '@/components/tugas/detail/TaskEditForm';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { title: true },
    });
    return {
      title: assignment ? `Edit: ${assignment.title} | Tugas Pengajian` : 'Edit Tugas',
    };
  } catch {
    return {
      title: 'Edit Tugas',
    };
  }
}

export default async function TaskEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getAssignmentDetail>>;
  let formData: Awaited<ReturnType<typeof getAssignmentFormData>>;
  try {
    [data, formData] = await Promise.all([
      getAssignmentDetail(id),
      getAssignmentFormData(id),
    ]);
  } catch {
    notFound();
  }

  // Hanya PENGAJAR dan PJ yang merupakan pemilik tugas (atau admin) yang berhak mengedit
  if (data.role !== 'PENGAJAR' && data.role !== 'PJ') {
    redirect(`/tugas/${id}`);
  }

  if (!data.isOwner) {
    redirect(`/tugas/${id}`);
  }

  return (
    <TaskEditForm
      assignment={data.assignment}
      availableGenerations={formData.availableGenerations}
      availableClasses={formData.availableClasses}
      availableStudents={formData.availableStudents}
      availableMaterials={formData.availableMaterials}
      availableTeachers={formData.availableTeachers}
    />
  );
}
