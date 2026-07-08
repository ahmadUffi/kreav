# Rencana Integrasi FE ↔ BE (penyesuaian FE ke kontrak endpoint)

> Branch: `fe-be/integration` · Issue: #78
> Arah: **sesuaikan FE ke kontrak BE apa adanya**, sesi MVP via `localStorage` (`userId` + `walletAddress`).

## Context
Tujuan: mengganti data mock FE dengan API BE nyata.

Hasil scan:
- BE (NestJS) mengekspos **22 endpoint absolut** di `http://localhost:3000` (**tanpa** global prefix).
- Uang diserialisasi sebagai **string** (`DecimalToStringInterceptor`), mis. `"18.00"`.
- Error berformat `{ code, message, statusCode, timestamp }`.
- **Tidak ada auth** — endpoint creator-scoped memakai `?userId=` / `?address=`.
- FE (Next.js 16, App Router) **belum punya API client, env, maupun HTTP call**; semua tipe & data berasal dari `frontend/src/lib/mock.ts`.

---

## Gap Analysis (BE vs FE) & Penyesuaian

### Lintas-domain (fondasi)
| Aspek | BE | FE saat ini | Penyesuaian FE |
|---|---|---|---|
| Base URL | `http://localhost:3000`, tanpa prefix | tak ada env | Tambah `NEXT_PUBLIC_API_URL` di `.env.local` |
| Uang | string `"18.00"` | `number` | Parse di boundary (mapper) → tetap `number` di UI |
| Error | `{code,message,statusCode,timestamp}` | — | Client lempar error bertipe dari format ini |
| Auth | tak ada; `?userId=`/`?address=` | tak ada | Simpan `userId`+`walletAddress` di localStorage; thread ke tiap call |
| CORS | `enableCors()` (all origins) | — | OK untuk dev (catatan: perketat nanti) |

### 1. Products — `GET/POST /products`, `GET /products/:id`
- BE kirim: `{id,title,description,fileUrl,priceUsd:string,creatorId,createdAt}`.
- FE butuh: `price:number`, nama `creator`, `category`, `accent`, `emoji`.
- **Penyesuaian FE:**
  - `priceUsd`→`price` via `parseMoney`.
  - `creatorId`→nama: resolve via `GET /users/me?userId=<creatorId>` (mengembalikan `name`/`username`), cache per-id.
  - `category` **tidak ada** di `/products` (walau ada di public-profile) → default/hide filter kategori di store (fallback konstan).
  - `accent`/`emoji` presentasi-only → derive deterministik dari `id`/`title` (palette lokal); simpan helper di FE.
  - Form "New product" `/dashboard/products`: kirim `{title,description,fileUrl,priceUsd:string,creatorId}` (butuh input `fileUrl` + `creatorId` dari sesi).

### 2. Orders / Checkout — `POST /checkout`, `GET /orders`, `GET /orders/:id`
- BE order: `{id,productTitle,productPrice,buyerEmail,amountUsd,status,paymentRef,txHash,createdAt}`,
  status `PAYMENT_PENDING|PAYMENT_RECEIVED|SETTLED|FAILED`.
- FE order: `{product,buyer,amount,status:Paid|Pending|Refunded,date}`.
- **Penyesuaian FE:**
  - Map field: `productTitle→product`, `buyerEmail→buyer`, `amountUsd→amount(number)`, `createdAt→date`.
  - Map status: `PAYMENT_PENDING→Pending`, `PAYMENT_RECEIVED|SETTLED→Paid`, `FAILED→Failed`; **"Refunded" tidak ada** (hapus dari FE).
  - Buy flow `/store/[id]`: tombol → `POST /checkout {productId}` → dapat `orderId` (PENDING) → poll `GET /orders/:id` untuk status. Penyelesaian bayar via webhook server-side (di luar FE) — tampilkan state "menunggu pembayaran".
  - Orders list dashboard: `GET /orders?creatorId=<sesi>`.

### 3. Wallet — `GET /wallet/balance`, `GET /wallet/transactions`, `POST /wallets`
- BE balance: `{address,balanceUsd:string,hasUsdcTrustline,accountExists}`.
- BE tx: `{id,orderId,txHash,totalAmount,amount,recipientType,role,percentage,status,explorerLink,createdAt}`.
- FE wallet: `{balance:number,transactions:[{label,amount,type:credit|debit,date,txHash}]}`, pakai `MOCK_WALLET_ADDRESS` & `stellarTxUrl()`.
- **Penyesuaian FE:**
  - Ganti `MOCK_WALLET_ADDRESS` dengan `walletAddress` dari sesi; wajib untuk kedua GET.
  - `balanceUsd`→`balance(number)`.
  - Tx: `role`→`label`, `type` di-derive (entri settlement creator = `credit`), pakai `explorerLink` BE langsung (buang `stellarTxUrl`).

### 4. Withdrawals — `POST /withdrawals`, `GET /withdrawals/:id`, `GET /withdrawals`
- FE: tombol "Withdraw" non-fungsional.
- **Penyesuaian FE:** buat form `{amount, destinationType: GCASH|GOPAY|PAYNOW|BANK, destinationAccount}` →
  `POST /withdrawals?address=` (202, PROCESSING) → poll `GET /withdrawals/:id` sampai `COMPLETED`; tampilkan receipt (`reference`, `settlementExplorerUrl`, blok `simulation`).

### 5. Analytics — `GET /analytics?creatorId=`
- Shape hampir sama; beda: uang string, **`views` tidak ada di BE**, `deltas` selalu 0.
- **Penyesuaian FE:** `?creatorId=<sesi>`; parse money; **hapus `views`** (atau sembunyikan kartu); `topProducts` sudah bawa `productTitle`; delta tampil 0.

### 6. Users / Profile — `GET|PATCH /users/me`, `GET /users/check-username`, `GET /users/:username/profile`
- **Penyesuaian FE:**
  - Settings `/dashboard/settings`: `GET /users/me?userId=`; save → `PATCH /users/me?userId=` (`name,username,country,bio,avatarEmoji,accent`); tangani 409 username.
  - Signup: ganti `TAKEN_USERNAMES` hardcoded dengan `GET /users/check-username`.
  - Public profile `/u/[username]`: `GET /users/:username/profile` beri `displayName,bio,country,avatarEmoji,accent,products[+category]` — **tanpa socials/links** → bagian socials/links di halaman publik **ditunda** (hide), tampilkan produk unggulan dari `products`.

### 7. Mini-site editor — `GET|PUT /users/me/site?userId=`
- BE site DTO: `{displayName,username,bio,avatarEmoji,accent,socials{ig,x,tiktok,youtube},links[{label,url}],featuredProductIds[]}`.
- **Penyesuaian FE:** `GET` untuk prefill; `PUT` **replace penuh** (kirim seluruh konfig). `links` BE tanpa `id` → FE generate id lokal untuk `key`. `country` tidak ada di site DTO → ambil dari `users/me`.

### 8. Auth / Signup — `POST /auth/register` (+ tanpa login)
- BE register hanya terima `{email, name, role: CREATOR|BUYER|ADMIN}` → **abaikan** `username`/`country`.
- **Penyesuaian FE (alur signup):**
  1. Role FE lowercase → **UPPERCASE** enum BE.
  2. `POST /auth/register {email, name, role}` — `name` diisi dari input (pakai `username` bila tak ada field nama).
  3. Simpan `userId` (dari response) ke localStorage = sesi.
  4. Persist `username`+`country` via `PATCH /users/me?userId=`.
  5. Creator: connect wallet nyata (Freighter, skill `dapp`) → `POST /wallets {creatorId, walletAddress, provider:'FREIGHTER'}`; simpan `walletAddress`.
- **Catatan gap:** tidak ada endpoint **login** → user lama tak bisa re-auth; sesi hanya bertahan via localStorage (batasan MVP, diterima).

### Gap BE yang ditunda (konsekuensi arah "ubah FE")
- Public profile tanpa `socials`/`links` → mini-site publik tak menampilkannya.
- `/products` tanpa `category`/nama creator → di-fallback/di-resolve di FE.
- Tanpa login/JWT & tanpa refund → di luar scope tugas ini.

---

## Struktur file yang dibuat/diubah (FE)
Buat lapisan API baru di `frontend/src/lib/api/`:
- `client.ts` — wrapper `fetch` (base dari `NEXT_PUBLIC_API_URL`, header JSON, parse error `{code,message,...}` jadi throw bertipe, query builder).
- `types.ts` — tipe respons BE mentah (priceUsd:string dst) + tipe view FE (pindahkan/duplikasi tipe dari `mock.ts`).
- `mappers.ts` — `parseMoney`, map order-status, derive `accent`/`emoji`, map tx→view.
- Modul per domain: `products.ts`, `orders.ts`, `wallet.ts`, `withdrawals.ts`, `analytics.ts`, `users.ts`, `site.ts`, `auth.ts`.
- `session.ts` — get/set `userId` & `walletAddress` di localStorage.

Konfig:
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3000` (+ `.env.example`).

Ganti pemakaian mock (import dari `@/lib/mock` → panggilan API) pada halaman:
- `app/(app)/store/page.tsx`, `store/[id]/page.tsx`
- `app/(app)/dashboard/{page,orders,products,wallet,site,settings}/page.tsx`
- `app/u/[username]/page.tsx`
- `app/(app)/signup/page.tsx` + `WalletConnectPanel` (Freighter nyata)

`mock.ts` dipertahankan sbg sumber **tipe** & fallback dev sampai semua halaman termigrasi, lalu dipangkas.

---

## Ringkasan endpoint BE (referensi)
| Modul | Method | Path | Auth/param |
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

## Verifikasi (end-to-end, dev)
1. Jalankan BE: `cd backend && pnpm install && pnpm start:dev` (butuh Postgres + `.env`; cek `GET /health` = `db: connected`).
2. Jalankan FE: `cd frontend && npm run dev` dengan `NEXT_PUBLIC_API_URL` di-set.
3. Alur uji:
   - Signup creator → cek user di BE (`GET /users/me?userId=`), username tersimpan; connect Freighter → `POST /wallets` sukses.
   - Store menampilkan produk dari `GET /products`; detail → `POST /checkout` menghasilkan order PENDING; dashboard orders menampilkannya.
   - Dashboard KPI dari `GET /analytics?creatorId=`; wallet balance/tx dari address terhubung; withdraw → receipt COMPLETED via polling.
   - Editor mini-site `PUT` lalu `GET` konsisten; `/u/[username]` menampilkan profil publik.
4. Cek Network tab: base URL benar, uang ter-parse, error BE tampil rapi.
