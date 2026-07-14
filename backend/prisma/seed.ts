/**
 * Prisma seed entrypoint.
 * Implemented in BE-011 (Demo Data Seeder). For now it's a no-op so
 * `prisma db seed` doesn't error when invoked from migrate workflows.
 *
 * Source: Kreav Demo PRD v1 — demo characters.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  // Intentionally empty until BE-011.
  await prisma.$connect();
  console.log('Seed: no-op (implemented in BE-011)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
