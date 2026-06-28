// Unit tests untuk KreavSettlementContract
// Jalankan: cargo test
//
// Catatan: Test dengan SAC transfer aktif membutuhkan token contract.
// Gunakan testnet untuk end-to-end testing yang lengkap.

#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, Env, String};

// ── Helper: setup contract siap pakai ────────────────────────────────────────

fn setup() -> (Env, KreavSettlementContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths(); // mock semua require_auth() agar test tidak perlu signing manual

    let contract_id = env.register_contract(None, KreavSettlementContract);
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    let platform    = Address::generate(&env);
    let usdc_sac    = Address::generate(&env); // mock: test tidak perlu real SAC
    let fee_address = Address::generate(&env);

    // initialize contract
    client.initialize(&platform, &usdc_sac, &fee_address);

    (env, client, platform, usdc_sac, fee_address)
}

// ── Test: initialize ──────────────────────────────────────────────────────────

#[test]
fn test_initialize_stores_platform() {
    let (env, client, platform, _, _) = setup();
    assert_eq!(client.get_platform(), platform);
}

#[test]
#[should_panic(expected = "contract already initialized")]
fn test_double_initialize_fails() {
    let (env, client, platform, usdc_sac, fee_address) = setup();
    // Panggil initialize lagi → harus panic
    client.initialize(&platform, &usdc_sac, &fee_address);
}

// ── Test: is_settled ──────────────────────────────────────────────────────────

#[test]
fn test_order_not_settled_initially() {
    let (env, client, _, _, _) = setup();
    let order_id = String::from_str(&env, "order-001");
    assert_eq!(client.is_settled(&order_id), false);
}

// ── Test: validasi total_amount ───────────────────────────────────────────────
//
// Catatan: test settle_payment() yang melibatkan actual token transfer
// memerlukan token contract yang di-register di env.
// Tes di bawah ini menguji panic cases (tanpa transfer).

#[test]
#[should_panic(expected = "amounts do not sum to total_amount")]
fn test_invalid_total_amount_panics() {
    let (env, client, platform, _, _) = setup();

    let creator = Address::generate(&env);
    let creators = vec![
        &env,
        CreatorShare { address: creator, amount: 9_000_000 }, // 0.9 USDC
    ];

    // platform_fee = 500_000, creators = 9_000_000 → total = 9_500_000
    // tapi total_amount = 10_000_000 → tidak cocok → harus panic
    client.settle_payment(
        &platform,
        &500_000_i128,
        &creators,
        &String::from_str(&env, "order-002"),
        &10_000_000_i128, // angka tidak cocok
    );
}
