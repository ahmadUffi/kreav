// Comprehensive test suite for KreavSettlementContract.
//
// Run: cargo test
//
// Tests are organized by function under test:
//   initialize  — configuration storage and guards
//   settle      — validation, authorization, idempotency, arithmetic, transfers,
//                 rounding, insufficient balance, boundary
//   is_settled  — idempotency read helper
//   get_version — metadata

#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token,
    vec,
    Address, Env, String,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Full setup with initialized contract and registered USDC SAC.
fn setup() -> (
    Env,
    KreavSettlementContractClient<'static>,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(KreavSettlementContract, ());
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    let platform = Address::generate(&env);
    let usdc_admin = Address::generate(&env);
    let usdc_sac = env
        .register_stellar_asset_contract_v2(usdc_admin)
        .address();

    client.initialize(&platform, &usdc_sac);

    (env, client, platform, usdc_sac)
}

/// Setup WITHOUT initialization — for testing `settle` before `initialize`.
fn setup_uninitialized() -> (Env, KreavSettlementContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(KreavSettlementContract, ());
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    (env, client)
}

/// Mint USDC to the platform wallet so it has enough balance for transfers.
fn fund_platform(env: &Env, usdc_sac: &Address, platform: &Address, amount: i128) {
    let usdc_admin = token::StellarAssetClient::new(env, usdc_sac);
    usdc_admin.mint(platform, &amount);
}

/// Get the USDC balance of an address.
fn balance_of(env: &Env, usdc_sac: &Address, address: &Address) -> i128 {
    let token = token::Client::new(env, usdc_sac);
    token.balance(address)
}

/// Create a single-creator recipients vec (100% of creator pool).
fn single_creator(env: &Env) -> (Vec<Recipient>, Address) {
    let creator = Address::generate(env);
    let recipients = vec![
        env,
        Recipient {
            address: creator.clone(),
            share_bps: 10_000,
        },
    ];
    (recipients, creator)
}

/// Create a multi-collaborator recipients vec (70/20/10 split of creator pool).
fn multi_collaborators(env: &Env) -> (Vec<Recipient>, Address, Address, Address) {
    let creator_a = Address::generate(env);
    let creator_b = Address::generate(env);
    let creator_c = Address::generate(env);
    let recipients = vec![
        env,
        Recipient {
            address: creator_a.clone(),
            share_bps: 7_000,
        },
        Recipient {
            address: creator_b.clone(),
            share_bps: 2_000,
        },
        Recipient {
            address: creator_c.clone(),
            share_bps: 1_000,
        },
    ];
    (recipients, creator_a, creator_b, creator_c)
}

// ─────────────────────────────────────────────────────────────────────────────
// initialize
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_stores_config() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(KreavSettlementContract, ());
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    let platform = Address::generate(&env);
    let usdc_sac = Address::generate(&env);

    client.initialize(&platform, &usdc_sac);
    // No panic → config stored successfully.
}

#[test]
#[should_panic]
fn test_initialize_double_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(KreavSettlementContract, ());
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    let platform = Address::generate(&env);
    let usdc_sac = Address::generate(&env);

    client.initialize(&platform, &usdc_sac);
    client.initialize(&platform, &usdc_sac); // must panic
}

#[test]
#[should_panic]
fn test_initialize_same_address_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(KreavSettlementContract, ());
    let client = KreavSettlementContractClient::new(&env, &contract_id);

    let same = Address::generate(&env);
    client.initialize(&same, &same);
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — not initialized
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_settle_not_initialized_fails() {
    let (env, client) = setup_uninitialized();

    let creator = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: creator,
            share_bps: 10_000,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — input validation
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_settle_zero_total_amount_fails() {
    let (env, client, _platform, _usdc) = setup();
    let (recipients, _) = single_creator(&env);

    client.settle(&String::from_str(&env, "order-001"), &0_i128, &recipients);
}

#[test]
#[should_panic]
fn test_settle_negative_total_amount_fails() {
    let (env, client, _platform, _usdc) = setup();
    let (recipients, _) = single_creator(&env);

    client.settle(
        &String::from_str(&env, "order-001"),
        &(-1_i128),
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_empty_recipients_fails() {
    let (env, client, _platform, _usdc) = setup();
    let recipients = vec![&env];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_too_many_recipients_fails() {
    let (env, client, _platform, _usdc) = setup();

    let mut recipients = vec![&env];
    for _ in 0..11 {
        let addr = Address::generate(&env);
        recipients.push_back(Recipient {
            address: addr,
            share_bps: 10_000 / 11,
        });
    }

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — recipient validation
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_settle_duplicate_recipient_fails() {
    let (env, client, _platform, _usdc) = setup();

    let same = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: same.clone(),
            share_bps: 5_000,
        },
        Recipient {
            address: same,
            share_bps: 5_000,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_zero_allocation_fails() {
    let (env, client, _platform, _usdc) = setup();

    let creator = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: creator,
            share_bps: 0,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_negative_allocation_fails() {
    let (env, client, _platform, _usdc) = setup();

    let creator = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: creator,
            share_bps: -1,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_allocation_sum_under_100_pct_fails() {
    let (env, client, _platform, _usdc) = setup();

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: a,
            share_bps: 5_000,
        },
        Recipient {
            address: b,
            share_bps: 4_999,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

#[test]
#[should_panic]
fn test_settle_allocation_sum_over_100_pct_fails() {
    let (env, client, _platform, _usdc) = setup();

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let recipients = vec![
        &env,
        Recipient {
            address: a,
            share_bps: 5_000,
        },
        Recipient {
            address: b,
            share_bps: 5_001,
        },
    ];

    client.settle(
        &String::from_str(&env, "order-001"),
        &100_000_000_i128,
        &recipients,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — idempotency
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_settle_double_settle_fails() {
    let (env, client, platform, usdc_sac) = setup();
    fund_platform(&env, &usdc_sac, &platform, 100_000_000);

    let (recipients, _) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-double");

    client.settle(&order_ref, &100_000_000_i128, &recipients);
    client.settle(&order_ref, &100_000_000_i128, &recipients);
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — happy path: single creator (the demo case)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_happy_path_single_creator() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 100_000_000; // 10.0000000 USDC
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let (recipients, creator) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-demo");

    assert_eq!(balance_of(&env, &usdc_sac, &platform), total_amount);
    assert_eq!(balance_of(&env, &usdc_sac, &creator), 0);

    client.settle(&order_ref, &total_amount, &recipients);

    // 5% platform fee (0.50 USDC), 95% creator (9.50 USDC)
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 5_000_000);
    assert_eq!(balance_of(&env, &usdc_sac, &creator), 95_000_000);
    assert!(client.is_settled(&order_ref));
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — happy path: multi collaborator
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_happy_path_multi_collaborator() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 100_000_000; // 10.0000000 USDC
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let (recipients, creator_a, creator_b, creator_c) = multi_collaborators(&env);
    let order_ref = String::from_str(&env, "order-multi");

    client.settle(&order_ref, &total_amount, &recipients);

    // platform_fee  = 100_000_000 * 500 / 10000 = 5_000_000
    // creator_pool  = 95_000_000
    // Creator A (70%): 95_000_000 * 7000 / 10000 = 66_500_000
    // Creator B (20%): 95_000_000 * 2000 / 10000 = 19_000_000
    // Creator C (10%): 95_000_000 * 1000 / 10000 =  9_500_000

    assert_eq!(balance_of(&env, &usdc_sac, &platform), 5_000_000);
    assert_eq!(balance_of(&env, &usdc_sac, &creator_a), 66_500_000);
    assert_eq!(balance_of(&env, &usdc_sac, &creator_b), 19_000_000);
    assert_eq!(balance_of(&env, &usdc_sac, &creator_c), 9_500_000);

    let all = balance_of(&env, &usdc_sac, &platform)
        + balance_of(&env, &usdc_sac, &creator_a)
        + balance_of(&env, &usdc_sac, &creator_b)
        + balance_of(&env, &usdc_sac, &creator_c);
    assert_eq!(all, total_amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — rounding dust (issue #5 from PM review)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_rounding_dust_distributes_exactly() {
    let (env, client, platform, usdc_sac) = setup();

    // Use a small total where rounding is visible.
    // total = 100 base units ($0.0000100)
    // platform_fee = 100 * 500 / 10000 = 5
    // creator_pool = 95
    //
    // 3 recipients at 3333 / 3333 / 3334 bps:
    //   A: 95 * 3333 / 10000 = 31 (truncated from 31.66)
    //   B: 95 * 3333 / 10000 = 31
    //   C: 95 - 62 = 33  (last recipient absorbs dust)
    //   Total: 31 + 31 + 33 = 95 ✓

    let total_amount: i128 = 100;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    let recipients = vec![
        &env,
        Recipient {
            address: a.clone(),
            share_bps: 3_333,
        },
        Recipient {
            address: b.clone(),
            share_bps: 3_333,
        },
        Recipient {
            address: c.clone(),
            share_bps: 3_334,
        },
    ];

    let order_ref = String::from_str(&env, "order-rounding");
    client.settle(&order_ref, &total_amount, &recipients);

    // Platform fee stays: 5 base units
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 5);

    // First two recipients get truncated amounts
    assert_eq!(balance_of(&env, &usdc_sac, &a), 31);
    assert_eq!(balance_of(&env, &usdc_sac, &b), 31);

    // Last recipient absorbs dust: 95 - 31 - 31 = 33
    assert_eq!(balance_of(&env, &usdc_sac, &c), 33);

    // Total distributed = 31 + 31 + 33 = 95 = creator_pool ✓
    let distributed = balance_of(&env, &usdc_sac, &a)
        + balance_of(&env, &usdc_sac, &b)
        + balance_of(&env, &usdc_sac, &c);
    assert_eq!(distributed, 95);

    // Platform balance + distributed = original total
    assert_eq!(balance_of(&env, &usdc_sac, &platform) + distributed, total_amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — insufficient balance (issue #8 from PM review)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_settle_insufficient_balance_fails() {
    let (env, client, platform, usdc_sac) = setup();

    // Fund only 5 USDC, but try to settle 10 USDC
    fund_platform(&env, &usdc_sac, &platform, 50_000_000);

    let (recipients, _) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-insufficient");

    // Attempt to settle 10 USDC — should fail during SAC transfer
    client.settle(&order_ref, &100_000_000_i128, &recipients);
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — boundary: exactly MAX_RECIPIENTS (10) succeeds
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_exactly_max_recipients_succeeds() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 100_000_000;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    // 10 recipients, each 10% of creator pool (1000 bps each)
    let mut recipients = vec![&env];
    for _ in 0..10 {
        let addr = Address::generate(&env);
        recipients.push_back(Recipient {
            address: addr,
            share_bps: 1_000,
        });
    }

    let order_ref = String::from_str(&env, "order-boundary");
    client.settle(&order_ref, &total_amount, &recipients);

    // Verify platform fee retained
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 5_000_000);
    assert!(client.is_settled(&order_ref));
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — events
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_emits_events() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 100_000_000;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let (recipients, _creator_a, _creator_b, _creator_c) = multi_collaborators(&env);
    let order_ref = String::from_str(&env, "order-events");

    client.settle(&order_ref, &total_amount, &recipients);

    let events = env.events().all();
    let event_count = events.events().len();
    assert!(
        event_count >= 4,
        "expected at least 4 events (3 recipient + 1 settlement), got {}",
        event_count
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// settle — edge cases
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_settle_tiny_amount_rounding() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 1;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let (recipients, creator) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-tiny");

    client.settle(&order_ref, &total_amount, &recipients);

    // Fee rounds to 0, creator gets full amount
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 0);
    assert_eq!(balance_of(&env, &usdc_sac, &creator), 1);
}

#[test]
fn test_settle_small_amount_fee_rounds_down() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 19_999;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let (recipients, creator) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-small");

    client.settle(&order_ref, &total_amount, &recipients);

    // platform_fee = 19_999 * 500 / 10_000 = 999 (integer division)
    // creator_pool = 19_999 - 999 = 19_000
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 999);
    assert_eq!(balance_of(&env, &usdc_sac, &creator), 19_000);
}

#[test]
fn test_settle_with_multiple_recipients_same_amount() {
    let (env, client, platform, usdc_sac) = setup();

    let total_amount: i128 = 100_000_000;
    fund_platform(&env, &usdc_sac, &platform, total_amount);

    let mut alloc = vec![&env];
    for _ in 0..4 {
        let addr = Address::generate(&env);
        alloc.push_back(Recipient {
            address: addr,
            share_bps: 2_500,
        });
    }

    let order_ref = String::from_str(&env, "order-equal");

    client.settle(&order_ref, &total_amount, &alloc);

    // 4 × 25% = 100%, platform fee = 5%, each creator gets 23.75 USDC
    assert_eq!(balance_of(&env, &usdc_sac, &platform), 5_000_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// is_settled
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_is_settled_returns_false_for_new_order() {
    let (env, client, _platform, _usdc) = setup();
    let order_ref = String::from_str(&env, "nonexistent-order");
    assert!(!client.is_settled(&order_ref));
}

#[test]
fn test_is_settled_returns_true_after_settlement() {
    let (env, client, platform, usdc_sac) = setup();
    fund_platform(&env, &usdc_sac, &platform, 100_000_000);

    let (recipients, _) = single_creator(&env);
    let order_ref = String::from_str(&env, "order-check");

    assert!(!client.is_settled(&order_ref));
    client.settle(&order_ref, &100_000_000_i128, &recipients);
    assert!(client.is_settled(&order_ref));
}

#[test]
fn test_is_settled_different_orders_independent() {
    let (env, client, platform, usdc_sac) = setup();
    fund_platform(&env, &usdc_sac, &platform, 100_000_000);

    let (recipients, _) = single_creator(&env);
    let order_a = String::from_str(&env, "order-A");
    let order_b = String::from_str(&env, "order-B");

    client.settle(&order_a, &100_000_000_i128, &recipients);

    assert!(client.is_settled(&order_a));
    assert!(!client.is_settled(&order_b));
}

// ─────────────────────────────────────────────────────────────────────────────
// get_version
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_get_version_returns_expected_string() {
    let (env, client, _platform, _usdc) = setup();
    let version = client.get_version();
    assert_eq!(version, String::from_str(&env, "Kreav Settlement v1.0.0"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract error enum integrity
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_contract_error_discriminants_are_unique() {
    let errors = [
        ContractError::AlreadyInitialized as u32,
        ContractError::InvalidConfiguration as u32,
        ContractError::NotInitialized as u32,
        ContractError::UnauthorizedCaller as u32,
        ContractError::OrderAlreadySettled as u32,
        ContractError::InvalidTotalAmount as u32,
        ContractError::EmptyRecipients as u32,
        ContractError::TooManyRecipients as u32,
        ContractError::InvalidRecipientAddress as u32,
        ContractError::DuplicateRecipient as u32,
        ContractError::ZeroAllocation as u32,
        ContractError::InvalidAllocationSum as u32,
        ContractError::ArithmeticOverflow as u32,
    ];

    for i in 0..errors.len() {
        for j in (i + 1)..errors.len() {
            assert_ne!(
                errors[i], errors[j],
                "duplicate error code: {}",
                errors[i]
            );
        }
    }
}

#[test]
fn test_contract_error_count_is_13() {
    assert_eq!(ContractError::ArithmeticOverflow as u32, 13);
}
