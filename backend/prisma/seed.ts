/**
 * Prisma seed entrypoint — BE-011 Demo Data Seeder.
 *
 * Creates rich demo data matching the Demo-PRD v1 characters and the
 * frontend mock data shape, so the demo is immediately usable.
 *
 * What gets seeded:
 *   - 1 Creator (Maya Tan) + wallet
 *   - 4 digital products with collaborators
 *   - 3 sample completed orders with settlements + recipients
 *   - 1 platform wallet (pre-funded USDC float holder)
 *
 * Idempotent: skips records that already exist.
 * Safe to run multiple times via `pnpm prisma db seed`.
 *
 * Source: Kreav Demo PRD v1 — demo characters + Implementation Backlog BE-011.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Demo data constants ──────────────────────────────────────────────────

// Wallet addresses from integration/.env (testnet)
const PLATFORM_PUBLIC = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';
const CREATOR_PUBLIC = 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3';
const PHOTOGRAPHER_PUBLIC = 'GD76WTN7LGHUKWT4JNSEXVFIZYTVPXZH6S3WDKI7LQXYXTL6ALUTSRFA';
const EDITOR_PUBLIC = 'GB6QHRYGKGILD5BLRJONTI7TPECZQDQOUSW32HNXYKQZPATTL2SHIATA';

// Helper: consistent fake tx hashes for seed data.
function fakeTxHash(seed: number): string {
  const hex = seed.toString(16).padStart(2, '0');
  return `${hex.repeat(32)}`.slice(0, 64);
}

// ── Seed logic ───────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Kreav demo data seeder — BE-011');
  console.log('');

  // ── 1. Platform wallet (always needed for settlement) ─────────────────
  const platformWallet = await prisma.wallet.findFirst({
    where: { walletAddress: PLATFORM_PUBLIC },
  });
  if (!platformWallet) {
    // Platform wallet doesn't have a User record — it's just a known address.
    // We store it as part of the Stellar config, not in the Wallet table.
    console.log('  ℹ️  Platform wallet is configured via env, not seeded in DB.');
  }

  // ── 2. Creator ────────────────────────────────────────────────────────
  const CREATOR_EMAIL = 'creator@kreav.demo';
  let creator = await prisma.user.findUnique({ where: { email: CREATOR_EMAIL } });
  if (!creator) {
    creator = await prisma.user.create({
      data: {
        email: CREATOR_EMAIL,
        name: 'Maya Tan',
        role: 'CREATOR',
      },
    });
    console.log(`  ✅ Creator: ${creator.name}`);
  } else {
    console.log(`  ⏭️  Creator exists: ${creator.name}`);
  }

  // ── 3. Creator wallet ─────────────────────────────────────────────────
  let creatorWallet = await prisma.wallet.findFirst({
    where: { walletAddress: CREATOR_PUBLIC },
  });
  if (!creatorWallet) {
    creatorWallet = await prisma.wallet.create({
      data: {
        creatorId: creator.id,
        walletAddress: CREATOR_PUBLIC,
        provider: 'FREIGHTER',
      },
    });
    console.log(`  ✅ Wallet: ${CREATOR_PUBLIC.slice(0, 8)}... (FREIGHTER)`);
  } else {
    console.log(`  ⏭️  Wallet exists`);
  }

  // ── 4. Products with collaborators ─────────────────────────────────────
  interface ProductSeed {
    title: string;
    description: string;
    price: string;
    collaborators: { walletAddress: string; role: string; share: number }[];
  }

  const products: ProductSeed[] = [
    {
      title: 'AI Interview Playbook',
      description:
        'Ace your next interview with AI-powered practice sessions, curated questions, and real-time feedback.',
      price: '10.00',
      collaborators: [{ walletAddress: CREATOR_PUBLIC, role: 'Author', share: 100 }],
    },
    {
      title: 'Lightroom Sunset Presets',
      description:
        '12 warm, film-inspired Lightroom presets tuned for golden-hour portraits and travel shots.',
      price: '18.00',
      collaborators: [{ walletAddress: CREATOR_PUBLIC, role: 'Photographer', share: 100 }],
    },
    {
      title: 'Notion Creator OS',
      description:
        'An all-in-one Notion workspace to plan content, track collabs, and manage your product launches.',
      price: '29.00',
      collaborators: [
        { walletAddress: CREATOR_PUBLIC, role: 'Author', share: 50 },
        { walletAddress: PHOTOGRAPHER_PUBLIC, role: 'Designer', share: 30 },
        { walletAddress: EDITOR_PUBLIC, role: 'Editor', share: 20 },
      ],
    },
    {
      title: 'Indie Lo-Fi Pack Vol.2',
      description:
        '20 royalty-free lo-fi loops and stems for streams, videos, and study playlists. WAV + MP3 included.',
      price: '12.00',
      collaborators: [{ walletAddress: CREATOR_PUBLIC, role: 'Producer', share: 100 }],
    },
  ];

  for (const p of products) {
    let product = await prisma.product.findFirst({
      where: { title: p.title, creatorId: creator.id },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          title: p.title,
          description: p.description,
          priceUsd: p.price,
          creatorId: creator.id,
        },
      });
      console.log(`  ✅ Product: ${p.title} ($${p.price})`);
    } else {
      console.log(`  ⏭️  Product exists: ${p.title}`);
    }

    // Create collaborators if not exist
    for (const c of p.collaborators) {
      const existing = await prisma.productCollaborator.findFirst({
        where: { productId: product.id, walletAddress: c.walletAddress },
      });
      if (!existing) {
        await prisma.productCollaborator.create({
          data: {
            productId: product.id,
            walletAddress: c.walletAddress,
            role: c.role,
            revenuePercentage: c.share,
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  // ── 5. Sample orders + settlements ────────────────────────────────────
  // Creates some historical orders so the wallet transaction list isn't empty.
  // In real flow these are created via checkout → webhook → settlement.
  // Here we insert them directly with SETTLED status.

  interface OrderSeed {
    productTitle: string;
    buyerEmail: string;
    amount: string;
    txHash: string;
    daysAgo: number;
    // Split: 5% platform, rest split among creator collaborators
    recipients: { walletAddress: string; role: string; share: number; amount: string }[];
  }

  // Helper: get product id by title
  const productMap = new Map<string, string>();
  for (const p of await prisma.product.findMany({ where: { creatorId: creator.id } })) {
    productMap.set(p.title, p.id);
  }

  const orders: OrderSeed[] = [
    {
      productTitle: 'AI Interview Playbook',
      buyerEmail: 'buyer1@demo.test',
      amount: '10.00',
      txHash: fakeTxHash(1),
      daysAgo: 1,
      recipients: [
        { walletAddress: PLATFORM_PUBLIC, role: 'Platform Fee', share: 5, amount: '0.50' },
        { walletAddress: CREATOR_PUBLIC, role: 'Author', share: 95, amount: '9.50' },
      ],
    },
    {
      productTitle: 'Notion Creator OS',
      buyerEmail: 'buyer2@demo.test',
      amount: '29.00',
      txHash: fakeTxHash(2),
      daysAgo: 2,
      recipients: [
        { walletAddress: PLATFORM_PUBLIC, role: 'Platform Fee', share: 5, amount: '1.45' },
        { walletAddress: CREATOR_PUBLIC, role: 'Author', share: 47.5, amount: '13.78' },
        { walletAddress: PHOTOGRAPHER_PUBLIC, role: 'Designer', share: 28.5, amount: '8.27' },
        { walletAddress: EDITOR_PUBLIC, role: 'Editor', share: 19, amount: '5.50' },
      ],
    },
    {
      productTitle: 'Lightroom Sunset Presets',
      buyerEmail: 'buyer3@demo.test',
      amount: '18.00',
      txHash: fakeTxHash(3),
      daysAgo: 3,
      recipients: [
        { walletAddress: PLATFORM_PUBLIC, role: 'Platform Fee', share: 5, amount: '0.90' },
        { walletAddress: CREATOR_PUBLIC, role: 'Photographer', share: 95, amount: '17.10' },
      ],
    },
  ];

  for (const o of orders) {
    const productId = productMap.get(o.productTitle);
    if (!productId) {
      console.log(`  ⚠️  Product not found: ${o.productTitle} — skipping order`);
      continue;
    }

    // Use a deterministic order ID based on the tx hash for idempotency
    const orderId = `demo-${o.txHash.slice(0, 12)}`;
    const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (existingOrder) {
      console.log(`  ⏭️  Order exists: ${o.productTitle}`);
      continue;
    }

    // Create the order
    const order = await prisma.order.create({
      data: {
        id: orderId,
        productId,
        buyerEmail: o.buyerEmail,
        amountUsd: o.amount,
        status: 'SETTLED',
        txHash: o.txHash,
        paymentRef: `demo-payment-${o.txHash.slice(0, 8)}`,
      },
    });

    // Create settlement
    const settlement = await prisma.settlement.create({
      data: {
        orderId: order.id,
        totalAmount: o.amount,
        txHash: o.txHash,
        status: 'COMPLETED',
      },
    });

    // Create settlement recipients
    for (const r of o.recipients) {
      await prisma.settlementRecipient.create({
        data: {
          settlementId: settlement.id,
          walletAddress: r.walletAddress,
          recipientType: r.walletAddress === PLATFORM_PUBLIC ? 'PLATFORM' : 'CREATOR',
          role: r.role,
          percentage: r.share,
          amount: r.amount,
        },
      });
    }

    console.log(`  ✅ Order: ${o.productTitle} — $${o.amount} settled`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log('🎉 Demo data seeding complete.');
  console.log('');

  const productCount = await prisma.product.count({ where: { creatorId: creator.id } });
  const orderCount = await prisma.order.count();
  const settlementCount = await prisma.settlement.count();

  console.log(`  Creator:     Maya Tan (creator@kreav.demo)`);
  console.log(`  Products:    ${productCount}`);
  console.log(`  Orders:      ${orderCount}`);
  console.log(`  Settlements: ${settlementCount}`);
  console.log(`  Wallet:      ${CREATOR_PUBLIC}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
