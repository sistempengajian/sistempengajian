import React from 'react';
import { redirect } from 'next/navigation';
import { getAssignmentFormData } from '../actions';
import TaskCreateForm from '@/components/tugas/form/TaskCreateForm';

export const metadata = {
  title: 'Buat & Terbitkan Tugas Baru | Sistem Pengajian',
  description: 'Formulir pembuatan penugasan pasca-pengajian terstruktur untuk santri.',
};

export default async function TugasBuatPage() {
  let formData: Awaited<ReturnType<typeof getAssignmentFormData>>;
  try {
    formData = await getAssignmentFormData();
  } catch {
    redirect('/tugas');
  }

  return (
    <TaskCreateForm
      availableGenerations={formData.availableGenerations}
      availableClasses={formData.availableClasses}
      availableStudents={formData.availableStudents}
      availableMaterials={formData.availableMaterials}
      availableTeachers={formData.availableTeachers}
    />
  );
}
