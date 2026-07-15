# FE ↔ BE Integration Plan (Adapting Frontend to Backend Contracts)

> Branch: `fe-be/integration` · Issue: #78
> Direction: **adapt FE to existing BE contracts as-is**, handling MVP session state via `localStorage` (`userId` + `walletAddress`).

## Context
Goal: replace mock frontend data with live backend APIs.

Discovery scan results:
- The backend (NestJS) exposes **22 absolute endpoints** on `http://localhost:3000` (**without** a global prefix).
- Monetary values are serialized as **strings** (`DecimalToStringInterceptor`), e.g., `"18.00"`.
- Errors follow the format `{ code, message, statusCode, timestamp }`.
- **No authentication tokens** — creator-scoped endpoints accept query parameters `?userId=` or `?address=`.
- The frontend (Next.js 16, App Router) **currently lacks an API client, environment configuration, and HTTP calls**; all types and sample data originate from `frontend/src/lib/mock.ts`.

---

## Gap Analysis (BE vs FE) & Adaptations

### Cross-Domain Foundation
| Aspect | BE | Current FE | FE Adaptation |
|---|---|---|---|
| Base URL | `http://localhost:3000`, no prefix | no env variable | Add `NEXT_PUBLIC_API_URL` to `.env.local` |
| Money | string `"18.00"` | `number` | Parse at network boundary (mapper) → preserve `number` in UI components |
| Error | `{code,message,statusCode,timestamp}` | — | Client throws typed errors parsed from this format |
| Auth | none; `?userId=`/`?address=` | none | Store `userId`+`walletAddress` in `localStorage`; pass along to each request |
| CORS | `enableCors()` (all origins) | — | OK for local development (note: tighten for production) |

### 1. Products — `GET/POST /products`, `GET /products/:id`
- BE returns: `{id,title,description,fileUrl,priceUsd:string,creatorId,createdAt}`.
- FE requires: `price:number`, creator `name`, `category`, `accent`, `emoji`.
- **FE Adaptations:**
  - Map `priceUsd` → `price` via `parseMoney`.
  - Map `creatorId` → name: resolve via `GET /users/me?userId=<creatorId>` (returns `name`/`username`), cached per `creatorId`.
  - `category` **is not returned** by `/products` (though present in public-profile) → default/hide category filters in the store UI (constant fallback).
  - `accent`/`emoji` are presentation-only → derive deterministically from `id`/`title` (local color palette helper stored in FE).
  - "New product" form `/dashboard/products`: submit `{title,description,fileUrl,priceUsd:string,creatorId}` (requires `fileUrl` input + `creatorId` from session).

### 2. Orders / Checkout — `POST /checkout`, `GET /orders`, `GET /orders/:id`
- BE order: `{id,productTitle,productPrice,buyerEmail,amountUsd,status,paymentRef,txHash,createdAt}`,
  status values `PAYMENT_PENDING|PAYMENT_RECEIVED|SETTLED|FAILED`.
- FE order: `{product,buyer,amount,status:Paid|Pending|Refunded,date}`.
- **FE Adaptations:**
  - Map fields: `productTitle→product`, `buyerEmail→buyer`, `amountUsd→amount(number)`, `createdAt→date`.
  - Map status: `PAYMENT_PENDING→Pending`, `PAYMENT_RECEIVED|SETTLED→Paid`, `FAILED→Failed`; **"Refunded" is unsupported** (remove from FE).
  - Purchase flow `/store/[id]`: button → `POST /checkout {productId}` → receive `orderId` (PENDING) → poll `GET /orders/:id` for status. Payment execution via server-side webhook (outside FE) — display "waiting for payment" UI state.
  - Dashboard orders list: `GET /orders?creatorId=<session>`.

### 3. Wallet — `GET /wallet/balance`, `GET /wallet/transactions`, `POST /wallets`
- BE balance: `{address,balanceUsd:string,hasUsdcTrustline,accountExists}`.
- BE tx: `{id,orderId,txHash,totalAmount,amount,recipientType,role,percentage,status,explorerLink,createdAt}`.
- FE wallet: `{balance:number,transactions:[{label,amount,type:credit|debit,date,txHash}]}`, uses `MOCK_WALLET_ADDRESS` & `stellarTxUrl()`.
- **FE Adaptations:**
  - Replace `MOCK_WALLET_ADDRESS` with `walletAddress` from session; required for both GET calls.
  - Map `balanceUsd` → `balance(number)`.
  - Tx mapping: `role` → `label`, `type` derived (creator settlement entry = `credit`), use BE `explorerLink` directly (remove `stellarTxUrl`).

### 4. Withdrawals — `POST /withdrawals`, `GET /withdrawals/:id`, `GET /withdrawals`
- FE: "Withdraw" button is non-functional mock.
- **FE Adaptations:** create form `{amount, destinationType: GCASH|GOPAY|PAYNOW|BANK, destinationAccount}` →
  `POST /withdrawals?address=` (returns 202 PROCESSING) → poll `GET /withdrawals/:id` until `COMPLETED`; display receipt (`reference`, `settlementExplorerUrl`, `simulation` block).

### 5. Analytics — `GET /analytics?creatorId=`
- Shape is mostly identical; differences: money serialized as strings, **`views` is not returned by BE**, `deltas` always 0.
- **FE Adaptations:** pass `?creatorId=<session>`; parse money values; **remove `views`** (or hide the card); `topProducts` already includes `productTitle`; deltas display as 0.

### 6. Users / Profile — `GET|PATCH /users/me`, `GET /users/check-username`, `GET /users/:username/profile`
- **FE Adaptations:**
  - Settings `/dashboard/settings`: `GET /users/me?userId=`; on save → `PATCH /users/me?userId=` (`name,username,country,bio,avatarEmoji,accent`); handle 409 username conflicts.
  - Signup: replace hardcoded `TAKEN_USERNAMES` with `GET /users/check-username`.
  - Public profile `/u/[username]`: `GET /users/:username/profile` provides `displayName,bio,country,avatarEmoji,accent,products[+category]` — **without socials/links** → socials/links section on public page is **deferred** (hidden), displaying featured products from `products`.

### 7. Mini-site editor — `GET|PUT /users/me/site?userId=`
- BE site DTO: `{displayName,username,bio,avatarEmoji,accent,socials{ig,x,tiktok,youtube},links[{label,url}],featuredProductIds[]}`.
- **FE Adaptations:** `GET` to prefill; `PUT` performs **full replacement** (send entire configuration). BE `links` have no `id` → FE generates local identifiers for React `key`. `country` is absent in site DTO → fetch from `users/me`.

### 8. Auth / Signup — `POST /auth/register` (+ without login)
- BE register only accepts `{email, name, role: CREATOR|BUYER|ADMIN}` → **ignore** `username`/`country` during initial registration.
- **FE Adaptations (signup flow):**
  1. Map lowercase FE roles → **UPPERCASE** BE enum values.
  2. `POST /auth/register {email, name, role}` — fill `name` from input (use `username` if no dedicated name field exists).
  3. Store `userId` (from response) into `localStorage` = session state.
  4. Persist `username`+`country` via `PATCH /users/me?userId=`.
  5. For creators: connect real wallet (Freighter, `dapp` skill) → `POST /wallets {creatorId, walletAddress, provider:'FREIGHTER'}`; store `walletAddress`.
- **Gap note:** no dedicated **login** endpoint exists → returning users cannot re-auth; sessions persist only via `localStorage` (acceptable MVP constraint).

### Deferred Backend Gaps (Consequences of FE Adaptation Strategy)
- Public profile lacks `socials`/`links` → public mini-site omits them.
- `/products` lacks `category`/creator name → handled via fallback/client-side resolution in FE.
- No login/JWT session management and no refund flow → out of scope for this task.

---

## Created/Modified File Structure (FE)
Create a new API layer at `frontend/src/lib/api/`:
- `client.ts` — `fetch` wrapper (base from `NEXT_PUBLIC_API_URL`, JSON headers, error parsing `{code,message,...}` into typed errors, query builder).
- `types.ts` — raw backend response types (`priceUsd:string` etc.) + FE view types (moved/duplicated from `mock.ts`).
- `mappers.ts` — `parseMoney`, order status mapping, derive `accent`/`emoji`, map tx → view format.
- Domain modules: `products.ts`, `orders.ts`, `wallet.ts`, `withdrawals.ts`, `analytics.ts`, `users.ts`, `site.ts`, `auth.ts`.
- `session.ts` — get/set `userId` & `walletAddress` in `localStorage`.

Configuration:
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3000` (+ `.env.example`).

Replace mock data usage (importing from `@/lib/mock` → live API calls) on pages:
- `app/(app)/store/page.tsx`, `store/[id]/page.tsx`
- `app/(app)/dashboard/{page,orders,products,wallet,site,settings}/page.tsx`
- `app/u/[username]/page.tsx`
- `app/(app)/signup/page.tsx` + `WalletConnectPanel` (real Freighter connection)

`mock.ts` is retained as a source of **types** and dev fallback until all pages are migrated, then trimmed.

---

## Summary of Backend Endpoints (Reference)
| Module | Method | Path | Auth/Params |
|---|---|---|---|
| Auth | POST | `/auth/register` | — |
| Products | GET/POST | `/products`, `GET /products/:id` | `?creatorId&page&limit` |
| Orders | POST | `/checkout` | body `{productId}` |
| Orders | GET | `/orders`, `/orders/:id` | `?creatorId&page&limit` |
| Orders | POST | `/webhooks/gcash` | HMAC (server-side) |
| Users | GET/PATCH | `/users/me` | `?userId` |
| Users | GET | `/users/check-username` | `?username` |
| Users | GET | `/users/:username/profile` | — |
| Wallet | GET | `/wallet/balance`, `/wallet/transactions` | `?address` |
| Wallet | POST | `/wallets` | body `{creatorId,walletAddress,provider}` |
| Withdrawals | POST | `/withdrawals` | `?address` |
| Withdrawals | GET | `/withdrawals`, `/withdrawals/:id` | `?address` |
| Analytics | GET | `/analytics` | `?creatorId` |
| Site | GET/PUT | `/users/me/site` | `?userId` |
| Health | GET | `/health` | — |

---

## Verification (End-to-End, Dev)
1. Start backend: `cd backend && pnpm install && pnpm start:dev` (requires PostgreSQL + `.env`; verify `GET /health` returns `db: connected`).
2. Start frontend: `cd frontend && npm run dev` with `NEXT_PUBLIC_API_URL` set appropriately.
3. Test flows:
   - Creator registration → verify user in BE (`GET /users/me?userId=`), username saved; connect Freighter → `POST /wallets` succeeds.
   - Store displays products from `GET /products`; details page → `POST /checkout` generates PENDING order; dashboard orders list shows it.
   - Dashboard KPIs populate from `GET /analytics?creatorId=`; wallet balance/tx populate from connected address; withdrawal → COMPLETED receipt via polling.
   - Mini-site editor `PUT` and subsequent `GET` are consistent; `/u/[username]` renders public profile accurately.
4. Inspect Network tab: base URL is correct, monetary values parse properly, BE errors format cleanly.

