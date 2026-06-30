/**
 * Prisma seed entrypoint — BE-011 Demo Data Seeder.
 *
 * Creates the demo characters defined in Demo-PRD v1:
 *   - Creator: Maya Tan (Indonesian, role=CREATOR)
 *   - Product: "AI Interview Playbook" ($10)
 *   - Collaborator: Maya as sole recipient (100%, Author)
 *   - Wallet: Maya's Stellar testnet public key (non-custodial)
 *
 * Idempotent: skips records that already exist (by unique email/address).
 * Safe to run multiple times via `pnpm prisma db seed`.
 *
 * Source: Kreav Demo PRD v1 — demo characters.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Demo data constants ──────────────────────────────────────────────────

const CREATOR_EMAIL = 'creator@kreav.demo';
const CREATOR_NAME = 'Maya Tan';
const CREATOR_PUBLIC = 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3';

const PRODUCT_TITLE = 'AI Interview Playbook';
const PRODUCT_PRICE = '10.00';

async function main() {
  console.log('🌱 Kreav demo data seeder — BE-011');

  // ── 1. Creator ────────────────────────────────────────────────────────
  let creator = await prisma.user.findUnique({ where: { email: CREATOR_EMAIL } });
  if (!creator) {
    creator = await prisma.user.create({
      data: {
        email: CREATOR_EMAIL,
        name: CREATOR_NAME,
        role: 'CREATOR',
      },
    });
    console.log(`  ✅ Creator: ${creator.name} (${creator.id})`);
  } else {
    console.log(`  ⏭️  Creator already exists: ${creator.name}`);
  }

  // ── 2. Product ────────────────────────────────────────────────────────
  let product = await prisma.product.findFirst({
    where: { title: PRODUCT_TITLE, creatorId: creator.id },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        title: PRODUCT_TITLE,
        description:
          'Ace your next interview with AI-powered practice sessions, curated questions, and real-time feedback. Created by Maya Tan.',
        priceUsd: PRODUCT_PRICE,
        creatorId: creator.id,
      },
    });
    console.log(`  ✅ Product: ${product.title} ($${PRODUCT_PRICE})`);
  } else {
    console.log(`  ⏭️  Product already exists: ${product.title}`);
  }

  // ── 3. Collaborator ───────────────────────────────────────────────────
  const existingCollab = await prisma.productCollaborator.findFirst({
    where: { productId: product.id, walletAddress: CREATOR_PUBLIC },
  });
  if (!existingCollab) {
    await prisma.productCollaborator.create({
      data: {
        productId: product.id,
        walletAddress: CREATOR_PUBLIC,
        role: 'Author',
        revenuePercentage: 100.0,
        status: 'ACTIVE',
      },
    });
    console.log(`  ✅ Collaborator: ${CREATOR_PUBLIC.slice(0, 8)}... (100%)`);
  } else {
    console.log(`  ⏭️  Collaborator already exists`);
  }

  // ── 4. Wallet ─────────────────────────────────────────────────────────
  const existingWallet = await prisma.wallet.findFirst({
    where: { walletAddress: CREATOR_PUBLIC },
  });
  if (!existingWallet) {
    await prisma.wallet.create({
      data: {
        creatorId: creator.id,
        walletAddress: CREATOR_PUBLIC,
        provider: 'FREIGHTER',
      },
    });
    console.log(`  ✅ Wallet: ${CREATOR_PUBLIC.slice(0, 8)}... (FREIGHTER)`);
  } else {
    console.log(`  ⏭️  Wallet already exists`);
  }

  console.log('🎉 Demo data seeding complete.');
  console.log('');
  console.log('  Creator:    Maya Tan (creator@kreav.demo)');
  console.log(`  Product:    ${PRODUCT_TITLE} ($${PRODUCT_PRICE})`);
  console.log(`  Wallet:     ${CREATOR_PUBLIC}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
