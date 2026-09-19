import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reset singleton jika model baru belum terdeteksi pada instance yang dicache
if (
  globalForPrisma.prisma &&
  (!(globalForPrisma.prisma as any).materialRolling ||
    !(globalForPrisma.prisma as any).teacherRolling ||
    !(globalForPrisma.prisma as any).rollingPengajian)
) {
  try {
    (globalForPrisma.prisma as any).$disconnect?.();
  } catch {}
  globalForPrisma.prisma = undefined;
}

function getPrismaClient(): PrismaClient {
  try {
    if (typeof require !== 'undefined' && require.cache) {
      // Periksa apakah PrismaClient saat ini sudah memiliki model baru
      const testPrisma = new PrismaClient();
      if (
        !(testPrisma as any).teacherRolling ||
        !(testPrisma as any).rollingPengajian ||
        !(testPrisma as any).materialRolling
      ) {
        // Hapus semua cache require yang berkaitan dengan prisma
        Object.keys(require.cache).forEach((key) => {
          if (key.includes('@prisma') || key.includes('.prisma')) {
            delete require.cache[key];
          }
        });
        const FreshPrisma = require('@prisma/client').PrismaClient;
        return new FreshPrisma({
          log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
      }
      return testPrisma;
    }
  } catch (err) {
    console.warn('Fallback instantiating PrismaClient:', err);
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

