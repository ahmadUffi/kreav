# Kreav — Peta Jalan Produk: dari Demo Hackathon → Produk Nyata

## Konteks

**Apa itu Kreav.** *Programmable cross-border settlement infrastructure* untuk kreator produk digital, di atas Stellar. Bukan marketplace/social platform. Nilai inti: pembeli bayar pakai metode lokal → smart contract Soroban otomatis membagi 95% kreator / 5% platform → kreator terima USDC di wallet Stellar sendiri dalam detik, terverifikasi on-chain.

**Kondisi sekarang (baseline).** Proyek hackathon (APAC Stellar 2026, Track 3) dengan kematangan *medium-to-high untuk sebuah demo*. Jalur kritis **nyata on-chain**: checkout → webhook (HMAC diverifikasi) → event `payment.received` → invoke Soroban (build→simulate→sign→submit→poll) → catat Settlement, plus startup-recovery bila crash. Non-custodial betulan (hanya public key).

**Mengapa roadmap ini.** Untuk jadi produk nyata (bukan sekadar demo), ada beberapa celah fundamental yang teridentifikasi dari kode. Roadmap ini memisahkan "menyelesaikan demo" dari "mengeraskan jadi produk", dengan prioritas berbasis risiko: **keamanan identitas dulu**, baru rel uang nyata, baru compliance/skala.

### Celah utama yang ditemukan (bukti dari kode)
- **Auth lemah/tidak aman** — identitas hanya `userId` di `localStorage`; endpoint menerima `creatorId`/`userId` sebagai **query param** (mis. `GET /orders?creatorId=`, `PATCH /users/me?userId=`) tanpa guard → siapa pun bisa mengaku jadi siapa pun. **Blocker produksi #1.**
- **Mock yang disengaja** — provider GCash (webhook disimulasikan; signature real) dan payout anchor/bank (`SIMULATION_DELAY_MS = 2500` di `withdrawals.service.ts`).
- **Pengiriman produk digital belum jelas** — `Product.fileUrl` ada, tapi belum ada alur pengiriman file aman ke pembeli setelah `SETTLED`. Untuk "penjualan produk digital", ini fitur inti yang hilang.
- **Integrasi FE-BE belum tuntas** — branch `fe-be/integration`; layar berikut masih menyentuh `src/lib/mock.ts`: `store/page.tsx`, `u/[username]/page.tsx`, `dashboard/site/page.tsx`, `CreatorMiniSite.tsx`, `ProductCard.tsx`.
- **Notifikasi & analytics** — entity `NotificationLog` ada tapi kemungkinan belum aktif; delta analytics hardcoded `0`.
- **Konfigurasi Stellar** — `SPLIT_CONTRACT_ID` di `backend/.env` masih kosong → settlement gagal sampai diisi.

---

## Roadmap (berfase, berprioritas)

### Fase 0 — Selesaikan demo (segera, "make it green end-to-end")
Tujuan: satu jalur demo 3 menit berjalan mulus di Testnet.
- [ ] Isi `SPLIT_CONTRACT_ID` + verifikasi settlement nyata end-to-end (pakai `integration/scripts/*` sebagai pembanding). **← BLOCKED: butuh contract ID dari owner.**
- [x] Tuntaskan integrasi FE↔BE: `lib/mock.ts` dihapus; tipe view pindah ke `lib/types.ts`; semua layar membaca `src/lib/api/*`.
- [x] Demo hardening dasar: skeleton/loading & error state (`ui/Skeleton`, `ui/ErrorState`, `SessionNotice`).
- **Verifikasi:** skenario Demo-PRD — creator 0 USDC → buyer checkout $10 → saldo creator 9.50 USDC → klik txHash ke stellar.expert → withdraw. *(menunggu SPLIT_CONTRACT_ID)*

### Fase 1 — Identitas & keamanan nyata ✅ (inti selesai)
Tujuan: hentikan "identitas by query param". Prasyarat semua fase berikutnya.
- [x] **Auth kreator via SEP-10** — `POST /auth/challenge` + `/auth/verify` (stellar-sdk `WebAuth`); login = tanda tangan challenge dengan Freighter; session JWT (`@nestjs/jwt`, `JWT_SECRET`). Halaman `/login` di FE.
- [x] **Register = logged in** — `POST /auth/register` mengembalikan session JWT (berlaku untuk creator & buyer baru).
- [x] **`JwtAuthGuard` + `@CurrentUser()`** — identitas dari token; param `creatorId`/`userId`/`address` DIHAPUS dari `orders` (list), `users/me`, `site`, `analytics`, `wallets`, `withdrawals`, `products` (create). Alamat wallet di-resolve server-side; receipt withdrawal punya ownership check (404 tanpa existence leak).
- [x] **FE token session** — JWT di localStorage, axios interceptor `Authorization: Bearer`; signup/connect/products/withdraw tak lagi mengirim identitas.
- [x] **Verifikasi:** e2e auth-negatif (401 tanpa token, 404 lintas-owner) + seluruh suite hijau (BE: 125 unit + 43 e2e; FE: build hijau).
- [ ] Sisa (ditunda): login pembeli returning (magic-link email — butuh provider email), rate-limit khusus `/auth/*` sudah ada via `@Throttle`.

### Hasil review SC↔BE↔FE (2026-07-08) — sudah diperbaiki
Review logic smart contract + integrasi Stellar (dinilai terhadap checklist skill `smart-contracts/security.md`):
- [x] **`is_settled` pre-check** — kontrak mewajibkan backend cek `is_settled(order_ref)` sebelum submit/retry; sebelumnya TIDAK pernah dipanggil → order yang sudah settled on-chain bisa salah dicap `SETTLEMENT_FAILED` saat recovery. Kini: `SorobanRpcService.isSettled()` (simulate-only; marker ter-arsip = settled) + jalur `recoverAlreadySettled` di `SettlementService` (row ada → SETTLED; txHash diketahui → record; keduanya tidak ada → SETTLED + warning rekonsiliasi manual). Degrade lunak bila RPC down.
- [x] **`TRY_AGAIN_LATER`** dari `sendTransaction` kini dilempar sebagai `SettlementSubmissionError` — sebelumnya lolos ke polling 30s lalu order menggantung `SETTLEMENT_PENDING` selamanya.
- [x] **Mirror DB = math kontrak** — recipient terakhir kini dicatat sebagai *remainder* (menyerap dust), identik dengan `calculate_creator_amounts` di kontrak.
- [x] **Guard `MAX_RECIPIENTS`=10** di backend (mirror konstanta kontrak) — gagal dengan log jelas, bukan simulation error opak.
- [x] FE: hapus `MOCK_WALLET_ADDRESS` (dead mock, 0 pemakai).
- **Keselarasan terverifikasi**: fee 500 bps (SC=BE), USDC 7 desimal, encoding `Recipient` ScMap ter-sort + `i128` + `scvString` cocok dengan tipe kontrak, 13 status `OrderStatus` FE=Prisma, enum destinasi withdrawal FE=BE, jaringan TESTNET FE (Freighter) = BE (passphrase), Σbps=10000 dijamin validasi 100.00.

### Temuan review yang DITUNDA (masuk fase di bawah)
- **Fase 3:** `POST /checkout` men-generate `buyerEmail` placeholder (`buyer+<ts>@kreav.test`) — pengiriman produk butuh email pembeli asli di checkout.
- **Fase 4 (pra-mainnet / redeploy kontrak):**
  - `initialize` bisa di-front-run (guard `AlreadyInitialized` ada, tapi siapa pun bisa memanggil duluan dengan wallet mereka) → pakai `__constructor` atau deploy+initialize atomik saat redeploy (skill security.md §3).
  - Marker idempotensi TTL ~30 hari — setelah arsip, settle ulang aman (simulasi menuntut restore) tapi `is_settled` butuh penanganan restore; dipertimbangkan saat mainnet.
  - `calculate_creator_amounts` pakai `.expect()` (panic) alih-alih `ContractError::ArithmeticOverflow` — inkonsistensi kecil error-mapping; perbaiki saat upgrade kontrak.
  - FE `stellarTxUrl` hardcode testnet — parameterkan saat cutover mainnet (BE sudah configurable via `EXPLORER_URL`).

### Fase 1.5 — Sponsored onboarding (fee & reserve ditanggung app) ✅ (inti selesai)
Audit fee (2026-07-09): gas transaksi `settle` **sudah** dibayar platform (source + signer = platform wallet); SEP-10 challenge tidak pernah disubmit (fee 0); buyer tidak menyentuh chain. **Celah:** kreator masih menanggung biaya onboarding sendiri — akun harus funded (reserve 1 XLM) + trustline USDC (reserve 0.5 XLM + fee `changeTrust`); tidak ada kode FE/BE yang membuat/mensponsori trustline. Tanpa trustline, `settle` revert atomik (`op_no_trust`) dan memblokir SEMUA kolaborator.

Solusi: **sponsored reserves (CAP-33)** native — bukan relayer eksternal.
- **SC: tidak ada perubahan** — sponsorship adalah operasi classic, bukan urusan kontrak; tidak perlu redeploy.
- **BE (modul stellar + wallets):**
  - [x] `SponsorshipService.prepareSponsoredTrustline(creator)` — source tx = platform (platform bayar fee): `beginSponsoringFutureReserves(creator)` [+ `createAccount(creator, "0")` bila akun belum ada] + `changeTrust(USDC, source=creator)` + `endSponsoringFutureReserves(source=creator)`; platform tanda tangan tx yang PERSIS dibangun (anti blind-sign).
  - [x] `submitSponsoredTrustline(signedXdr, expectedCreator)` — re-parse + validasi struktur (source=platform, sponsoredId & changeTrust.source = creator, aset = USDC terkonfigurasi), submit Horizon, return txHash.
  - [x] Endpoint JWT: `POST /wallets/trustline/prepare` → `{xdr, networkPassphrase, createsAccount}`; `POST /wallets/trustline/submit` → `{txHash, explorerLink}` (`WalletsTrustlineController`).
  - [x] Pre-check settlement: `findRecipientsMissingTrustline` verifikasi trustline SEMUA recipient via HorizonService → gagal cepat `SETTLEMENT_FAILED` + log `RECIPIENT_NO_TRUSTLINE`, bukan revert on-chain. Degrade lunak bila Horizon error.
  - [ ] (ditunda) Float monitor: tambah threshold saldo **XLM** platform (sponsorship mengunci 0.5–1.5 XLM per kreator) — belum, masuk polish Fase 4 observability.
- **FE:**
  - [x] `lib/api/wallet.ts`: `activateUsdc(signerAddress)` — prepare → Freighter `signTransaction` → submit.
  - [x] `UsdcActivationPanel` + banner di **dashboard wallet** bila `hasUsdcTrustline=false` ("Activate USDC — biaya jaringan ditanggung Kreav", satu klik). Integrasi di dashboard (bukan signup/connect) karena endpoint butuh sesi terautentikasi + wallet sudah terhubung.
- **Biaya platform:** fee ~0.00001 XLM/tx; reserve tersponsor 0.5 XLM (trustline) + 1 XLM (akun baru) — terkunci selama disponsori, kembali bila dicabut.
- **Verifikasi:** +8 unit test baru (SponsorshipService validasi anti blind-sign; pre-check trustline settlement). BE build + 137 unit hijau (2 flaky prisma-DB tak terkait); FE build hijau.
- Alternatif ditolak: OpenZeppelin Relayer (skill dapp) — overkill untuk MVP; fee-bump saja tidak cukup karena masalah intinya reserve XLM, bukan fee.

### Fase 2 — Rel uang nyata (on/off-ramp)
Tujuan: ganti mock uang dengan integrasi asli, mulai dari satu koridor.

**Riset anchor koridor ID/VN/PH (2026-07-09).** Direktori `anchors.stellar.org` saat ini **tidak punya anchor SEP-24 khusus IDR maupun VND** yang aktif; anchor PHP lama Coins.ph sudah mati (`coins.ph/.well-known/stellar.toml` → 404). Kesimpulan: strategi "satu anchor lokal per negara" tidak realistis hari ini. Arsitektur pemenang = **off-ramp lewat satu anchor global (MoneyGram Ramps) + on-ramp lewat PSP fiat lokal per negara**.

#### 2A — Off-ramp: MoneyGram Ramps (kandidat utama) ⭐
Satu-satunya jalur terverifikasi yang menutup **Indonesia + Vietnam + Filipina sekaligus** (off-ramp 174 negara; VN via jaringan SeABank + Agribank; preseden: wallet Hana meluncurkan USDC→cash PH/ID/VN via MoneyGram, Nov 2025).
- **Selaras dengan arsitektur Kreav**: protokolnya **SEP-10** (auth — sudah ada di Fase 1) + **SEP-24** (withdrawal), aset **USDC di Stellar** (sama dengan aset settlement). Integrasi = kelanjutan, bukan rewrite.
- **Bisa diuji di Testnet**: ada sandbox TestNet (min 10 USDC testnet, issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) + production-preview MainNet (limit 10–20 USDC/tx).
- **BE:** `AnchorSep24Service` (SEP-10 ke anchor → `POST /sep24/transactions/withdraw/interactive` → simpan `transaction.id` + `url`), ganti simulasi 2.5s di `withdrawals.service.ts` dengan submit USDC ke rekening escrow anchor lalu poll status SEP-24; petakan status anchor → status Withdrawal Kreav; pertahankan blok transparansi (real vs simulated) selama transisi.
- **FE:** buka `interactive.url` anchor (popup SEP-24) untuk KYC + pilih tujuan cash pickup; tampilkan status transaksi anchor.
- **Bloker bisnis (bukan teknis):** wallet Kreav harus di-**allowlist** MoneyGram untuk sandbox; produksi butuh **KYB + perjanjian legal** via business.moneygram.com. Ajukan paralel dengan development.
- Opsi masa depan: **SEP-31** (anchor↔anchor) untuk koridor B2B, dan anchor lokal baru bila muncul di direktori.

#### 2B — On-ramp: PSP fiat lokal (bukan anchor)
Pembeli tidak memegang/menginginkan USDC → anchor SEP-24 tidak cocok di sisi masuk. Pertahankan pola sekarang (PSP webhook → `payment.received` → settle), ganti mock GCash dengan PSP nyata, mulai satu koridor:
- **PH**: GCash / Maya  • **ID**: Xendit atau Midtrans (QRIS, VA, e-wallet)  • **VN**: MoMo / ZaloPay via agregator (mis. 9Pay).
- Platform menampung fiat + menjaga float USDC (sudah tersirat di `float-monitor.service.ts`). Pertahankan verifikasi signature webhook HMAC yang sudah ada.

#### 2C — Alur gagal/refund
- Tangani `PAYMENT_FAILED`, timeout settlement (`SETTLEMENT_PENDING`), kebijakan refund off-chain (settlement on-chain immutable).
- **Verifikasi:** satu koridor negara end-to-end dengan sandbox anchor (MoneyGram TestNet) + PSP sandbox; audit state machine order untuk semua cabang kegagalan.

### Fase 3 — Pengiriman produk & engagement
Tujuan: jadikan "jualan produk", bukan hanya "transfer uang".
- **Pengiriman file aman** — setelah `SETTLED`, beri pembeli akses ter-otorisasi ke `Product.fileUrl` (signed URL / download token berbatas waktu).
- **Notifikasi** — aktifkan `NotificationLog`: email ke kreator saat settlement selesai & ke pembeli saat produk siap diunduh (`settlement.completed` sudah diemit — tinggal consumer baru).
- **Analytics sungguhan** — hitung delta period-over-period (saat ini `0`).

### Fase 4 — Trust, compliance, skala (pra-mainnet)
- **KYC/AML (SEP-12)** untuk kepatuhan anchor.
- **Observability** — logging terstruktur, metrik, alert; manfaatkan `float-monitor.service.ts` untuk peringatan saldo float platform.
- **Multi-token & fee configurable** — jalur upgrade contract (fee 5% saat ini hardcoded `PLATFORM_FEE_BPS`); dukung SAC selain USDC.
- **Mainnet cutover** — passphrase, explorer URL publik, rotasi kunci platform, load/soak test settlement batch.

---

## Prioritas ringkas
1. **Fase 0** (demo hijau) — jam/hari.
2. **Fase 1** (auth nyata) — blocker produksi teratas; segera setelah demo.
3. **Fase 2** (rel uang) — nilai bisnis inti.
4. **Fase 3 & 4** — kedalaman produk & kesiapan mainnet.

## Catatan eksekusi
- Ikuti working agreement di `AGENTS.md`: satu issue = satu branch (`be/<slug>` / `fe/<slug>`) = satu PR ke `develop`, Conventional Commits, DoD (lint+build+test hijau), CI hijau sebelum merge, **agent tidak pernah auto-merge**.
- Uang selalu Decimal/string, non-custodial, setiap aksi on-chain punya txHash + explorer link.

## Verifikasi menyeluruh (per fase)
- **Fungsional:** skenario Demo-PRD end-to-end di Testnet + `integration/scripts/99-acceptance.ts`.
- **Keamanan:** e2e auth-negatif (Fase 1); audit tak ada `userId`/`creatorId` via query.
- **Regresi:** `pnpm test` + `pnpm test:e2e` (backend), `pnpm build` (frontend) hijau di CI tiap PR.
