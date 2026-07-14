/**
 * Kreav Smoke Test — quick health check for demo readiness.
 *
 * Run 5 minutes before presenting to verify everything is alive.
 *
 * Usage:
 *   npx ts-node scripts/smoke.ts
 *
 * Exit code: 0 = all good, 1 = something failed.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CREATOR = process.env.CREATOR_ADDRESS ?? 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3';

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

async function get(path: string): Promise<{ status: number; body: any }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, body: data };
  } catch (err: any) {
    return { status: 0, body: { error: err.message } };
  }
}

async function main(): Promise<void> {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║     KREAV SMOKE TEST                 ║`);
  console.log(`  ║     ${BASE_URL}  ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  const checks: Check[] = [];

  // 1. Health — app + DB
  const health = await get('/health');
  checks.push({
    name: 'Health ✅',
    ok: health.status === 200 && health.body?.db === 'connected',
    detail: health.body?.db === 'connected' ? 'DB connected' : health.body?.db ?? health.body?.error,
  });

  // 2. Products — API returns data
  const products = await get('/products?limit=1');
  checks.push({
    name: 'Products ✅',
    ok: products.status === 200 && Array.isArray(products.body?.data),
    detail: `found ${products.body?.data?.length ?? 0} products`,
  });

  // 3. Wallet balance — endpoint responds
  const balance = await get(`/wallet/balance?address=${CREATOR}`);
  checks.push({
    name: 'Wallet Balance ✅',
    ok: balance.status >= 200 && balance.status < 500,
    detail: balance.status === 200 ? `${balance.body?.balanceUsd ?? '?'} USDC` : `HTTP ${balance.status}`,
  });

  // 4. Wallet transactions — endpoint responds
  const txs = await get(`/wallet/transactions?address=${CREATOR}&limit=1`);
  checks.push({
    name: 'Wallet Transactions ✅',
    ok: txs.status === 200 && Array.isArray(txs.body?.transactions),
    detail: `${txs.body?.total ?? 0} total`,
  });

  // 5. Withdrawals — endpoint responds
  const wds = await get(`/withdrawals?address=${CREATOR}&limit=1`);
  checks.push({
    name: 'Withdrawals ✅',
    ok: wds.status === 200 && Array.isArray(wds.body?.withdrawals),
    detail: `${wds.body?.total ?? 0} total`,
  });

  // 6. Swagger — OpenAPI renders
  const swagger = await get('/api-json');
  checks.push({
    name: 'Swagger ✅',
    ok: swagger.status === 200 && swagger.body?.openapi !== undefined,
    detail: `OpenAPI ${swagger.body?.openapi ?? 'N/A'}`,
  });

  // Print results
  let allOk = true;
  for (const c of checks) {
    const icon = c.ok ? '  ✅' : '  ❌';
    const detail = c.detail ? ` (${c.detail})` : '';
    console.log(`${icon}  ${c.name}${detail}`);
    if (!c.ok) allOk = false;
  }

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n  ${passed}/${checks.length} checks passed`);

  if (allOk) {
    console.log(`\n  ✅ KREAV BACKEND IS DEMO-READY\n`);
    process.exit(0);
  } else {
    console.log(`\n  ⚠️  Some checks failed — review above\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  ❌ SMOKE TEST CRASHED: ${err.message}\n`);
  process.exit(1);
});
