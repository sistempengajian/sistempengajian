import { PrismaClient, OrganizationType, GenerationCode, UserRole, Gender, ParentRelationType, TierLevel } from '@prisma/client';
import { SEED_BADGES } from '../src/lib/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Memulai proses seeding data demo Sistem Pengajian...');

  // 1. Seed Badges
  console.log('🏅 Menambahkan badges penghargaan gamifikasi...');
  for (const badge of SEED_BADGES) {
    await prisma.badge.upsert({
      where: { codeName: badge.codeName },
      update: {},
      create: {
        codeName: badge.codeName,
        name: badge.name,
        category: badge.category,
        iconName: badge.iconName,
        criteriaDescription: badge.criteriaDescription,
        pointBonus: badge.pointBonus,
      },
    });
  }

  // 2. Seed Generations (4 Jenjang Usia Baku)
  console.log('📚 Menambahkan 4 jenjang generasi...');
  const caberawit = await prisma.generation.upsert({
    where: { code: GenerationCode.CABERAWIT },
    update: {},
    create: {
      code: GenerationCode.CABERAWIT,
      name: 'Caberawit',
      minAge: 4,
      maxAge: 12,
      description: 'Fondasi baca Al-Qur\'an, tajwid dasar, hafalan surat pendek, doa harian & adab.',
    },
  });

  const praRemaja = await prisma.generation.upsert({
    where: { code: GenerationCode.PRA_REMAJA },
    update: {},
    create: {
      code: GenerationCode.PRA_REMAJA,
      name: 'Pra-Remaja',
      minAge: 13,
      maxAge: 15,
      description: 'Fiqih thaharah/sholat khusyu, hafalan Juz \'Amma, aqidah, pembiasaan ibadah mandiri.',
    },
  });

  const remaja = await prisma.generation.upsert({
    where: { code: GenerationCode.REMAJA },
    update: {},
    create: {
      code: GenerationCode.REMAJA,
      name: 'Remaja',
      minAge: 16,
      maxAge: 18,
      description: 'Fiqih muamalah/munakahat, hadits pilihan, kepemimpinan, pemantapan karakter luhur.',
    },
  });

  await prisma.generation.upsert({
    where: { code: GenerationCode.MANDIRI },
    update: {},
    create: {
      code: GenerationCode.MANDIRI,
      name: 'Usia Mandiri',
      minAge: 19,
      maxAge: 35,
      description: 'Kajian tafsir & hadits besar, kemandirian hidup, pembekalan berkeluarga & manajemen dakwah.',
    },
  });

  // 3. Seed Hierarchy Organizations (Daerah > Desa > Kelompok)
  console.log('🏛️ Menambahkan hierarki organisasi wilayah...');
  // Daerah
  const daerah = await prisma.organization.create({
    data: {
      name: 'Daerah Jakarta Timur',
      type: OrganizationType.DAERAH,
    },
  });

  // Desas
  const desaDurenSawit = await prisma.organization.create({
    data: {
      name: 'Desa Duren Sawit',
      type: OrganizationType.DESA,
      parentId: daerah.id,
    },
  });

  const desaJatinegara = await prisma.organization.create({
    data: {
      name: 'Desa Jatinegara',
      type: OrganizationType.DESA,
      parentId: daerah.id,
    },
  });

  // Kelompoks under Desa Duren Sawit
  const kelompokKlender = await prisma.organization.create({
    data: {
      name: 'Kelompok Klender Barat (Masjid Baitul Makmur)',
      type: OrganizationType.KELOMPOK,
      parentId: desaDurenSawit.id,
    },
  });

  const kelompokPondokBambu = await prisma.organization.create({
    data: {
      name: 'Kelompok Pondok Bambu (Masjid Al-Ikhlas)',
      type: OrganizationType.KELOMPOK,
      parentId: desaDurenSawit.id,
    },
  });

  // Kelompoks under Desa Jatinegara
  await prisma.organization.create({
    data: {
      name: 'Kelompok Bidara Cina',
      type: OrganizationType.KELOMPOK,
      parentId: desaJatinegara.id,
    },
  });

  // 4. Seed Users across Roles
  console.log('👥 Menambahkan akun pengguna demo untuk setiap peran...');

  // Admin Master
  await prisma.user.create({
    data: {
      email: 'admin@pengajian.app',
      username: 'admin_master',
      fullName: 'Administrator Sistem Pusat',
      phoneNumber: '081100000001',
      gender: Gender.MALE,
      organizationId: daerah.id,
      roles: {
        create: [{ role: UserRole.ADMIN_MASTER }],
      },
    },
  });

  // PJ Daerah
  await prisma.user.create({
    data: {
      email: 'pj.daerah@pengajian.app',
      username: 'ustadz_mansur',
      fullName: 'Drs. H. Mansur Al-Bantani (PJ Daerah)',
      phoneNumber: '081211112222',
      gender: Gender.MALE,
      organizationId: daerah.id,
      roles: {
        create: [{ role: UserRole.PJ_DAERAH }, { role: UserRole.PENGAJAR }],
      },
    },
  });

  // PJ Desa
  await prisma.user.create({
    data: {
      email: 'pj.desa@pengajian.app',
      username: 'ustadz_ridwan',
      fullName: 'Ustadz Ridwan Hakim S.Pd.I (PJ Desa)',
      phoneNumber: '081233334444',
      gender: Gender.MALE,
      organizationId: desaDurenSawit.id,
      roles: {
        create: [{ role: UserRole.PJ_DESA }, { role: UserRole.PENGAJAR }],
      },
    },
  });

  // PJ Kelompok & Pengajar
  const ustadzAbdullah = await prisma.user.create({
    data: {
      email: 'pj.kelompok@pengajian.app',
      username: 'ustadz_abdullah',
      fullName: 'Ustadz Abdullah S.Pd.I (PJ Kelompok)',
      phoneNumber: '081255556666',
      gender: Gender.MALE,
      organizationId: kelompokKlender.id,
      roles: {
        create: [{ role: UserRole.PJ_KELOMPOK }, { role: UserRole.PENGAJAR }],
      },
    },
  });

  // Wali Kelas
  const ustadzahKhadijah = await prisma.user.create({
    data: {
      email: 'walikelas@pengajian.app',
      username: 'ustadzah_khadijah',
      fullName: 'Ustadzah Khadijah Al-Munawwarah',
      phoneNumber: '081277778888',
      gender: Gender.FEMALE,
      organizationId: kelompokKlender.id,
      roles: {
        create: [{ role: UserRole.WALI_KELAS }, { role: UserRole.PENGAJAR }],
      },
    },
  });

  // Orang Tua 1 (Ayah) & 2 (Ibu)
  const bapakAhmad = await prisma.user.create({
    data: {
      email: 'ayah.ahmad@gmail.com',
      username: 'bapak_ahmad',
      fullName: 'H. Ahmad Syukron',
      phoneNumber: '081299990001',
      gender: Gender.MALE,
      organizationId: kelompokKlender.id,
      roles: {
        create: [{ role: UserRole.ORANG_TUA }],
      },
    },
  });

  const ibuFatimah = await prisma.user.create({
    data: {
      email: 'ibu.fatimah@gmail.com',
      username: 'ibu_fatimah',
      fullName: 'Hj. Siti Fatimah',
      phoneNumber: '081299990002',
      gender: Gender.FEMALE,
      organizationId: kelompokKlender.id,
      roles: {
        create: [{ role: UserRole.ORANG_TUA }],
      },
    },
  });

  // Santri 1: Farhan Fauzi (Caberawit)
  const farhan = await prisma.user.create({
    data: {
      email: 'santri.farhan@pengajian.app',
      username: 'farhan_fauzi',
      fullName: 'Muhammad Farhan Fauzi',
      phoneNumber: '081299990003',
      gender: Gender.MALE,
      organizationId: kelompokKlender.id,
      generationId: caberawit.id,
      roles: {
        create: [{ role: UserRole.SANTRI }],
      },
      gamification: {
        create: {
          totalPoints: 1250,
          currentStreakDays: 25,
          highestStreakDays: 28,
          level: 4,
        },
      },
    },
  });

  // Santri 2: Aisyah Salsabila (Pra-Remaja)
  const aisyah = await prisma.user.create({
    data: {
      email: 'santri.aisyah@pengajian.app',
      username: 'aisyah_salsabila',
      fullName: 'Aisyah Salsabila Syukron',
      phoneNumber: '081299990004',
      gender: Gender.FEMALE,
      organizationId: kelompokKlender.id,
      generationId: praRemaja.id,
      roles: {
        create: [{ role: UserRole.SANTRI }],
      },
      gamification: {
        create: {
          totalPoints: 980,
          currentStreakDays: 14,
          highestStreakDays: 20,
          level: 3,
        },
      },
    },
  });

  // Santri 3: Zaid Umar (Remaja)
  await prisma.user.create({
    data: {
      email: 'santri.zaid@pengajian.app',
      username: 'zaid_umar',
      fullName: 'Zaid Umar Al-Khattab',
      phoneNumber: '081299990005',
      gender: Gender.MALE,
      organizationId: kelompokKlender.id,
      generationId: remaja.id,
      roles: {
        create: [{ role: UserRole.SANTRI }],
      },
      gamification: {
        create: {
          totalPoints: 920,
          currentStreakDays: 10,
          highestStreakDays: 15,
          level: 3,
        },
      },
    },
  });

  // 5. Tautkan Akun Multi-Anak Orang Tua (Student Parent Relations)
  console.log('👨‍👩‍👧 Menautkan relasi orang tua ke multi-anak...');
  await prisma.studentParentRelation.createMany({
    data: [
      {
        studentUserId: farhan.id,
        parentUserId: bapakAhmad.id,
        relationshipType: ParentRelationType.AYAH,
      },
      {
        studentUserId: farhan.id,
        parentUserId: ibuFatimah.id,
        relationshipType: ParentRelationType.IBU,
      },
      {
        studentUserId: aisyah.id,
        parentUserId: bapakAhmad.id,
        relationshipType: ParentRelationType.AYAH,
      },
      {
        studentUserId: aisyah.id,
        parentUserId: ibuFatimah.id,
        relationshipType: ParentRelationType.IBU,
      },
    ],
  });

  // 6. Seed Demo Classes
  console.log('🏫 Menambahkan kelas pengajian berjenjang...');
  await prisma.class.create({
    data: {
      name: 'Kelas Caberawit Aisyah (Kelompok Klender)',
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompokKlender.id,
      generationId: caberawit.id,
      homeroomTeacherId: ustadzahKhadijah.id,
      academicYear: '2026/2027',
    },
  });

  await prisma.class.create({
    data: {
      name: 'Kelas Pra-Remaja Bilal (Kelompok Klender)',
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompokKlender.id,
      generationId: praRemaja.id,
      homeroomTeacherId: ustadzAbdullah.id,
      academicYear: '2026/2027',
    },
  });

  // 7. Provision Supabase Auth Users
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('127.0.0.1')) {
    console.log('🔐 Menyinkronkan akun demo ke Supabase Auth (auth.users)...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const allUsers = await prisma.user.findMany();
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
    const existingEmails = new Set(authList?.users.map((u) => u.email?.toLowerCase()) || []);

    for (const u of allUsers) {
      if (!u.email) continue;
      if (!existingEmails.has(u.email.toLowerCase())) {
        await supabaseAdmin.auth.admin.createUser({
          id: u.id,
          email: u.email,
          password: 'DemoPassword2026!',
          email_confirm: true,
          user_metadata: {
            full_name: u.fullName,
            username: u.username,
          },
        });
      }
    }
    console.log('✅ Akun demo berhasil disinkronkan ke Supabase Auth!');
  }

  console.log('✅ Seeding data demo berhasil selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
