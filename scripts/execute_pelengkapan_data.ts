import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';
import { Gender, ParentRelationType, UserRole } from '@prisma/client';

function generateUsername(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${clean.substring(0, 15)}_${rand}`;
}

async function getOrCreateParent(name: string, phone: string, gender: Gender, orgId: string) {
  let parent = await prisma.user.findFirst({
    where: {
      fullName: { equals: name, mode: 'insensitive' },
      phoneNumber: phone,
      roles: { some: { role: UserRole.ORANG_TUA } },
    },
  });

  if (!parent) {
    // Check by phone
    parent = await prisma.user.findFirst({
      where: {
        phoneNumber: phone,
        fullName: { equals: name, mode: 'insensitive' },
      },
    });
  }

  if (!parent) {
    let username = generateUsername(name);
    // ensure unique username
    while (await prisma.user.findUnique({ where: { username } })) {
      username = generateUsername(name);
    }

    parent = await prisma.user.create({
      data: {
        fullName: name,
        username,
        phoneNumber: phone,
        gender,
        organizationId: orgId,
        roles: {
          create: [{ role: UserRole.ORANG_TUA }],
        },
      },
    });
    console.log(`[CREATE PARENT] Created ${name} (${gender}, HP: ${phone}) ID: ${parent.id}`);
  } else {
    console.log(`[EXISTING PARENT] Found ${parent.fullName} (ID: ${parent.id})`);
  }

  return parent;
}

async function linkStudentParent(studentId: string, parentId: string, relationType: ParentRelationType) {
  const existing = await prisma.studentParentRelation.findUnique({
    where: {
      studentUserId_parentUserId: {
        studentUserId: studentId,
        parentUserId: parentId,
      },
    },
  });

  if (!existing) {
    await prisma.studentParentRelation.create({
      data: {
        studentUserId: studentId,
        parentUserId: parentId,
        relationshipType: relationType,
      },
    });
    console.log(`  -> Linked student ${studentId} to parent ${parentId} (${relationType})`);
  } else {
    if (existing.relationshipType !== relationType) {
      await prisma.studentParentRelation.update({
        where: { id: existing.id },
        data: { relationshipType: relationType },
      });
      console.log(`  -> Updated relation type for student ${studentId} to parent ${parentId} -> ${relationType}`);
    } else {
      console.log(`  -> Relation already exists (${relationType})`);
    }
  }
}

async function main() {
  console.log('=== MULAI EKSEKUSI PELENGKAPAN DATA SANTRI & ORANG TUA ===\n');

  const org = await prisma.organization.findFirst({ where: { name: 'Ujungrusi' } });
  if (!org) throw new Error('Organisasi Ujungrusi tidak ditemukan!');
  const orgId = org.id;

  const genCaberawitE = await prisma.generation.findFirst({ where: { name: 'Caberawit E' } });
  if (!genCaberawitE) throw new Error('Generasi Caberawit E tidak ditemukan!');

  const genCaberawitB = await prisma.generation.findFirst({ where: { name: 'Caberawit B' } });
  if (!genCaberawitB) throw new Error('Generasi Caberawit B tidak ditemukan!');

  // 1. KASUS PAK RUDI (Aisyah & Dika)
  console.log('1. Memproses Pak Rudi (Aisyah & Dika)...');
  const parentRudi = await getOrCreateParent('Rudi', '0895401105090', Gender.MALE, orgId);

  // Update gender Aisyah -> FEMALE
  const aisyahId = '40315c87-2f72-4faa-a55c-a89b46a40d7a';
  await prisma.user.update({
    where: { id: aisyahId },
    data: { gender: Gender.FEMALE },
  });
  console.log('  -> Gender Aisyah Dika Salsabila diperbarui menjadi FEMALE');
  await linkStudentParent(aisyahId, parentRudi.id, ParentRelationType.AYAH);

  const dikaId = 'b0c285d8-04cd-4a97-85ad-649d565d1f8f'; // Muhammad Rizki Fauzan Dika Ramadhan
  await linkStudentParent(dikaId, parentRudi.id, ParentRelationType.AYAH);

  // 2. KASUS PAK WAHYU (Humairo Nur Musyafa'ah)
  console.log('\n2. Memproses Pak Wahyu (Humairo Nur Musyafa\'ah)...');
  const wahyuId = '40da122f-f2ff-4c4f-b1b4-26d052f8bee8'; // Existing Wahyu
  const humairoId = '920a6641-8707-483e-a646-e3280aadc1fc';
  await linkStudentParent(humairoId, wahyuId, ParentRelationType.AYAH);

  // 3. KASUS BU ENDANG (Zian & Icha)
  console.log('\n3. Memproses Bu Endang (Zian & Icha)...');
  const parentEndang = await getOrCreateParent('Endang', '085786762575', Gender.FEMALE, orgId);
  const zianId = '25da8566-0a54-4ee2-a23b-73ecb89a77cd'; // Muhammad Zian Zidan Aqila
  const ichaId = '9aa781ae-21bc-4dcd-af6a-bc706add733e'; // Icha
  await linkStudentParent(zianId, parentEndang.id, ParentRelationType.IBU);
  await linkStudentParent(ichaId, parentEndang.id, ParentRelationType.IBU);

  // 4. KASUS BU FATMAH (Dienka)
  console.log('\n4. Memproses Bu Fatmah (Dienka)...');
  const parentFatmah = await getOrCreateParent('Fatmah', '08976245353', Gender.FEMALE, orgId);
  const dienkaId = 'cfeb5334-4e46-4c5b-b36e-81b2abad9944'; // Dienka Arfa Elfrina
  await linkStudentParent(dienkaId, parentFatmah.id, ParentRelationType.IBU);

  // 5. KASUS BU NINA (Fayza)
  console.log('\n5. Memproses Bu Nina (Fayza)...');
  const parentNinaFayza = await getOrCreateParent('Nina', '0895324139584', Gender.FEMALE, orgId);
  const fayzaId = '469ba1e8-20da-4023-8b58-71fa74e56794'; // Fayza Noor Zaina Buchori
  await linkStudentParent(fayzaId, parentNinaFayza.id, ParentRelationType.IBU);

  // 6. KASUS BU SEFTA (Kaisan)
  console.log('\n6. Memproses Bu Sefta (Kaisan)...');
  const seftaId = '8dfbc678-9b4a-4679-aef1-a3af74ec4226'; // Existing Sefta
  const kaysanId = '2c58282d-52fb-4c09-aa4f-b39cd51f04a9'; // Muhammad Kaysan Virendra Arsakha
  await linkStudentParent(kaysanId, seftaId, ParentRelationType.IBU);

  // 7. KASUS BU TATA (Rangin & Kiya)
  console.log('\n7. Memproses Bu Tata (Rangin & Kiya)...');
  const parentTata = await getOrCreateParent('Tata', '082242686363', Gender.FEMALE, orgId);
  const ranginId = '95f46ddf-8775-4e94-a815-be5593e6fa3b'; // Rangin
  const kiyaId = '0664066a-fa78-450b-a489-8ad4f9956948'; // Qiya Gita Malikha
  await linkStudentParent(ranginId, parentTata.id, ParentRelationType.IBU);
  await linkStudentParent(kiyaId, parentTata.id, ParentRelationType.IBU);

  // 8. KASUS PAK BOWO (Nabil, Alya, Rifqi)
  console.log('\n8. Memproses Pak Bowo (Nabil, Alya, Rifqi)...');
  const parentBowo = await getOrCreateParent('Bowo', '085750401795', Gender.MALE, orgId);
  const alyaId = '3215ef58-46e8-4136-ae69-dc5fde7c7cb2'; // Alya
  const rifqyId = 'b451bc81-37a8-490a-92a9-5a821012a727'; // Muhammad Rifqy Hafizhan Algifari
  await linkStudentParent(alyaId, parentBowo.id, ParentRelationType.AYAH);
  await linkStudentParent(rifqyId, parentBowo.id, ParentRelationType.AYAH);

  // Buat santri Nabil jika belum ada
  let nabil = await prisma.user.findFirst({
    where: {
      fullName: { equals: 'Nabil', mode: 'insensitive' },
      generationId: genCaberawitE.id,
      roles: { some: { role: UserRole.SANTRI } },
    },
  });
  if (!nabil) {
    let uname = 'nabil';
    if (await prisma.user.findUnique({ where: { username: uname } })) {
      uname = generateUsername('nabil');
    }
    nabil = await prisma.user.create({
      data: {
        fullName: 'Nabil',
        username: uname,
        gender: Gender.FEMALE,
        organizationId: orgId,
        generationId: genCaberawitE.id,
        roles: { create: [{ role: UserRole.SANTRI }] },
      },
    });
    console.log(`  -> Santri baru NABIL berhasil dibuat (ID: ${nabil.id}, Caberawit E, FEMALE)`);
  } else {
    console.log(`  -> Santri NABIL sudah ada (ID: ${nabil.id})`);
  }
  await linkStudentParent(nabil.id, parentBowo.id, ParentRelationType.AYAH);

  // 9. KASUS BU AMI (Huma)
  console.log('\n9. Memproses Bu Ami (Huma)...');
  const parentAmi = await getOrCreateParent('Ami', '085722611497', Gender.FEMALE, orgId);
  const humaId = '1eb338fb-0dc0-4864-ab01-afab9437b2c4'; // Huma
  await linkStudentParent(humaId, parentAmi.id, ParentRelationType.IBU);

  // 10. KASUS BU JIHAN (Umar)
  console.log('\n10. Memproses Bu Jihan (Umar)...');
  const parentJihan = await getOrCreateParent('Jihan', '085647373915', Gender.FEMALE, orgId);
  const umarId = 'dec136cf-a91a-4558-86c9-5b249c704d2c'; // Umar
  await linkStudentParent(umarId, parentJihan.id, ParentRelationType.IBU);

  // 11. KASUS BU NINA (Gia)
  console.log('\n11. Memproses Bu Nina (Gia)...');
  const parentNinaGia = await getOrCreateParent('Nina', '087731290263', Gender.FEMALE, orgId);

  // Buat santri Gia jika belum ada
  let gia = await prisma.user.findFirst({
    where: {
      fullName: { equals: 'Gia', mode: 'insensitive' },
      generationId: genCaberawitB.id,
      roles: { some: { role: UserRole.SANTRI } },
    },
  });
  if (!gia) {
    let uname = 'gia';
    if (await prisma.user.findUnique({ where: { username: uname } })) {
      uname = generateUsername('gia');
    }
    gia = await prisma.user.create({
      data: {
        fullName: 'Gia',
        username: uname,
        gender: Gender.FEMALE,
        organizationId: orgId,
        generationId: genCaberawitB.id,
        roles: { create: [{ role: UserRole.SANTRI }] },
      },
    });
    console.log(`  -> Santri baru GIA berhasil dibuat (ID: ${gia.id}, Caberawit B, FEMALE)`);
  } else {
    console.log(`  -> Santri GIA sudah ada (ID: ${gia.id})`);
  }
  await linkStudentParent(gia.id, parentNinaGia.id, ParentRelationType.IBU);

  console.log('\n=== SELESAI UPDATE DATABASE ===\n');

  return { nabilId: nabil.id, giaId: gia.id, nabilUsername: nabil.username, giaUsername: gia.username };
}

main()
  .then((res) => {
    console.log('Hasil ID santri baru:', JSON.stringify(res));
  })
  .catch((err) => {
    console.error('Error saat eksekusi:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
