import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';
import { Gender, ParentRelationType, UserRole } from '@prisma/client';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\r') {
      // ignore
    } else if (char === '\n') {
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanPhone(phone: string | number | null | undefined): string | null {
  if (!phone) return null;
  let p = String(phone).trim();
  if (p.endsWith('.0')) {
    p = p.substring(0, p.length - 2);
  }
  p = p.replace(/[^0-9]/g, '');
  if (!p) return null;

  if (p.startsWith('620')) {
    p = '0' + p.substring(3);
  } else if (p.startsWith('62')) {
    p = '0' + p.substring(2);
  } else if (p.startsWith('8')) {
    p = '0' + p;
  }

  return p.length >= 9 ? p : null;
}

const MONTH_MAP: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9, oct: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11,
};

function parseDateIndo(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const parts = trimmed.split(/[\s-]+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthKey = parts[1].toLowerCase().replace(/[^a-z]/g, '');
    const year = parseInt(parts[2], 10);

    if (!isNaN(day) && !isNaN(year) && MONTH_MAP[monthKey] !== undefined) {
      const month = MONTH_MAP[monthKey];
      return new Date(Date.UTC(year, month, day));
    }
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function generateUsername(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${clean.substring(0, 15)}_${rand}`;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== ${isDryRun ? 'DRY-RUN (SIMULASI)' : 'EKSEKUSI SINKRONISASI'} DATA SANTRI & ORANG TUA ===\n`);

  const filePath = path.join(process.cwd(), 'data_santri_dan_orangtua.csv');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} tidak ditemukan!`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    console.log('File CSV kosong atau hanya berisi header.');
    return;
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = {
    idSantri: header.indexOf('id_santri'),
    namaSantri: header.indexOf('nama_lengkap_santri'),
    usernameSantri: header.indexOf('username_santri'),
    genderSantri: header.indexOf('jenis_kelamin'),
    tempatLahir: header.indexOf('tempat_lahir'),
    tanggalLahir: header.indexOf('tanggal_lahir'),
    kelompok: header.indexOf('kelompok'),
    generasi: header.indexOf('jenjang_generasi'),
    noHpSantri: header.indexOf('no_hp_santri'),
    emailSantri: header.indexOf('email_santri'),
    namaAyah: header.indexOf('nama_ayah'),
    noHpAyah: header.indexOf('no_hp_ayah'),
    emailAyah: header.indexOf('email_ayah'),
    namaIbu: header.indexOf('nama_ibu'),
    noHpIbu: header.indexOf('no_hp_ibu'),
    emailIbu: header.indexOf('email_ibu'),
    namaWali: header.indexOf('nama_wali'),
    noHpWali: header.indexOf('no_hp_wali'),
    hubunganWali: header.indexOf('hubungan_wali'),
  };

  const dataRows = rows.slice(1);
  console.log(`Total data baris dalam CSV: ${dataRows.length}`);

  // 1. Ambil data master
  const existingStudents = await prisma.user.findMany({
    where: { roles: { some: { role: UserRole.SANTRI } } },
    include: { organization: true, generation: true },
  });
  const studentById = new Map(existingStudents.map((s) => [s.id, s]));
  const studentByUsername = new Map(
    existingStudents.filter((s) => s.username).map((s) => [s.username!, s])
  );
  const studentByName = new Map(
    existingStudents.map((s) => [s.fullName.toLowerCase(), s])
  );

  const existingOrganizations = await prisma.organization.findMany();
  const orgByName = new Map(
    existingOrganizations.map((o) => [o.name.toLowerCase(), o])
  );

  const existingGenerations = await prisma.generation.findMany();
  const genByName = new Map(
    existingGenerations.map((g) => [g.name.toLowerCase(), g])
  );

  const existingParents = await prisma.user.findMany({
    where: { roles: { some: { role: UserRole.ORANG_TUA } } },
  });
  const parentByPhone = new Map<string, (typeof existingParents)[0]>();
  const parentByNameAndOrg = new Map<string, (typeof existingParents)[0]>();
  for (const p of existingParents) {
    if (p.phoneNumber) {
      const cp = cleanPhone(p.phoneNumber);
      if (cp) parentByPhone.set(cp, p);
    }
    if (p.organizationId) {
      parentByNameAndOrg.set(`${p.fullName.toLowerCase()}_${p.organizationId}`, p);
    }
  }

  const existingRelations = await prisma.studentParentRelation.findMany();
  const relationSet = new Set(
    existingRelations.map((r) => `${r.studentUserId}_${r.parentUserId}`)
  );

  let updatedStudents = 0;
  let createdStudents = 0;
  let createdParents = 0;
  let linkedRelations = 0;
  let skippedRows = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const idSantri = row[colIndex.idSantri]?.trim();
    const namaSantri = row[colIndex.namaSantri]?.trim();
    const usernameSantri = row[colIndex.usernameSantri]?.trim();
    const genderRaw = row[colIndex.genderSantri]?.trim();
    const genderVal: Gender =
      genderRaw?.toLowerCase().startsWith('p') ? Gender.FEMALE : Gender.MALE;
    const tempatLahir = colIndex.tempatLahir !== -1 ? row[colIndex.tempatLahir]?.trim() || null : null;
    const tanggalLahirRaw = colIndex.tanggalLahir !== -1 ? row[colIndex.tanggalLahir]?.trim() : null;
    const tanggalLahir = parseDateIndo(tanggalLahirRaw);

    const kelompokStr = row[colIndex.kelompok]?.trim();
    const generasiStr = row[colIndex.generasi]?.trim();
    const noHpSantri = cleanPhone(row[colIndex.noHpSantri]);
    const emailSantri = row[colIndex.emailSantri]?.trim().toLowerCase() || null;

    if (!namaSantri && !idSantri) {
      skippedRows++;
      continue;
    }

    // Lookup santri
    let student = idSantri ? studentById.get(idSantri) : undefined;
    if (!student && usernameSantri) student = studentByUsername.get(usernameSantri);
    if (!student && namaSantri) student = studentByName.get(namaSantri.toLowerCase());

    if (!student) {
      // Buat Santri Baru
      const targetOrg = kelompokStr ? orgByName.get(kelompokStr.toLowerCase()) : undefined;
      const targetGen = generasiStr ? genByName.get(generasiStr.toLowerCase()) : undefined;

      const newUsername = usernameSantri || generateUsername(namaSantri);

      if (isDryRun) {
        console.log(`[SIMULASI BUAT SANTRI BARU] ${namaSantri} (${generasiStr || '-'}, Org: ${kelompokStr || '-'}) Tempat: ${tempatLahir || '-'}, Tgl: ${tanggalLahir ? tanggalLahir.toISOString().split('T')[0] : '-'}`);
        student = {
          id: idSantri || `mock-student-${idx}`,
          fullName: namaSantri,
          username: newUsername,
          gender: genderVal,
          organizationId: targetOrg?.id || null,
          generationId: targetGen?.id || null,
        } as any;
        createdStudents++;
      } else {
        student = await prisma.user.create({
          data: {
            ...(idSantri && idSantri.length === 36 ? { id: idSantri } : {}),
            fullName: namaSantri,
            username: newUsername,
            gender: genderVal,
            birthPlace: tempatLahir,
            birthDate: tanggalLahir,
            phoneNumber: noHpSantri,
            email: emailSantri,
            organizationId: targetOrg?.id || null,
            generationId: targetGen?.id || null,
            roles: {
              create: [{ role: UserRole.SANTRI }],
            },
          },
          include: { organization: true, generation: true },
        });
        createdStudents++;
        studentById.set(student.id, student);
        console.log(`✓ [BUAT SANTRI BARU] ${namaSantri} (ID: ${student.id})`);
      }
    } else {
      // Perbarui Data Santri yang sudah ada jika ada perubahan (tempat/tanggal lahir/noHp/email)
      const needsUpdate =
        (tempatLahir && student.birthPlace !== tempatLahir) ||
        (tanggalLahir && (!student.birthDate || student.birthDate.getTime() !== tanggalLahir.getTime())) ||
        (noHpSantri && student.phoneNumber !== noHpSantri) ||
        (emailSantri && student.email !== emailSantri);

      if (needsUpdate) {
        if (isDryRun) {
          console.log(`[SIMULASI UPDATE SANTRI] ${student.fullName}: Tempat=${tempatLahir || student.birthPlace || '-'}, Tgl=${tanggalLahir ? tanggalLahir.toISOString().split('T')[0] : (student.birthDate ? student.birthDate.toISOString().split('T')[0] : '-')}, HP=${noHpSantri || student.phoneNumber || '-'}`);
          updatedStudents++;
        } else {
          student = await prisma.user.update({
            where: { id: student.id },
            data: {
              ...(tempatLahir ? { birthPlace: tempatLahir } : {}),
              ...(tanggalLahir ? { birthDate: tanggalLahir } : {}),
              ...(noHpSantri ? { phoneNumber: noHpSantri } : {}),
              ...(emailSantri ? { email: emailSantri } : {}),
            },
            include: { organization: true, generation: true },
          });
          studentById.set(student.id, student);
          updatedStudents++;
          console.log(`✓ [UPDATE SANTRI] ${student.fullName}`);
        }
      }
    }

    if (!student) continue;
    const orgId = student.organizationId;

    async function processParent(
      parentName: string | undefined,
      parentPhone: string | undefined,
      parentEmail: string | undefined,
      relType: ParentRelationType,
      gender: Gender
    ) {
      const cleanN = parentName?.trim();
      if (!cleanN) return;

      const cleanP = cleanPhone(parentPhone);
      const cleanE = parentEmail?.trim().toLowerCase() || null;

      let parent = cleanP ? parentByPhone.get(cleanP) : undefined;
      if (!parent && orgId) {
        parent = parentByNameAndOrg.get(`${cleanN.toLowerCase()}_${orgId}`);
      }

      if (!parent) {
        if (isDryRun) {
          console.log(`  [SIMULASI BUAT ORTU] ${relType}: ${cleanN} (HP: ${cleanP || '-'})`);
          createdParents++;
          parent = {
            id: `mock-parent-${cleanN}`,
            fullName: cleanN,
            phoneNumber: cleanP,
            email: cleanE,
            organizationId: orgId,
          } as any;
        } else {
          parent = await prisma.user.create({
            data: {
              fullName: cleanN,
              username: generateUsername(cleanN),
              phoneNumber: cleanP,
              email: cleanE,
              gender,
              organizationId: orgId,
              roles: {
                create: [{ role: UserRole.ORANG_TUA }],
              },
            },
          });
          createdParents++;
          if (cleanP) parentByPhone.set(cleanP, parent);
          if (orgId) parentByNameAndOrg.set(`${cleanN.toLowerCase()}_${orgId}`, parent);
          console.log(`  ✓ [BUAT ORTU] ${relType}: ${cleanN} (ID: ${parent.id}, HP: ${cleanP || '-'})`);
        }
      }

      if (parent && student) {
        const relKey = `${student.id}_${parent.id}`;
        if (!relationSet.has(relKey)) {
          if (isDryRun) {
            console.log(`  [SIMULASI TAUTKAN] ${student.fullName} <-> ${relType}: ${parent.fullName}`);
            linkedRelations++;
            relationSet.add(relKey);
          } else {
            await prisma.studentParentRelation.create({
              data: {
                studentUserId: student.id,
                parentUserId: parent.id,
                relationshipType: relType,
              },
            });
            linkedRelations++;
            relationSet.add(relKey);
            console.log(`  ✓ [TAUTKAN] ${student.fullName} <-> ${relType}: ${parent.fullName}`);
          }
        }
      }
    }

    // Ayah
    await processParent(
      row[colIndex.namaAyah],
      row[colIndex.noHpAyah],
      row[colIndex.emailAyah],
      ParentRelationType.AYAH,
      Gender.MALE
    );

    // Ibu
    await processParent(
      row[colIndex.namaIbu],
      row[colIndex.noHpIbu],
      row[colIndex.emailIbu],
      ParentRelationType.IBU,
      Gender.FEMALE
    );

    // Wali
    await processParent(
      row[colIndex.namaWali],
      row[colIndex.noHpWali],
      undefined,
      ParentRelationType.WALI,
      Gender.MALE
    );
  }

  console.log('\n=============================================');
  console.log('HASIL SINKRONISASI:');
  console.log(`Santri Baru Ditambahkan    : ${createdStudents}`);
  console.log(`Santri Diperbarui (Profil) : ${updatedStudents}`);
  console.log(`Orang Tua Baru Ditambahkan : ${createdParents}`);
  console.log(`Relasi Santri-Ortu Terhubung: ${linkedRelations}`);
  console.log(`Baris Dilewati             : ${skippedRows}`);
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
