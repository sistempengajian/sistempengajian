import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import ProfileClientView, { UserProfileData } from '@/components/profil/ProfileClientView';

export const metadata: Metadata = {
  title: 'Profil Pengguna | Sistem Pengajian',
  description: 'Halaman profil pengguna, capaian, dan pengaturan akun Sistem Pengajian Generasi Qurani.',
};

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      generation: {
        select: {
          id: true,
          code: true,
          name: true,
          color: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          parent: {
            select: {
              id: true,
              name: true,
              type: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      },
      roles: {
        select: { role: true },
      },
      gamification: {
        select: {
          level: true,
          totalPoints: true,
          currentStreakDays: true,
          highestStreakDays: true,
        },
      },
      badges: {
        select: {
          id: true,
        },
      },
      parents: {
        select: {
          relationshipType: true,
          parent: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      },
      children: {
        select: {
          student: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              generation: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
      homeroomClasses: {
        select: {
          id: true,
          name: true,
          academicYear: true,
        },
      },
    },
  });

  if (!dbUser) {
    redirect('/login');
  }

  const profileData: UserProfileData = {
    id: dbUser.id,
    fullName: dbUser.fullName,
    username: dbUser.username,
    email: dbUser.email,
    phoneNumber: dbUser.phoneNumber,
    gender: dbUser.gender,
    birthPlace: dbUser.birthPlace,
    birthDate: dbUser.birthDate,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    generation: dbUser.generation,
    organization: dbUser.organization,
    roles: dbUser.roles.map((r) => ({ role: String(r.role) })),
    gamification: dbUser.gamification
      ? {
          level: dbUser.gamification.level,
          totalPoints: dbUser.gamification.totalPoints,
          currentStreakDays: dbUser.gamification.currentStreakDays,
          highestStreakDays: dbUser.gamification.highestStreakDays,
        }
      : null,
    badgesCount: dbUser.badges.length,
    parents: dbUser.parents.map((p) => ({
      relationshipType: p.relationshipType,
      parent: {
        id: p.parent.id,
        fullName: p.parent.fullName,
        phoneNumber: p.parent.phoneNumber,
        email: p.parent.email,
      },
    })),
    children: dbUser.children.map((c) => ({
      student: {
        id: c.student.id,
        fullName: c.student.fullName,
        phoneNumber: c.student.phoneNumber,
        generation: c.student.generation,
      },
    })),
    homeroomClasses: dbUser.homeroomClasses.map((cl) => ({
      id: cl.id,
      name: cl.name,
      academicYear: cl.academicYear,
    })),
  };

  return <ProfileClientView user={profileData} />;
}
