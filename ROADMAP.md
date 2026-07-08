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
- Isi `SPLIT_CONTRACT_ID` + verifikasi settlement nyata end-to-end (pakai `integration/scripts/*` sebagai pembanding).
- Tuntaskan integrasi FE↔BE: sambungkan 5 layar yang masih pakai mock ke `src/lib/api/*`.
- Demo hardening: skeleton/loading & error state (sudah ada `ui/Skeleton`, `ui/ErrorState`, `SessionNotice`); hindari long-load; sembunyikan jargon blockchain kecuali txHash + explorer link.
- **Verifikasi:** skenario Demo-PRD — creator 0 USDC → buyer checkout $10 → saldo creator 9.50 USDC → klik txHash ke stellar.expert → withdraw.

### Fase 1 — Identitas & keamanan nyata (FONDASI — sebelum uang nyata)
Tujuan: hentikan "identitas by query param". Prasyarat semua fase berikutnya.
- **Auth kreator via SEP-10 (Stellar Web Auth)** — paling selaras dengan non-custodial: login = tanda tangan challenge dengan Freighter. Terbitkan session token (JWT/cookie httpOnly) server-side.
- **Auth pembeli** — magic-link email atau OAuth ringan (pembeli tak wajib punya wallet).
- **NestJS `AuthGuard` + `@CurrentUser()`** — ambil identitas dari token, **bukan** query/body. Refactor semua endpoint ber-scope-user (`orders`, `users/me`, `wallet`, `withdrawals`, `analytics`, `site`); hapus param `creatorId`/`userId`.
- Rate limiting per-endpoint (sudah ada `@nestjs/throttler` global) untuk `checkout`, `webhooks/gcash`, `auth`.
- **Verifikasi:** e2e — request tanpa token / token user lain ditolak (403); Supertest happy-path tetap hijau.

### Fase 2 — Rel uang nyata (on/off-ramp)
Tujuan: ganti mock uang dengan integrasi asli, mulai dari satu koridor.
- **Payment-in nyata** — integrasikan satu PSP/anchor SEP-24 deposit menggantikan mock GCash; pertahankan verifikasi signature webhook.
- **Off-ramp nyata** — anchor SEP-24/SEP-6 untuk withdrawal, menggantikan simulasi 2.5s di `withdrawals.service.ts`. Pertahankan blok transparansi (real vs simulated) selama transisi.
- **Alur gagal/refund** — tangani `PAYMENT_FAILED`, timeout settlement (`SETTLEMENT_PENDING`), kebijakan refund off-chain (settlement on-chain immutable).
- **Verifikasi:** satu koridor negara end-to-end dengan sandbox anchor; audit state machine order untuk semua cabang kegagalan.

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
