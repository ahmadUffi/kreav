# Kreav — Panduan Setup & Deploy Testnet

Tujuan dokumen ini: membawa Anda dari nol sampai **demo MVP berjalan end-to-end di Stellar Testnet** — pembeli beli produk (bayar lokal, disimulasikan) → USDC ter-split ke wallet kreator on-chain → link produk dikirim via email. Semua langkah yang butuh secret key platform atau Stellar CLI **Anda** yang jalankan (agent tidak memegang secret Anda).

> **Dua target berbeda** (jangan dicampur):
> - **Target 1 — MVP inti** (dokumen ini): deploy kontrak → beli (bayar demo) → `settle` on-chain → USDC ke wallet kreator → email link produk. **Tidak** butuh MoneyGram/PSP nyata.
> - **Target 2 — Off-ramp MoneyGram sandbox** (ROADMAP Fase 2A): butuh allowlist MoneyGram + USDC issuer `GBBD47…`. Ajukan allowlist paralel; integrasi menyusul.

---

## 0. Prasyarat (sekali saja)

| Alat | Cek | Install |
|------|-----|---------|
| Rust + target wasm | `rustc --version` | https://rustup.rs lalu `rustup target add wasm32v1-none` |
| Stellar CLI ≥ v22 | `stellar --version` | `cargo install --locked stellar-cli` |
| Node 22+ & pnpm | `node -v` / `pnpm -v` | https://nodejs.org , `npm i -g pnpm` |
| Freighter (browser) | ekstensi terpasang | https://freighter.app — set **Network: Testnet** |

Konfigurasikan CLI ke testnet:

```bash
stellar network use testnet   # atau tambahkan --network testnet di tiap perintah
```

---

## 1. Buat wallet platform BARU (signer settlement + float holder)

Platform adalah akun yang menandatangani `settle` dan menampung float USDC. Karena Anda ingin **ganti wallet platform**, buat identitas baru dan timpa yang lama:

```bash
# Generate + danai (friendbot beri 10.000 XLM test). --overwrite mengganti key 'platform' lama.
stellar keys generate platform --network testnet --fund --overwrite

# Ambil nilainya untuk backend/.env:
stellar keys address platform    # → PLATFORM_WALLET_ADDRESS (G…)
stellar keys show platform       # → PLATFORM_WALLET_SECRET (S…)  ⚠️ RAHASIA
```

Salin kedua nilai ke `backend/.env` (lihat §4). XLM dipakai untuk gas + reserve sponsorship trustline (Fase 1.5).

> 🔒 `PLATFORM_WALLET_SECRET` adalah **satu-satunya secret sisi server** (pengecualian non-custodial resmi di `AGENTS.md`). Hanya di `backend/.env` (gitignored), tak pernah di-log/commit.
>
> ⚠️ **Ganti wallet = deploy ulang kontrak.** `initialize` mengikat alamat platform ke kontrak dan tak bisa diubah. Jika sebelumnya sudah pernah deploy dengan wallet lama, Anda **harus deploy kontrak baru** (§3) memakai wallet baru ini, lalu isi ulang `SPLIT_CONTRACT_ID`.

Kalau suatu saat ingin memakai secret yang sudah ada (bukan generate baru): `stellar keys add platform --secret-key` lalu tempel S… saat diminta.

---

## 2. Sediakan USDC testnet untuk float platform

Kontrak `settle` mentransfer USDC dari platform ke kreator, jadi platform **harus memegang USDC** dan **punya trustline**. Pilih satu jalur:

### Opsi A — Terbitkan USDC uji sendiri (DIREKOMENDASIKAN untuk Target 1)

Paling andal: Anda kendalikan issuer sehingga bisa mint tanpa batas. (Untuk Target 2/MoneyGram nanti ganti ke issuer `GBBD47…`.)

```bash
# 2A.1 buat akun issuer testnet
stellar keys generate usdc-issuer --network testnet --fund
stellar keys address usdc-issuer          # catat sebagai <ISSUER_G>

# 2A.2 platform buat trustline ke USDC:<ISSUER_G>
stellar tx new change-trust \
  --source-account platform \
  --line USDC:<ISSUER_G> \
  --network testnet

# 2A.3 issuer mint (kirim) 1.000 USDC ke platform via payment
stellar tx new payment \
  --source-account usdc-issuer \
  --destination <PLATFORM_G> \
  --asset USDC:<ISSUER_G> \
  --amount 10000000000 \
  --network testnet
# amount dalam stroops (7 desimal): 1.000 USDC = 1000 * 10^7 = 10000000000
```

Set di `backend/.env` **dan** `integration/.env`: `USDC_ISSUER=<ISSUER_G>`.

### Opsi B — USDC kanonik `GBBD47…` (perlu untuk Target 2 nanti)

Trustline ke `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, lalu peroleh saldo via faucet Circle/anchor sandbox (mis. deposit sandbox MoneyGram memberi USDC ini). Bukan jalur mint-sendiri, jadi tunda sampai Target 2.

### Dapatkan alamat USDC SAC (untuk `initialize`)

`initialize` butuh alamat **kontrak SAC** (C…), bukan issuer (G…). SAC deterministik per aset:

```bash
stellar contract id asset --asset USDC:<ISSUER_G> --network testnet   # cetak <USDC_SAC_C>
# jika belum ter-deploy on-chain, deploy sekali:
stellar contract asset deploy --asset USDC:<ISSUER_G> --source-account platform --network testnet
```

Untuk Opsi B, USDC SAC testnet kanonik = `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

---

## 3. Build & deploy kontrak settlement

```bash
cd smartcontract
stellar contract build
# output: target/wasm32v1-none/release/kreav_settlement_contract.wasm
```

Deploy (kontrak ini memakai `initialize` terpisah, **bukan** `__constructor`, jadi deploy tanpa argumen):

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/kreav_settlement_contract.wasm \
  --source-account platform \
  --network testnet
# ⇒ mencetak CONTRACT_ID (C…)  ← INI yang jadi SPLIT_CONTRACT_ID
```

Inisialisasi (mengikat **wallet platform baru** + usdc_sac ke instance storage):

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account platform \
  --network testnet \
  -- \
  initialize \
  --platform_wallet <PLATFORM_G> \
  --usdc_sac <USDC_SAC_C>
```

Verifikasi cepat:

```bash
stellar contract invoke --id <CONTRACT_ID> --source-account platform --network testnet -- get_version
# ⇒ "Kreav Settlement v1.0.0"
```

> ⚠️ **Front-run initialize (catatan keamanan, Fase 4):** siapa pun bisa memanggil `initialize` duluan. Di testnet risikonya rendah; lakukan deploy+initialize berurutan cepat. Perbaikan permanen (`__constructor`) antre di ROADMAP Fase 4.

---

## 4. Isi env

### `backend/.env` (gitignored — jangan commit)

```
# ── Aplikasi & DB (sudah ada) ──
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...

# ── Stellar (Testnet) ──
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
PLATFORM_WALLET_ADDRESS=<PLATFORM_G>       # ⬅ wallet BARU (§1)
PLATFORM_WALLET_SECRET=<PLATFORM_S>        # ⬅ wallet BARU (§1) — RAHASIA
USDC_ISSUER=<ISSUER_G>                     # Opsi A: issuer sendiri, atau GBBD47… (Opsi B)
USDC_ASSET_CODE=USDC
SPLIT_CONTRACT_ID=<CONTRACT_ID>            # ⬅ hasil §3 (kontrak BARU untuk wallet baru)
EXPLORER_URL=https://stellar.expert/explorer/testnet

# ── Demo & Email (MVP) ──
DEMO_MODE=true                             # WAJIB: mengaktifkan tombol "bayar demo" untuk juri
RESEND_API_KEY=                            # opsional: kosong → email di-log, tak dikirim
RESEND_FROM=Kreav <onboarding@resend.dev>  # biarkan default bila belum punya domain

# ── Opsional ──
JWT_SECRET=                                # dev pakai default; WAJIB & acak di produksi
GCASH_WEBHOOK_SECRET=                       # kosong di testnet; isi untuk uji jalur HMAC
```

> `DEMO_MODE=true` wajib agar juri bisa beli lewat UI tanpa curl. `RESEND_API_KEY` boleh kosong — alur tetap jalan (link muncul di log + tercatat `NotificationLog`); isi hanya bila ingin email nyata masuk inbox. Catatan Resend free tier: dengan `onboarding@resend.dev` hanya bisa kirim ke email akun Anda sendiri — untuk kirim ke sembarang email, verifikasi domain sendiri lalu ubah `RESEND_FROM`.

### `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:3000   # base URL backend (tanpa prefix global)
```

### `integration/.env` (untuk skrip verifikasi — salin dari `integration/.env.example`)

```
NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=<CONTRACT_ID>
USDC_SAC=<USDC_SAC_C>
PLATFORM_PUBLIC=<PLATFORM_G>
PLATFORM_SECRET=<PLATFORM_S>
CREATOR_PUBLIC=<G… kreator uji>
PHOTOGRAPHER_PUBLIC=<G…>
EDITOR_PUBLIC=<G…>
```

---

## 5. Verifikasi on-chain (sebelum sentuh backend)

Skrip integrasi adalah pembanding kanonik untuk pipeline backend:

```bash
cd integration
pnpm install
pnpm run version         # 01 — metadata kontrak
pnpm run initialize      # 02 — guard AlreadyInitialized (harus "already initialized")
pnpm run settle:single   # 03 — 1 kreator, 10 USDC → 9.50 masuk
pnpm run settle:multi    # 04 — 3 kolaborator, jumlah persis
pnpm run idempotency     # 05 — double-settle ditolak
pnpm run balances        # 07 — baca semua saldo
```

Bila `settle:single` menampilkan kreator menerima **9.50 USDC** dan ada txHash → **kontrak sehat**. Kreator uji harus punya trustline USDC lebih dulu (lihat §6).

---

## 6. Trustline kreator (USDC)

Setiap kreator penerima **wajib** punya trustline USDC, jika tidak `settle` revert atomik (`op_no_trust`) untuk semua kolaborator.

- **Otomatis & disponsori app (Fase 1.5 — SUDAH JADI):** di dashboard wallet muncul banner **"Activate USDC"** bila trustline belum ada. Kreator klik sekali, tanda tangan di Freighter; **biaya jaringan + reserve ditanggung platform** (endpoint `POST /wallets/trustline/prepare` + `/submit`). Ini jalur yang dipakai di demo.
- **Manual (fallback):** di Freighter kreator (Testnet) → Manage Assets → tambah `USDC:<ISSUER_G>`.

---

## 7. Jalankan backend + frontend

```bash
# terminal 1
cd backend && pnpm install && pnpm prisma migrate deploy && pnpm start:dev
# terminal 2
cd frontend && pnpm install && pnpm dev
```

### Alur demo MVP (yang dicoba juri)

1. **Kreator:** daftar → connect Freighter → dashboard wallet → klik **Activate USDC** (trustline tersponsori) → buat produk (isi `fileUrl` + kolaborator: wallet + %).
2. **Pembeli/juri:** buka `/store` → pilih produk → **isi email** → **Buy now** → panel **"bayar lokal (demo)"** → klik **Pay** (memakai `DEMO_MODE`).
3. **Otomatis:** webhook internal → `settle` on-chain → USDC ter-split (95% kreator / 5% platform) ke wallet → **email link produk** dikirim ke pembeli (atau di-log bila `RESEND_API_KEY` kosong).
4. **Bukti:** saldo kreator naik 9.50 USDC + txHash → stellar.expert; baris `NotificationLog` tercatat.

Cash-out (DEX/CEX) = urusan kreator (di luar MVP). Fitur withdraw simulasi masih ada tapi bukan bagian alur demo utama.

---

## Ringkasan pembagian kerja

| Langkah | Siapa |
|---------|-------|
| Generate wallet platform baru, danai XLM/USDC, trustline platform | **Anda** (butuh CLI + secret) |
| Deploy + initialize kontrak baru, isi `SPLIT_CONTRACT_ID` | **Anda** |
| Isi `DEMO_MODE`, `RESEND_*` di `backend/.env` | **Anda** |
| Kode Fase 1.5 (sponsorship), pre-check settlement, pengiriman email, simulasi bayar | **Agent (SUDAH JADI)** |
| Bantu verifikasi `integration/scripts/*` & perbaikan bug | **Agent** |
| Ajukan allowlist MoneyGram (Target 2) + integrasi SEP-24 | **Anda (ajukan) / Agent (integrasi)** |

## Troubleshooting

| Gejala | Sebab | Solusi |
|--------|-------|--------|
| `SimulationFailed` saat invoke | Kontrak belum deploy / ID salah | Cek `SPLIT_CONTRACT_ID` |
| `NotInitialized` | `initialize` belum dipanggil | §3 |
| `op_no_trust` | Kreator tak punya trustline USDC | §6 (Activate USDC) |
| Settlement `SETTLEMENT_FAILED` setelah ganti wallet | Kontrak lama terikat wallet lama | Deploy kontrak baru dgn wallet baru, isi ulang `SPLIT_CONTRACT_ID` (§3) |
| `insufficient balance` | Float USDC platform habis | Ulangi §2 (mint/kirim USDC ke platform baru) |
| Tombol "Pay (demo)" → 403 | `DEMO_MODE` tak aktif | Set `DEMO_MODE=true` di `backend/.env`, restart backend |
| Email tak masuk inbox | `RESEND_API_KEY` kosong / free-tier | Isi key + kirim ke email akun Anda; atau cek link di log server |
| `Transaction NOT_FOUND` | Jendela 7 hari RPC lewat | Settle ulang dengan orderRef baru |
