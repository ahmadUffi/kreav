# KREAV
### *Creator Economy, Borderless Payment*
**Stellar APAC Hackathon 2026 — Track 3: Payment Consumer Applications**

---

## Slide 1 — The Problem

**Content creator di Asia tidak bisa dibayar oleh fans mereka sendiri.**

Seorang kreator Indonesia punya 100.000 subscribers. 30% dari mereka ada di Filipina dan Vietnam. Tapi tidak ada satu pun cara mudah bagi fans itu untuk support kreator tersebut secara langsung.

- Saweria & Trakteer? Hanya untuk fans Indonesia
- PayPal? Tidak tersedia di Indonesia, butuh kartu kredit
- Wise? Minimum transfer terlalu tinggi untuk micro-payment
- Stripe? Tidak support Indonesia sebagai merchant

> **Fans ada. Konten ada. Tapi jalur uang dari fans ke kreator lintas negara — putus.**

---

## Slide 2 — Market Size

| | Data |
|---|---|
| Content creator aktif di Asia | 50 juta+ |
| Creator economy Asia value 2025 | $104 miliar USD |
| Average tip yang hilang karena tidak ada jalur | Rp5.000 – Rp200.000 per transaksi |
| Cross-border micro-payment yang feasible saat ini | Hampir nol |

**Tidak ada platform yang solve cross-border creator payment di Asia dengan local payment method.**

---

## Slide 3 — Introducing Kreav

**Kreav adalah platform creator economy Asia yang memungkinkan fans dari mana saja membayar creator menggunakan metode pembayaran lokal mereka — diselesaikan via Stellar blockchain dalam detik.**

```
kreav.com/namakreator
```

Creator punya halaman profil sendiri untuk:
- Menjual produk digital (ebook, preset, template, kelas)
- Menerima tip dari fans global
- Menerima pembayaran one-time atau berulang

**Seperti Lynk.id + Gumroad — tapi bekerja lintas negara.**

---

## Slide 4 — How It Works

### Untuk Creator
```
1. Daftar di Kreav
2. Connect Stellar wallet (Freighter / Lobstr)
3. Upload produk digital & set harga
4. Share link: kreav.com/nama
5. Dana langsung masuk ke wallet — tidak perlu WD
```

### Untuk Fan / Buyer
```
1. Buka link creator
2. Pilih produk atau nominal tip
3. Bayar via metode lokal:
   🇮🇩 QRIS  |  🇵🇭 GCash  |  🇻🇳 VietQR  |  🌏 dan lainnya
4. Konfirmasi — dapat akses produk digital langsung
5. Selesai. Tidak perlu daftar, tidak perlu crypto wallet
```

---

## Slide 5 — Why Stellar

Kreav bukan "crypto app". Stellar adalah **rel di balik layar** — fan dan creator tidak pernah menyentuh crypto.

| | PayPal | Wise | **Kreav (Stellar)** |
|---|---|---|---|
| Fee | 4–5% | 0.5–2% | **~0.000005 USD/tx** |
| Settlement | 1–3 hari | Menit–jam | **3–5 detik** |
| Micro-tip Rp5.000 | ❌ Tidak ekonomis | ❌ Tidak ekonomis | **✅ Ekonomis** |
| Fan butuh kartu kredit | ✅ Ya | ✅ Ya | **❌ Tidak** |
| Cross-border | ⚠️ Terbatas | ⚠️ Terbatas | **✅ Global** |

> *"Dana tidak pernah menyentuh server Kreav. Langsung dari fan ke wallet creator via Stellar."*

---

## Slide 6 — Architecture

```
FAN                          STELLAR                    CREATOR
────                         ───────                    ───────

Bayar QRIS/GCash/VietQR
        │
        ▼
   Anchor Lokal          ──► USDC Settlement ──►    Anchor Creator
   (konfirmasi ke                                    (cairkan ke
    Kreav webhook)                                    bank lokal)
        │                                                  │
        ▼                                                  ▼
  Kreav verifikasi                               Dana masuk wallet
  di Stellar ledger                              creator (Freighter)
        │
        ▼
  Link produk digital
  dikirim ke fan
```

**Fee split on-chain:** Setiap transaksi otomatis split — 95% ke wallet creator, 5% ke Kreav — dalam satu atomic Stellar transaction. Transparan, tidak bisa dimanipulasi.

**Stellar DEX:** Jika tidak ada direct path (misal PHP → IDR), Stellar DEX auto-swap via USDC sebagai intermediary. Built-in, tidak perlu bangun sendiri.

---

## Slide 7 — What's On-Chain vs Off-Chain

**On-chain (Stellar) — bukti permanen:**
- Settlement payment fan → creator
- Fee split 95/5 dalam satu atomic transaction
- Memo sebagai payment ID unik per transaksi
- Riwayat transaksi verifiable di Stellar Explorer

**Off-chain (database Kreav) — konteks aplikasi:**
- Profil & halaman creator
- Data produk digital
- Notifikasi & dashboard
- Riwayat untuk UI

> *90% Kreav adalah web app biasa. Stellar hanya masuk di satu titik — saat payment dieksekusi.*

---

## Slide 8 — Composability

Kreav tidak reinvent the wheel. Kreav **build di atas** ekosistem Stellar yang sudah ada:

| Building Block | Yang Sudah Ada | Kreav Pakai |
|---|---|---|
| Wallet | Freighter, Lobstr | Creator connect wallet existing |
| Settlement currency | USDC on Stellar | Tidak bikin token baru |
| On/off-ramp | Anchor per negara | Gateway fiat ↔ Stellar |
| Liquidity & swap | Stellar DEX built-in | Auto-swap currency |
| Protokol | SEP-6 / SEP-24 | Standar anchor interaction |

**Post-hackathon roadmap:** Kreav payment widget bisa di-embed ke platform lain (Lynk.id, Trakteer, dll) sebagai payment layer mereka.

---

## Slide 9 — Business Model

**Revenue: Platform fee 5% per transaksi sukses**

- Fee diambil on-chain — atomic, transparan, tidak bisa dimanipulasi
- Tidak ada subscription, tidak ada hidden fee
- Creator dan fan tahu persis berapa yang dipotong

| Metric | Angka |
|---|---|
| Fee rate | 5% per transaksi |
| Stellar tx cost | ~$0.000005 (margin sangat besar) |
| Break-even | ~4.000 transaksi/bulan (avg Rp50.000/tip) |
| TAM creator Asia | 50 juta+ creator |

**Kenapa 5% kompetitif:**
- Trakteer/Saweria: 5–10%
- PayPal: 4–5% + fixed fee + FX spread
- Kreav: 5% flat, tidak ada FX spread, tidak ada fee tersembunyi

---

## Slide 10 — Product Integrity

**Bagaimana Kreav mencegah creator curang dengan link bohong?**

**Fase MVP (Hackathon):**
- Creator terverifikasi via email + nomor HP
- Sistem rating & review dari buyer
- Dispute mechanism — creator yang fraud di-ban, dana di-hold
- Transaction hash on-chain sebagai bukti permanen untuk buyer

**Roadmap:**
- Hosted file upload — creator upload langsung ke Kreav storage, bukan link eksternal
- Buyer dapat akses file langsung dari server Kreav setelah payment confirmed

---

## Slide 11 — Alignment with Hackathon

| Kriteria Hackathon | Kreav | Status |
|---|---|---|
| User-facing financial app | Halaman creator + dashboard | ✅ |
| Payment app people can use | Fan bayar tanpa login, tanpa crypto wallet | ✅ |
| Connect to local economy | QRIS, GCash, VietQR, dan lainnya | ✅ |
| Integrate with local anchors | Anchor per negara = inti arsitektur | ✅ |
| Use local assets | USDC Stellar + fiat lokal | ✅ |
| On/off-ramps | Fan on-ramp, creator off-ramp | ✅ |
| Plug into existing wallets | Freighter / Lobstr | ✅ |
| DeFi & liquidity | Stellar DEX untuk auto-swap | ✅ |
| Composability | Payment layer yang bisa di-embed | ✅ |

---

## Slide 12 — Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React / Next.js |
| Backend | Laravel / Node.js |
| Database | PostgreSQL |
| Blockchain | Stellar Horizon SDK |
| Settlement | USDC on Stellar |
| Anchor | SEP-6 / SEP-24 compatible anchors |
| Wallet | Freighter (desktop), Lobstr (mobile) |
| DEX | Stellar DEX built-in |
| Payment Lokal | Midtrans (ID), GCash API (PH), VietQR (VN) |

---

## Slide 13 — Demo Target

**Minimum yang akan didemonstrasikan:**

- [ ] Creator daftar, connect Freighter wallet, upload 1 produk digital
- [ ] Fan dari "Filipina" buka halaman kreator, bayar via GCash simulation
- [ ] Anchor konfirmasi → Kreav verify di Stellar ledger
- [ ] Fee split 95/5 terjadi on-chain dalam satu atomic transaction
- [ ] Fan terima akses produk digital
- [ ] Transaction hash verifiable di **Stellar Testnet Explorer**
- [ ] Creator lihat transaksi masuk di dashboard

**Semua transaksi demo di Stellar Testnet — verifiable publik.**

---

## Slide 14 — Roadmap

```
SEKARANG (Hackathon MVP)
├── Creator halaman profil
├── Produk digital + tip
├── QRIS, GCash, VietQR
├── Stellar settlement + fee split on-chain
└── Stellar DEX auto-swap

POST-HACKATHON (Jika dapat grant)
├── Mainnet deployment
├── Hosted file storage (anti-fraud)
├── Mobile app (iOS + Android)
├── Expand anchor ke lebih banyak negara Asia
└── Kreav sebagai payment SDK/widget untuk platform lain

JANGKA PANJANG
├── Subscription/membership creator
├── Live streaming + virtual gift
├── Creator analytics dashboard
└── B2B: white-label payment infrastructure Asia
```

---

## Slide 15 — Why Us, Why Now

**Kenapa Kreav:**
- Tim yang memahami pain point kreator SEA secara langsung
- Build di atas infrastruktur Stellar yang sudah proven
- Non-custodial — tidak ada custody risk, tidak ada regulatory blocker
- UX yang menyembunyikan kompleksitas blockchain dari user

**Kenapa sekarang:**
- Creator economy Asia tumbuh 3x dalam 3 tahun terakhir
- QRIS Cross-Border sudah expand — validasi bahwa pasar butuh cross-border payment
- Stellar ekosistem makin mature — anchor, USDC, DEX sudah siap

---

## One-Liner

> **Kreav — Jual kontenmu. Terima bayaran dari siapa saja, dari mana saja.**

---

*Kreav | Stellar APAC Hackathon 2026 | kreav.com*
