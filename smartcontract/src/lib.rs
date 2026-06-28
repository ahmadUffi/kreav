#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String, Symbol, Vec,
    token,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/// Data pembagian untuk setiap creator (atau platform fee)
#[contracttype]
#[derive(Clone)]
pub struct CreatorShare {
    pub address: Address,
    pub amount: i128, // dalam stroops: 1 USDC = 10_000_000
}

/// Key untuk penyimpanan data di storage
#[contracttype]
pub enum DataKey {
    Platform,           // address platform wallet (signer)
    UsdcSac,            // address USDC SAC di Stellar
    FeeAddress,         // address wallet penerima fee 5%
    Settled(String),    // track order_id yang sudah di-settle (anti double)
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct KreavSettlementContract;

#[contractimpl]
impl KreavSettlementContract {

    // ─── Initialize ───────────────────────────────────────────────────────
    //
    // Panggil SEKALI setelah deploy. Simpan alamat penting di storage
    // supaya tidak perlu dikirim sebagai parameter setiap kali settle.
    //
    // FIX dari versi lama:
    //   usdc_token dan platform_fee_address tidak lagi dikirim saat settle,
    //   tapi disimpan di sini. Lebih aman karena backend tidak bisa salah kirim.

    pub fn initialize(
        env: Env,
        platform: Address,    // wallet yang akan sign setiap settlement
        usdc_sac: Address,    // USDC SAC testnet: CBIELTK6...DAMA
        fee_address: Address, // wallet penerima fee 5%
    ) {
        if env.storage().instance().has(&DataKey::Platform) {
            panic!("contract already initialized");
        }
        platform.require_auth();

        env.storage().instance().set(&DataKey::Platform,   &platform);
        env.storage().instance().set(&DataKey::UsdcSac,    &usdc_sac);
        env.storage().instance().set(&DataKey::FeeAddress, &fee_address);

        // Perpanjang TTL supaya contract tidak expire (~1 hari = 17280 ledger)
        env.storage().instance().extend_ttl(17280, 17280);
    }

    // ─── settle_payment ───────────────────────────────────────────────────
    //
    // Fungsi utama: split dan kirim USDC ke semua penerima.
    //
    // FIX dari versi lama:
    //   1. Cek order_id sudah settled → tolak double settlement
    //   2. Validasi total_amount == platform_fee + sum(creators)
    //   3. usdc_sac dan fee_address diambil dari storage, bukan parameter
    //   4. Event payload → total_amount (bukan platform address)

    pub fn settle_payment(
        env: Env,
        platform: Address,
        platform_fee_amount: i128,   // jumlah fee platform (5%)
        creators: Vec<CreatorShare>, // daftar creator dan porsi masing-masing (total 95%)
        order_id: String,            // ID order unik dari database backend
        total_amount: i128,          // total USDC yang harus dibagikan (untuk validasi)
    ) {
        // ── 1. Hanya platform yang boleh invoke ──────────────────────────
        platform.require_auth();

        // Verifikasi caller = platform yang terdaftar di storage
        let stored_platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .expect("contract not initialized");

        if platform != stored_platform {
            panic!("unauthorized: caller is not registered platform");
        }

        // ── 2. Anti double-settlement ─────────────────────────────────────
        //
        // FIX CRITICAL: Cek apakah order_id ini sudah pernah di-settle.
        // Kalau sudah → langsung panic. Mencegah backend retry yang tidak sengaja
        // atau bug yang kirim dua kali.
        let settled_key = DataKey::Settled(order_id.clone());
        if env.storage().persistent().has(&settled_key) {
            panic!("order already settled");
        }

        // ── 3. Validasi total amount ──────────────────────────────────────
        //
        // FIX CRITICAL: Pastikan angka-angka yang dikirim backend konsisten.
        // platform_fee_amount + sum semua creator.amount harus == total_amount.
        // Kalau tidak cocok, ada bug di backend atau ada yang coba manipulasi.
        let mut creator_sum: i128 = 0;
        for c in creators.iter() {
            creator_sum += c.amount;
        }

        if platform_fee_amount + creator_sum != total_amount {
            panic!("amounts do not sum to total_amount");
        }

        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }

        // ── 4. Ambil config dari storage (bukan dari parameter) ───────────
        //
        // FIX MEDIUM: usdc_sac dan fee_address diambil dari storage yang
        // sudah di-set saat initialize(). Backend tidak bisa salah kirim alamat.
        let usdc_sac: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcSac)
            .expect("usdc sac not set");

        let fee_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeAddress)
            .expect("fee address not set");

        let usdc = token::Client::new(&env, &usdc_sac);

        // ── 5. Transfer fee ke platform treasury (5%) ─────────────────────
        if platform_fee_amount > 0 {
            usdc.transfer(&platform, &fee_address, &platform_fee_amount);
        }

        // ── 6. Transfer ke semua creator (total 95%) ──────────────────────
        for c in creators.iter() {
            if c.amount > 0 {
                usdc.transfer(&platform, &c.address, &c.amount);
            }
        }

        // ── 7. Tandai order sebagai settled ───────────────────────────────
        //
        // Simpan order_id di persistent storage supaya tidak bisa di-settle lagi.
        // Persistent storage bertahan walau contract di-upgrade.
        env.storage().persistent().set(&settled_key, &true);
        env.storage().persistent().extend_ttl(&settled_key, 518400, 518400); // ~30 hari

        // ── 8. Emit event ─────────────────────────────────────────────────
        //
        // FIX MINOR: Payload sekarang total_amount (bukan platform address).
        // Backend yang subscribe event ini bisa langsung tahu berapa yang di-settle.
        env.events().publish(
            (Symbol::new(&env, "settled"), order_id),
            total_amount,
        );

        // Perpanjang TTL contract
        env.storage().instance().extend_ttl(17280, 17280);
    }

    // ─── Helpers (untuk backend dan verifikasi) ───────────────────────────

    /// Cek apakah order sudah di-settle (dipanggil backend sebelum retry)
    pub fn is_settled(env: Env, order_id: String) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Settled(order_id))
    }

    /// Kembalikan platform address yang terdaftar
    pub fn get_platform(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Platform)
            .expect("not initialized")
    }

    /// Kembalikan USDC SAC address yang dipakai contract ini
    pub fn get_usdc_sac(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::UsdcSac)
            .expect("not initialized")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test;
