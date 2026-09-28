/**
 * Definisi Kategori dan Kata Kunci Pengarah Kurikulum
 * Mengacu pada standar kurikulum pembelajaran (Teks Eksak Kolom G).
 */

export interface CurriculumCategoryDefinition {
  category: string;
  color: string;
  keywords: string[];
}

export const CURRICULUM_CATEGORIES: Record<string, CurriculumCategoryDefinition> = {
  'Hadits & Sunnah': {
    category: 'Hadits & Sunnah',
    color: '#3B82F6',
    keywords: [
      'hadis / hadits / Al-Hadits / Al-Hadis',
      "dalil-dalil / dalil syar'i / hafalan dalil",
      'manqul',
      'musnad',
      'muttasil / muttashil',
      'sanad / bersanad',
      "kitab hadits (Kitabul Kanzil Ummal, Kitabu Janaiz, Kitabud Da'awat, Kitabu Ahkam, Sunan Ibnu Majah, Kitabus Sholah, Kitabul Adab, Kitabu Manasik Wa Jihad)",
      'Sunnah / hadis masnunah',
    ],
  },
  'Doa & Dzikir Harian': {
    category: 'Doa & Dzikir Harian',
    color: '#F59E0B',
    keywords: [
      "Asmaul Husna / Asma'ul Husna (nomor 1 s.d. 99)",
      "doa-doa harian / do'a-do'a harian",
      "doa / do'a (sebelum & sesudah wudhu, masuk/keluar masjid, sebelum/bangun tidur)",
      "doa masnunah / ma'tsur",
      'doa syukur',
      'melafalkan / menghafal doa',
      'mempraktikkan doa dalam aktivitas keseharian',
    ],
  },
  'Fiqih & Ibadah': {
    category: 'Fiqih & Ibadah',
    color: '#8B5CF6',
    keywords: [
      'thaharah / thoharoh / sesuci / kesucian / suci & najis',
      'wudhu',
      'mandi junub / janabah / hadats besar',
      'sholat / shalat (sholat fardhu, sholat sunnah Rawatib, Dhuha, Tahajjud)',
      'puasa (puasa Ramadhan / Romadhon, puasa sunnah, fadhilah puasa)',
      "mahram / mahrom (pembagian kategori mahram, implikasi pergaulan syar'i)",
      'aurat / aurot (menjaga dan menutup aurat sesuai syariat)',
      "dihalalkan / diharamkan (halal & haram, distingsi syar'i)",
      'surga & neraka (ketaatan berbuah surga, maksiat berujung neraka, dosa besar)',
      "faham jama'ah (tahapan perjuangan, 4 pilar syarat keberhasilan, amrin jami')",
      "6 Thobi'at Luhur (jujur, amanah, mujhid muzhid, rukun, kompak, kerjasama yang baik)",
      'adab / tatakrama (bertamu, berpakaian, makan, tidur, menguap, bersin, bergaul, menuntut ilmu, berumah tangga, bermasyarakat, lingkungan kerja)',
      "birrul walidain / berbuat baik kepada kedua orang tua (taat, ta'dhim/takzim, bersyukur, tawaduk, rida, balas budi)",
      'zakat / haji / jenazah / takziah (melayat, empati duka cita)',
    ],
  },
  'Pegon & Literasi': {
    category: 'Pegon & Literasi',
    color: '#EC4899',
    keywords: [
      'Arab Pegon / tulisan Pegon / menulis Pegon (baku dan biasa)',
      'menulis huruf Arab / huruf tunggal hijaiyyah / rangkaian kata / angka Arab',
      'kitab manqul (kelengkapan kitab manqul secara tertib)',
      'PR 13 / PR / pembacaan materi PR',
      'pembacaan / literasi materi taklim',
      'sarana pembelajaran / buku / ruang kelas',
    ],
  },
  "Al-Qur'an & Tahfidz": {
    category: "Al-Qur'an & Tahfidz",
    color: '#10B981',
    keywords: [
      "Al-Qur'an / Al-Qur'anul Karim / ayat suci Al-Qur'an",
      'tartil / membaca tartil / fasih',
      "tajwid (Qolqolah, Iqlab, Idzhar, Idgham Bighunnah/Bilaghunnah, tanda waqaf, Mad, isti'adzah, basmalah)",
      "hafalan surat / hafalan surat-surat Al-Qur'an / surat-surat pendek Juz 30 (An-Nas s.d. An-Naba')",
      "muraja'ah / muroja'ah / mutqin",
      "surat (An-Nas, Al-Falaq, Al-Ikhlas, Al-Baqarah, An-Nisa, Al-Isra', Al-A'raf, Yasin, dll)",
      "tilawati / baca huruf Al-Qur'an / makharijul huruf / huruf ber-sukun",
      "makna Al-Qur'an / tafsir / mengkaji dan memaknai",
    ],
  },
};

/**
 * Mengelompokkan materi ke dalam 5 Bidang Materi Kurikulum berdasarkan kata kunci spesifik
 * pada butir checklist (itemTitle) dan judul materi induk (materialTitle).
 */
export function classifyCurriculumCategory(
  itemTitle: string = '',
  materialTitle: string = '',
  itemDescription: string = '',
  materialDescription: string = ''
): string {
  const matchCategory = (text: string): string | null => {
    if (!text) return null;
    const lower = text.toLowerCase();

    // 1. Kelompok Pegon & Literasi:
    // - Arab Pegon / tulisan Pegon / menulis Pegon (baku dan biasa)
    // - menulis huruf Arab / huruf tunggal hijaiyyah / rangkaian kata / angka Arab
    // - kitab manqul (kelengkapan kitab manqul secara tertib)
    // - PR 13 / PR / pembacaan materi PR
    // - pembacaan / literasi materi taklim
    // - sarana pembelajaran / buku / ruang kelas
    if (
      lower.includes('arab pegon') ||
      lower.includes('tulisan pegon') ||
      lower.includes('menulis pegon') ||
      lower.includes('pegon') ||
      lower.includes('menulis huruf arab') ||
      lower.includes('huruf tunggal hijaiyyah') ||
      lower.includes('huruf tunggal hijaiyah') ||
      lower.includes('rangkaian kata') ||
      lower.includes('angka arab') ||
      lower.includes('menulis arab') ||
      lower.includes('huruf arab') ||
      lower.includes('khot') ||
      lower.includes('tulis') ||
      lower.includes('menulis') ||
      lower.includes('kitab manqul') ||
      lower.includes('kelengkapan kitab manqul') ||
      lower.includes('pr 13') ||
      lower.includes('pr13') ||
      lower.includes('pr-13') ||
      /\bpr\b/i.test(text) ||
      lower.includes('pembacaan materi pr') ||
      lower.includes('materi pr') ||
      lower.includes('literasi materi taklim') ||
      lower.includes('pembacaan materi taklim') ||
      lower.includes('materi taklim') ||
      lower.includes('literasi') ||
      lower.includes('pembacaan') ||
      lower.includes('sarana pembelajaran') ||
      lower.includes('ruang kelas') ||
      lower.includes('buku')
    ) {
      return 'Pegon & Literasi';
    }

    // 2. Kelompok Doa & Dzikir Harian:
    // - Asmaul Husna / Asma'ul Husna (nomor 1 s.d. 99)
    // - doa-doa harian / do'a-do'a harian
    // - doa / do'a (sebelum & sesudah wudhu, masuk/keluar masjid, sebelum/bangun tidur)
    // - doa masnunah / ma'tsur
    // - doa syukur
    // - melafalkan / menghafal doa
    // - mempraktikkan doa dalam aktivitas keseharian
    if (
      lower.includes('asmaul husna') ||
      lower.includes("asma'ul husna") ||
      lower.includes('asmaulhusna') ||
      lower.includes('doa-doa harian') ||
      lower.includes("do'a-do'a harian") ||
      lower.includes('doa harian') ||
      lower.includes("do'a harian") ||
      lower.includes('doa-doa') ||
      lower.includes("do'a-do'a") ||
      lower.includes('doa') ||
      lower.includes("do'a") ||
      lower.includes('dzikir') ||
      lower.includes('dhikr') ||
      lower.includes('wirid') ||
      lower.includes('sebelum & sesudah wudhu') ||
      lower.includes('sebelum dan sesudah wudhu') ||
      lower.includes('masuk/keluar masjid') ||
      lower.includes('masuk masjid') ||
      lower.includes('keluar masjid') ||
      lower.includes('sebelum/bangun tidur') ||
      lower.includes('sebelum tidur') ||
      lower.includes('bangun tidur') ||
      lower.includes('doa masnunah') ||
      lower.includes("ma'tsur") ||
      lower.includes('matsur') ||
      lower.includes('doa syukur') ||
      lower.includes('melafalkan doa') ||
      lower.includes('menghafal doa') ||
      lower.includes('hafalan doa') ||
      lower.includes('mempraktikkan doa') ||
      lower.includes('aktivitas keseharian')
    ) {
      return 'Doa & Dzikir Harian';
    }

    // 3. Kelompok Hadits & Sunnah:
    // - hadis / hadits / Al-Hadits / Al-Hadis
    // - dalil-dalil / dalil syar'i / hafalan dalil
    // - manqul
    // - musnad
    // - muttasil / muttashil
    // - sanad / bersanad
    // - kitab hadits (Kitabul Kanzil Ummal, Kitabu Janaiz, Kitabud Da'awat, Kitabu Ahkam, Sunan Ibnu Majah, Kitabus Sholah, Kitabul Adab, Kitabu Manasik Wa Jihad)
    // - Sunnah / hadis masnunah
    // - 5 Bab / 4 Tali Keimanan / QHJ / Beribadah
    if (
      lower.includes('hadis') ||
      lower.includes('hadits') ||
      lower.includes('hadist') ||
      lower.includes('al-hadits') ||
      lower.includes('al-hadis') ||
      lower.includes('dalil-dalil') ||
      lower.includes("dalil syar'i") ||
      lower.includes('dalil syari') ||
      lower.includes('hafalan dalil') ||
      lower.includes('dalil') ||
      lower.includes('manqul') ||
      lower.includes('musnad') ||
      lower.includes('muttasil') ||
      lower.includes('muttashil') ||
      lower.includes('sanad') ||
      lower.includes('bersanad') ||
      lower.includes('kitab hadits') ||
      lower.includes('kitab hadis') ||
      lower.includes('kanzil ummal') ||
      lower.includes('kitabul kanzil ummal') ||
      lower.includes('kitabu janaiz') ||
      lower.includes('janaiz') ||
      lower.includes("kitabud da'awat") ||
      lower.includes('kitabud daawat') ||
      lower.includes("da'awat") ||
      lower.includes('kitabu ahkam') ||
      lower.includes('sunan ibnu majah') ||
      lower.includes('ibnu majah') ||
      lower.includes('kitabus sholah') ||
      lower.includes('kitabul adab') ||
      lower.includes('kitabu manasik') ||
      lower.includes('manasik wa jihad') ||
      lower.includes('hadis masnunah') ||
      lower.includes('hadits masnunah') ||
      lower.includes('sunnah') ||
      lower.includes('5 bab') ||
      lower.includes('4 tali keimanan') ||
      lower.includes('qhj') ||
      lower.includes("qur'an hadist jama'ah") ||
      lower.includes("qur'an hadits jama'ah") ||
      lower.includes('beribadah') ||
      lower.includes('bukhari') ||
      lower.includes('muslim') ||
      lower.includes('arbain') ||
      lower.includes('sunan')
    ) {
      return 'Hadits & Sunnah';
    }

    // 4. Kelompok Fiqih & Ibadah:
    // - thaharah / thoharoh / sesuci / kesucian / suci & najis
    // - wudhu
    // - mandi junub / janabah / hadats besar
    // - sholat / shalat (sholat fardhu, sholat sunnah Rawatib, Dhuha, Tahajjud)
    // - puasa (puasa Ramadhan / Romadhon, puasa sunnah, fadhilah puasa)
    // - mahram / mahrom (pembagian kategori mahram, implikasi pergaulan syar'i)
    // - aurat / aurot (menjaga dan menutup aurat sesuai syariat)
    // - dihalalkan / diharamkan (halal & haram, distingsi syar'i)
    // - surga & neraka (ketaatan berbuah surga, maksiat berujung neraka, dosa besar)
    // - faham jama'ah (tahapan perjuangan, 4 pilar syarat keberhasilan, amrin jami')
    // - 6 Thobi'at Luhur (jujur, amanah, mujhid muzhid, rukun, kompak, kerjasama yang baik)
    // - adab / tatakrama (bertamu, berpakaian, makan, tidur, menguap, bersin, bergaul, menuntut ilmu, berumah tangga, bermasyarakat, lingkungan kerja)
    // - birrul walidain / berbuat baik kepada kedua orang tua (taat, ta'dhim/takzim, bersyukur, tawaduk, rida, balas budi)
    // - zakat / haji / jenazah / takziah (melayat, empati duka cita)
    if (
      lower.includes('thaharah') ||
      lower.includes('thoharoh') ||
      lower.includes('sesuci') ||
      lower.includes('kesucian') ||
      lower.includes('suci & najis') ||
      lower.includes('suci dan najis') ||
      lower.includes('mensucikan najis') ||
      lower.includes('najis') ||
      lower.includes('wudhu') ||
      lower.includes('berwudhu') ||
      lower.includes('mandi junub') ||
      lower.includes('janabah') ||
      lower.includes('hadats besar') ||
      lower.includes('hadas besar') ||
      lower.includes('hadats') ||
      lower.includes('hadas') ||
      lower.includes('sholat') ||
      lower.includes('shalat') ||
      lower.includes('sholat fardhu') ||
      lower.includes('shalat fardhu') ||
      lower.includes('sholat sunnah') ||
      lower.includes('shalat sunnah') ||
      lower.includes('rawatib') ||
      lower.includes('dhuha') ||
      lower.includes('tahajjud') ||
      lower.includes('tahajud') ||
      lower.includes('puasa') ||
      lower.includes('ramadhan') ||
      lower.includes('romadhon') ||
      lower.includes('fadhilah puasa') ||
      lower.includes('mahram') ||
      lower.includes('mahrom') ||
      lower.includes("pergaulan syar'i") ||
      lower.includes('pergaulan syari') ||
      lower.includes('aurat') ||
      lower.includes('aurot') ||
      lower.includes('menutup aurat') ||
      lower.includes('dihalalkan') ||
      lower.includes('diharamkan') ||
      lower.includes('halal') ||
      lower.includes('haram') ||
      lower.includes('harom') ||
      lower.includes("distingsi syar'i") ||
      lower.includes('distingsi syari') ||
      lower.includes('surga') ||
      lower.includes('neraka') ||
      lower.includes('maksiat') ||
      lower.includes('dosa besar') ||
      lower.includes("faham jama'ah") ||
      lower.includes('faham jamaah') ||
      lower.includes('tahapan perjuangan') ||
      lower.includes('4 pilar syarat keberhasilan') ||
      lower.includes('4 pilar') ||
      lower.includes("amrin jami'") ||
      lower.includes('amrin jami') ||
      lower.includes("6 thobi'at luhur") ||
      lower.includes('6 thobiat luhur') ||
      lower.includes("thobi'at luhur") ||
      lower.includes('thobiat luhur') ||
      lower.includes('jujur') ||
      lower.includes('amanah') ||
      lower.includes('mujhid muzhid') ||
      lower.includes('muzhid') ||
      lower.includes('rukun') ||
      lower.includes('kompak') ||
      lower.includes('kerjasama yang baik') ||
      lower.includes('kerjasama') ||
      lower.includes('adab') ||
      lower.includes('tatakrama') ||
      lower.includes('bertamu') ||
      lower.includes('berpakaian') ||
      lower.includes('makan') ||
      lower.includes('menguap') ||
      lower.includes('bersin') ||
      lower.includes('bergaul') ||
      lower.includes('menuntut ilmu') ||
      lower.includes('berumah tangga') ||
      lower.includes('bermasyarakat') ||
      lower.includes('lingkungan kerja') ||
      lower.includes('birrul walidain') ||
      lower.includes('berbuat baik kepada kedua orang tua') ||
      lower.includes('kedua orang tua') ||
      lower.includes('orang tua') ||
      lower.includes('taat') ||
      lower.includes("ta'dhim") ||
      lower.includes('takzim') ||
      lower.includes('tawaduk') ||
      lower.includes('tawadhu') ||
      lower.includes('balas budi') ||
      lower.includes('zakat') ||
      lower.includes('haji') ||
      lower.includes('jenazah') ||
      lower.includes('takziah') ||
      lower.includes('melayat') ||
      lower.includes('duka cita') ||
      lower.includes('rukun iman') ||
      lower.includes('rukun islam') ||
      lower.includes('ihsan') ||
      lower.includes('syirik') ||
      lower.includes('qodar') ||
      lower.includes('bak dan bab') ||
      lower.includes('bak & bab') ||
      lower.includes('akhlaq tercela') ||
      lower.includes('akhlak tercela') ||
      lower.includes('saudara') ||
      lower.includes('ulil amri') ||
      lower.includes('tetangga') ||
      lower.includes('tamu') ||
      lower.includes('masjid') ||
      lower.includes('alam sekitar') ||
      lower.includes('salam') ||
      lower.includes('boso') ||
      lower.includes('sak det sak nyet') ||
      lower.includes('sak det') ||
      lower.includes('mandiri') ||
      lower.includes('kemandirian') ||
      lower.includes('peralatan makan') ||
      lower.includes('perlengkapan pengajian') ||
      lower.includes('bakti') ||
      lower.includes('akhlak') ||
      lower.includes('akhlaq') ||
      lower.includes('fiqih') ||
      lower.includes('ibadah')
    ) {
      return 'Fiqih & Ibadah';
    }

    // 5. Kelompok Al-Qur'an & Tahfidz:
    // - Al-Qur'an / Al-Qur'anul Karim / ayat suci Al-Qur'an
    // - tartil / membaca tartil / fasih
    // - tajwid (Qolqolah, Iqlab, Idzhar, Idgham Bighunnah/Bilaghunnah, tanda waqaf, Mad, isti'adzah, basmalah)
    // - hafalan surat / hafalan surat-surat Al-Qur'an / surat-surat pendek Juz 30 (An-Nas s.d. An-Naba')
    // - muraja'ah / muroja'ah / mutqin
    // - surat (An-Nas, Al-Falaq, Al-Ikhlas, Al-Baqarah, An-Nisa, Al-Isra', Al-A'raf, Yasin, dll)
    // - tilawati / baca huruf Al-Qur'an / makharijul huruf / huruf ber-sukun
    // - makna Al-Qur'an / tafsir / mengkaji dan memaknai
    if (
      lower.includes("al-qur'an") ||
      lower.includes("al-qur'anul karim") ||
      lower.includes('al-quranul karim') ||
      lower.includes('al-quran') ||
      lower.includes("ayat suci al-qur'an") ||
      lower.includes('ayat suci') ||
      lower.includes("qur'an") ||
      lower.includes('quran') ||
      lower.includes('tartil') ||
      lower.includes('membaca tartil') ||
      lower.includes('fasih') ||
      lower.includes('tajwid') ||
      lower.includes('qolqolah') ||
      lower.includes('iqlab') ||
      lower.includes('idzhar') ||
      lower.includes('idgham') ||
      lower.includes('bighunnah') ||
      lower.includes('bilaghunnah') ||
      lower.includes('tanda waqaf') ||
      lower.includes('waqaf') ||
      lower.includes('mad') ||
      lower.includes("isti'adzah") ||
      lower.includes('istiazah') ||
      lower.includes('basmalah') ||
      lower.includes('hafalan surat') ||
      lower.includes('surat-surat pendek') ||
      lower.includes('juz 30') ||
      lower.includes("muraja'ah") ||
      lower.includes("muroja'ah") ||
      lower.includes('murojaah') ||
      lower.includes('mutqin') ||
      lower.includes('an-nas') ||
      lower.includes('al-falaq') ||
      lower.includes('al-ikhlas') ||
      lower.includes('al-baqarah') ||
      lower.includes('an-nisa') ||
      lower.includes("al-isra'") ||
      lower.includes('al-isra') ||
      lower.includes("al-a'raf") ||
      lower.includes('al-araf') ||
      lower.includes('yasin') ||
      lower.includes('an-naba') ||
      lower.includes('tilawati') ||
      lower.includes("baca huruf al-qur'an") ||
      lower.includes('makharijul huruf') ||
      lower.includes('makhraj') ||
      lower.includes('huruf ber-sukun') ||
      lower.includes('sukun') ||
      lower.includes("makna al-qur'an") ||
      lower.includes('tafsir') ||
      lower.includes('mengkaji dan memaknai') ||
      lower.includes('hijayyah') ||
      lower.includes('hijaiyah') ||
      lower.includes('fatkhah') ||
      lower.includes('fathah') ||
      /\bhal\b|\bhal\.|\bhalaman\b/i.test(text) ||
      lower.includes('surat') ||
      lower.includes('kandungan') ||
      lower.includes('juz') ||
      lower.includes('tilawah') ||
      lower.includes('tahsin') ||
      lower.includes('tahfidz')
    ) {
      return "Al-Qur'an & Tahfidz";
    }

    return null;
  };

  // Prioritas 1: Periksa butir checklist spesifik (itemTitle)
  const fromItemTitle = matchCategory(itemTitle);
  if (fromItemTitle) return fromItemTitle;

  // Prioritas 2: Periksa deskripsi butir checklist (itemDescription)
  const fromItemDesc = matchCategory(itemDescription);
  if (fromItemDesc) return fromItemDesc;

  // Prioritas 3: Periksa judul materi induk (materialTitle)
  const fromMaterialTitle = matchCategory(materialTitle);
  if (fromMaterialTitle) return fromMaterialTitle;

  // Prioritas 4: Periksa deskripsi materi induk (materialDescription)
  const fromMaterialDesc = matchCategory(materialDescription);
  if (fromMaterialDesc) return fromMaterialDesc;

  // Default fallback
  return "Al-Qur'an & Tahfidz";
}
