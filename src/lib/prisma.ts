import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function instantiatePrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? instantiatePrisma();

// Cache the Prisma instance in globalThis for ALL environments (including production).
// Without this, each Vercel serverless warm invocation may recreate the client and
// open a new DB connection, adding 300–800 ms overhead per request.
globalForPrisma.prisma = prisma;

export default prisma;
