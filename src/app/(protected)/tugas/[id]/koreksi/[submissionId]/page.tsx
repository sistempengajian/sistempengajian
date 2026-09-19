import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSubmissionForGrading } from '@/app/(protected)/tugas/actions';
import StudentSubmissionGradingView from '@/components/tugas/detail/StudentSubmissionGradingView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  try {
    const { submissionId } = await params;
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        student: { select: { fullName: true } },
        assignment: { select: { title: true } },
      },
    });
    return {
      title: sub
        ? `Koreksi: ${sub.student.fullName} - ${sub.assignment.title} | Tugas Pengajian`
        : 'Koreksi Tugas Santri',
    };
  } catch {
    return {
      title: 'Koreksi Tugas Santri',
    };
  }
}

export default async function StudentGradingPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id, submissionId } = await params;

  let data: Awaited<ReturnType<typeof getSubmissionForGrading>>;
  try {
    data = await getSubmissionForGrading(id, submissionId);
  } catch (err) {
    notFound();
  }

  return <StudentSubmissionGradingView data={data} />;
}
