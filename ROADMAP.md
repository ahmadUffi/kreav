# Kreav — Roadmap Produk

## Visi

**Kreav adalah infrastruktur settlement lintas-negara untuk kreator produk digital, di atas Stellar.** Pembeli bayar → smart contract Soroban otomatis membagi 95% kreator / 5% platform → kreator terima USDC di wallet-nya sendiri dalam hitungan detik, terverifikasi on-chain. Rail-nya **global**; Asia Tenggara adalah pasar awal, bukan batas teknis.

Ini bukan proyek sekali-jalan untuk hackathon. Arahnya jelas dan bertahap: **fondasi on-chain yang aman → rel uang fiat nyata (on/off-ramp) → kedalaman produk → kesiapan mainnet & compliance.** Setiap fase menambah nilai yang bisa dipakai, bukan menumpuk fitur. Model bisnisnya sederhana dan berkelanjutan — **fee settlement 5%** sebagai infrastruktur, tanpa memegang dana kreator (non-custodial → tanpa risiko custody/regulasi sebagai perantara).

---

## Status ringkas

Legenda: ✅ selesai · 🚧 sedang berjalan · 🔜 direncanakan

| Fase | Fokus | Status |
|------|-------|--------|
| 0 | Core settlement on-chain (demo end-to-end) | ✅ |
| 1 | Identitas & keamanan (SEP-10 + JWT) | ✅ |
| 1.5 | Onboarding tersponsori (CAP-33) | ✅ |
| 2 | Rel uang nyata (on/off-ramp) | 🚧 off-ramp SEP-24 jalan di testnet · on-ramp berikutnya |
| 3 | Pengiriman produk & engagement | 🚧 email aktif · file delivery aman berikutnya |
| 4 | Trust, compliance & skala (pra-mainnet) | 🔜 |

---

## Fondasi yang sudah berdiri

Yang membuat Kreav sudah bekerja secara nyata hari ini (bukan mock):

- **✅ Settlement on-chain sungguhan** — checkout → webhook (signature HMAC diverifikasi) → event `payment.received` → invoke Soroban (build → simulate → sign → submit → poll) → catat Settlement, dengan startup-recovery bila crash mid-settlement. Kontrak revenue-split sudah **ter-deploy di Testnet** (`SPLIT_CONTRACT_ID` terisi) dan diinisialisasi.
- **✅ Identitas aman (Fase 1)** — login kreator via **SEP-10** (tanda tangan challenge di Freighter) → session JWT; `JwtAuthGuard` + `@CurrentUser()` di semua endpoint (identitas dari token, bukan lagi `creatorId`/`userId` via query param). Non-custodial sejati — server hanya menyimpan public key.
- **✅ Onboarding tersponsori (Fase 1.5, CAP-33)** — banner "Activate USDC" satu klik; **fee + reserve trustline ditanggung platform** (sponsored reserves native, anti blind-sign), plus pre-check trustline sebelum settle agar tidak revert on-chain.
- **✅ Off-ramp SEP-24 (Fase 2A, di testnet)** — withdrawal interaktif ke anchor Stellar (SEP-10 + SEP-24), kreator menandatangani kiriman USDC di Freighter; hasil punya txHash + link explorer. Aktif via flag `ANCHOR_ENABLED`, diuji terhadap SDF test anchor.
- **✅ Pengiriman & bukti** — link produk dikirim via email (Resend) setelah settle; setiap aksi on-chain punya txHash + link stellar.expert; saldo dibaca live dari Horizon.
- **✅ Kualitas SC↔BE↔FE terverifikasi** — `is_settled` pre-check + penanganan `TRY_AGAIN_LATER`, mirror DB = math kontrak (remainder menyerap dust), guard `MAX_RECIPIENTS`=10, fee 500 bps & USDC 7-desimal selaras di SC/BE/FE.

---

## Yang sedang & akan dibangun

### Fase 2 — Rel uang produksi 🚧
Off-ramp sudah berjalan di testnet; langkah berikutnya menaikkannya ke produksi dan menambah on-ramp fiat nyata.

- **2A · Off-ramp → produksi (MoneyGram Ramps).** Satu-satunya jalur terverifikasi yang menutup **ID + VN + PH sekaligus** (off-ramp 174 negara), dan **selaras arsitektur** kita — protokolnya SEP-10 (sudah ada) + SEP-24 (sudah kita implement), aset USDC di Stellar. Yang tersisa **bukan teknis** melainkan bisnis: **allowlist wallet** untuk sandbox + **KYB + perjanjian legal** untuk produksi (business.moneygram.com). Diajukan paralel dengan development. Opsi lanjutan: **SEP-31** untuk koridor B2B, dan anchor lokal baru begitu tersedia di direktori.
- **2B · On-ramp: PSP fiat lokal.** Pembeli tak memegang USDC, jadi sisi masuk pakai PSP (bukan anchor SEP-24): PH → GCash/Maya, ID → Xendit/Midtrans (QRIS/VA/e-wallet), VN → MoMo/ZaloPay. Pola tetap: PSP webhook → `payment.received` → settle; platform menjaga float USDC (`float-monitor.service.ts`). Mulai dari satu koridor.
- **2C · Alur gagal/refund.** `PAYMENT_FAILED`, timeout settlement, kebijakan refund off-chain (settlement on-chain immutable).

### Fase 3 — Pengiriman produk & engagement 🚧
Menjadikannya "jualan produk", bukan sekadar "transfer uang".
- **File delivery aman** 🔜 — akses ter-otorisasi ke `Product.fileUrl` setelah `SETTLED` (signed URL / download token berbatas waktu), menggantikan link email polos.
- **Notifikasi** ✅/🚧 — email link produk sudah aktif; perluas `NotificationLog` (notifikasi ke kreator saat settlement selesai).
- **Analytics** 🔜 — delta period-over-period nyata (saat ini sebagian `0`).

### Fase 4 — Trust, compliance & skala (pra-mainnet) 🔜
- **KYC/AML (SEP-12)** untuk kepatuhan anchor produksi.
- **Observability** — logging terstruktur, metrik, alert; ambang saldo float **XLM** platform (sponsorship mengunci 0.5–1.5 XLM/kreator) + float USDC.
- **Hardening kontrak saat redeploy** — `initialize` atomik / `__constructor` (anti front-run), penanganan restore marker idempotensi (TTL ~30 hari), error-mapping `ArithmeticOverflow` konsisten.
- **Multi-token & fee configurable** — jalur upgrade (fee 5% kini `PLATFORM_FEE_BPS`); dukung SAC selain USDC.
- **Mainnet cutover** — passphrase & explorer URL publik (BE sudah `EXPLORER_URL`-configurable), rotasi kunci platform, load/soak test settlement batch.

---

## Model keberlanjutan

Kenapa ini bisa terus berjalan, bukan berhenti setelah demo:
- **Pendapatan menyatu dengan produk** — fee 5% ditarik on-chain di setiap settlement; makin banyak transaksi, makin sehat, tanpa biaya penagihan terpisah.
- **Beban operasi rendah** — non-custodial (tak memegang dana kreator → tak ada beban custody/escrow/regulasi sebagai penampung), infra ringan (VPS + Docker + Caddy + Neon), rel Stellar berbiaya ~sub-sen per transaksi.
- **Bertumbuh secara global** — rail sudah global; ekspansi = menambah koridor on/off-ramp, bukan menulis ulang inti.
- **Fondasi teknis yang bisa dibangun di atasnya** — auth, settlement, sponsorship, dan off-ramp sudah menjadi modul yang dipakai ulang tiap fase.

---

## Catatan eksekusi & verifikasi

- **Alur kerja:** ikuti `AGENTS.md` — satu issue = satu branch (`be/<slug>` / `fe/<slug>`) = satu PR ke `develop`, Conventional Commits, DoD (lint + build + test hijau), CI hijau sebelum merge.
- **Prinsip tetap:** uang selalu Decimal/string, non-custodial, setiap aksi on-chain punya txHash + explorer link.
- **Verifikasi per fase:** skenario end-to-end di Testnet + `integration/scripts/99-acceptance.ts`; e2e auth-negatif (Fase 1); `pnpm test`/`pnpm test:e2e` (backend) + `npm run build` (frontend) hijau di CI tiap PR.
