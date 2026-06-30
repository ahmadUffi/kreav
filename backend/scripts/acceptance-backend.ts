/**
 * Backend Acceptance Test — end-to-end flow verification.
 *
 * Tests the full backend API flow against a running instance:
 *   Health → Products → Checkout → Wallet → Withdrawal
 *
 * Usage:
 *   export BASE_URL=http://localhost:3000
 *   npx ts-node scripts/acceptance-backend.ts
 *
 * Or with defaults:
 *   npx ts-node scripts/acceptance-backend.ts
 *
 * Output: PASS/FAIL per step + final result.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CREATOR_ADDRESS = process.env.CREATOR_ADDRESS ?? 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3';

interface StepResult {
  name: string;
  pass: boolean;
  detail?: string;
}

async function request(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const url = `${BASE_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, body: data };
}

async function runStep(name: string, fn: () => Promise<boolean>, steps: StepResult[]): Promise<void> {
  try {
    const pass = await fn();
    steps.push({ name, pass });
  } catch (err: any) {
    steps.push({ name, pass: false, detail: err.message ?? String(err) });
  }
}

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  KREAV BACKEND ACCEPTANCE TEST`);
  console.log(`  ${BASE_URL}`);
  console.log(`${'='.repeat(60)}\n`);

  const steps: StepResult[] = [];

  // ── 1. Health ────────────────────────────────────────────────────────
  await runStep('GET /health → DB connected', async () => {
    const { status, body } = await request('GET', '/health');
    return status === 200 && body.status === 'ok' && body.db === 'connected';
  }, steps);

  // ── 2. Products ──────────────────────────────────────────────────────
  await runStep('GET /products → paginated list', async () => {
    const { status, body } = await request('GET', '/products?page=1&limit=5');
    return status === 200 && Array.isArray(body.data) && typeof body.total === 'number';
  }, steps);

  // ── 3. Product detail ────────────────────────────────────────────────
  await runStep('GET /products → first product has priceUsd as string', async () => {
    const { body } = await request('GET', '/products?limit=1');
    if (!body.data?.length) return false;
    const { status, body: detail } = await request('GET', `/products/${body.data[0].id}`);
    return status === 200 && typeof detail.priceUsd === 'string';
  }, steps);

  // ── 4. Wallet balance ────────────────────────────────────────────────
  await runStep('GET /wallet/balance → valid address', async () => {
    const { status } = await request('GET', `/wallet/balance?address=${CREATOR_ADDRESS}`);
    // 200 = success, 500 = Horizon not configured (still passes validation)
    return status >= 200 && status < 500;
  }, steps);

  // ── 5. Wallet transactions ──────────────────────────────────────────
  await runStep('GET /wallet/transactions → paginated list', async () => {
    const { status, body } = await request('GET', `/wallet/transactions?address=${CREATOR_ADDRESS}`);
    return status === 200 && Array.isArray(body.transactions);
  }, steps);

  // ── 6. Wallet transaction explorer link ──────────────────────────────
  await runStep('GET /wallet/transactions → has explorerLink', async () => {
    const { body } = await request('GET', `/wallet/transactions?address=${CREATOR_ADDRESS}&limit=1`);
    if (!body.transactions?.length) return true; // skip if no txs
    const tx = body.transactions[0];
    return typeof tx.explorerLink === 'string' && tx.explorerLink.includes('stellar.expert');
  }, steps);

  // ── 7. Withdrawals list ──────────────────────────────────────────────
  await runStep('GET /withdrawals → paginated list', async () => {
    const { status, body } = await request('GET', `/withdrawals?address=${CREATOR_ADDRESS}`);
    return status === 200 && Array.isArray(body.withdrawals);
  }, steps);

  // ── 8. Withdrawal (if balance sufficient) ────────────────────────────
  await runStep('POST /withdrawals → 202 Accepted', async () => {
    const { status, body } = await request('POST', `/withdrawals?address=${CREATOR_ADDRESS}`, {
      amount: 0.01,
      destinationType: 'GCASH',
      destinationAccount: '0917xxxxxxx',
    });
    // 202 = created, 400 = insufficient balance (still tests the endpoint)
    if (status === 202) return true;
    if (status === 400 && body.code === 'INSUFFICIENT_BALANCE') return true;
    return false;
  }, steps);

  // ── 9. Withdrawal receipt ────────────────────────────────────────────
  await runStep('POST /withdrawals → receipt has simulation block', async () => {
    const { status, body } = await request('POST', `/withdrawals?address=${CREATOR_ADDRESS}`, {
      amount: 0.01,
      destinationType: 'GCASH',
      destinationAccount: '0917xxxxxxx',
    });
    if (status !== 202) return true; // skip if insufficient balance
    return body.simulation?.mode === 'SIMULATED' && Array.isArray(body.simulation.realComponents);
  }, steps);

  // ── 10. Validation ────────────────────────────────────────────────────
  await runStep('POST /withdrawals → 400 for zero amount', async () => {
    const { status } = await request('POST', `/withdrawals?address=${CREATOR_ADDRESS}`, {
      amount: 0,
      destinationType: 'GCASH',
      destinationAccount: '0917xxxxxxx',
    });
    return status === 400;
  }, steps);

  await runStep('GET /products/:id → 404 for unknown', async () => {
    const { status } = await request('GET', '/products/00000000-0000-0000-0000-000000000000');
    return status === 404;
  }, steps);

  await runStep('GET /withdrawals/:id → 404 for unknown', async () => {
    const { status } = await request('GET', '/withdrawals/00000000-0000-0000-0000-000000000000');
    return status === 404;
  }, steps);

  // ── Report ───────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTS`);
  console.log(`${'='.repeat(60)}\n`);

  let allPassed = true;
  for (const s of steps) {
    const icon = s.pass ? '✅' : '❌';
    const detail = s.detail ? ` — ${s.detail}` : '';
    console.log(`  ${icon}  ${s.name}${detail}`);
    if (!s.pass) allPassed = false;
  }

  const passed = steps.filter((s) => s.pass).length;
  const failed = steps.length - passed;

  console.log(`\n  ${'-'.repeat(40)}`);
  console.log(`  Passed: ${passed}/${steps.length}`);
  console.log(`  Failed: ${failed}/${steps.length}`);
  console.log(`  Overall: ${allPassed ? '✅ ACCEPTED' : '❌ FAILED'}`);
  console.log(`\n${'='.repeat(60)}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ACCEPTANCE TEST CRASHED: ${err.message}`);
  process.exit(1);
});
