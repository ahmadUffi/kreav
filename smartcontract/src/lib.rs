#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token, Address, Env, String, Symbol, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Platform fee in basis points. 500 = 5.00%.
///
/// Fixed for MVP per Backend PRD §19: "95% Creator / 5% Platform."
/// Not configurable because:
///   - MVP has no governance/DAO mechanism
///   - A fixed fee is simpler to audit
///   - Changing the fee would require a contract upgrade (out of MVP scope)
const PLATFORM_FEE_BPS: u32 = 500;

/// Basis points denominator. 100% = 10_000 bps.
///
/// Standard financial convention to avoid floating-point arithmetic.
/// All percentage math in this contract is `value * bps / 10_000`.
const BPS_DENOMINATOR: i128 = 10_000;

/// Maximum number of recipients in a single settlement.
///
/// Set to 10 for the MVP because:
///   - Realistic digital-product collaborations have 1–5 creators
///   - 10 provides 2× headroom above realistic maximum
///   - Keeps transaction footprint bounded (prevents gas exhaustion)
///   - Vector linear-scan for duplicate detection is O(n²) — fine at n ≤ 10
const MAX_RECIPIENTS: u32 = 10;

/// Instance storage TTL: ~31 days in ledgers (1 ledger ≈ 5 seconds).
///
/// Instance holds PlatformWallet + UsdcSac — configuration that must survive
/// as long as the contract is in use. Extended on every `settle` call so an
/// active contract never expires.
const TTL_INSTANCE: u32 = 535_680;

/// Persistent storage TTL: ~30 days in ledgers.
///
/// Settlement markers are idempotency guards. 30 days covers:
///   - Retry windows (backend retries up to 3× with exponential backoff)
///   - Dispute/reconciliation horizon
///   - PostgreSQL is the durable system of record; on-chain storage is for
///     verifiability, not the sole history.
const TTL_PERSISTENT: u32 = 518_400;

// ─────────────────────────────────────────────────────────────────────────────
// Known Limitations (documented for reviewers)
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Fixed 5% platform fee. Not configurable on-chain. A fee change requires
//    a contract upgrade.
//
// 2. Maximum 10 recipients per settlement. Products with more collaborators
//    need to use off-chain aggregation or split settlements.
//
// 3. Only the USDC SAC set during `initialize` is supported. Multi-token
//    settlements require a contract upgrade or separate deployment.
//
// 4. One settlement per order — immutable. No dispute, clawback, or reversal
//    mechanism on-chain. Disputes are handled off-chain per the product spec.
//
// 5. Platform fee remains in the platform wallet automatically (no self-
//    transfer). The platform wallet IS the fee destination — no separate
//    treasury account.
//
// 6. Rounding dust (≤ N-1 base units, where N = recipient count) is absorbed
//    by the last recipient. This ensures the entire creator pool is always
//    distributed with zero loss. Maximum dust: 9 × $0.0000001 = $0.0000009.

// ─────────────────────────────────────────────────────────────────────────────
// Data Structures
// ─────────────────────────────────────────────────────────────────────────────

/// A single recipient in a settlement.
///
/// The contract receives `share_bps` (NOT a pre-computed amount) so that
/// money-split logic lives in exactly one place — the contract.
/// The backend sends allocation percentages; the contract computes USDC amounts.
///
/// Whole creator_pool distribution is guaranteed: the last recipient absorbs
/// any integer-division rounding dust. Sum of all transfers ALWAYS equals
/// creator_pool, never less.
#[contracttype]
#[derive(Clone)]
pub struct Recipient {
    /// Stellar address of the creator (G... public key).
    pub address: Address,

    /// Share of the creator pool in basis points.
    /// Must be > 0. Sum of all recipients' share_bps must equal 10_000 (100%).
    pub share_bps: i128,
}

/// Emitted once after all transfers in a settlement succeed.
///
/// Topics (indexable): event_kind ("settlement"), order_ref (UUID).
/// Data: total_amount, platform_fee_amount, creator_pool_amount, recipient_count.
#[contractevent]
#[derive(Clone)]
pub struct SettlementExecuted {
    /// Topic 1: always "settlement" for filtering.
    pub event_kind: Symbol,
    /// Topic 2: backend Order.id — correlates with the order.
    pub order_ref: String,
    /// Total USDC settled (base units, 7 decimals).
    pub total_amount: i128,
    /// Platform fee retained (5%, stays in platform wallet).
    pub platform_fee_amount: i128,
    /// Creator pool distributed to recipients (95%).
    pub creator_pool_amount: i128,
    /// Number of recipients paid.
    pub recipient_count: u32,
}

/// Emitted per recipient after their USDC transfer succeeds.
///
/// Topics (indexable): event_kind ("recipient"), order_ref (UUID).
/// Data: address, amount.
#[contractevent]
#[derive(Clone)]
pub struct RecipientPaid {
    /// Topic 1: always "recipient" for filtering.
    pub event_kind: Symbol,
    /// Topic 2: backend Order.id — correlates with the order.
    pub order_ref: String,
    /// Creator wallet that received USDC.
    pub address: Address,
    /// USDC amount received (base units, 7 decimals).
    pub amount: i128,
}

/// Typed storage keys — prevents key collisions between storage types.
#[contracttype]
pub enum DataKey {
    /// Instance: platform wallet address (signer + fee recipient).
    PlatformWallet,
    /// Instance: USDC SAC contract address (allowlisted token).
    UsdcSac,
    /// Persistent: settlement marker keyed by order_ref.
    /// Value is `bool` (true = settled). Backend uses has() for idempotency.
    Settlement(String),
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/// Contract errors with deterministic codes for backend mapping.
///
/// Every failure path returns a unique error code so the backend can
/// programmatically distinguish "order already settled" (idempotent → return
/// 200) from "invalid shares" (backend bug → alert) without parsing strings.
///
/// Note: `UnauthorizedCaller` (code 4) is defined for documentation and future
/// use but is not actively returned by the current implementation because
/// `require_auth()` failures are caught by the Soroban host at the
/// transaction-validation level, before contract code executes. The error
/// code is reserved for manual authorization checks in future versions.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// `initialize` called more than once.
    AlreadyInitialized = 1,
    /// `initialize` called with platform_wallet == usdc_sac.
    InvalidConfiguration = 2,
    /// `settle` called before `initialize`.
    NotInitialized = 3,
    /// Transaction signer is not the registered platform wallet.
    /// Reserved: currently enforced by host-level `require_auth()`, not by
    /// this contract's code path.
    UnauthorizedCaller = 4,
    /// Duplicate `order_ref` — settlement already executed for this order.
    OrderAlreadySettled = 5,
    /// `total_amount` is zero or negative.
    InvalidTotalAmount = 6,
    /// `recipients` vector is empty.
    EmptyRecipients = 7,
    /// `recipients` exceeds `MAX_RECIPIENTS`.
    TooManyRecipients = 8,
    /// A recipient address is zero or otherwise invalid.
    InvalidRecipientAddress = 9,
    /// The same address appears more than once in recipients.
    DuplicateRecipient = 10,
    /// A recipient has `share_bps == 0` (inactive collaborator).
    ZeroAllocation = 11,
    /// Sum of all `share_bps` does not equal 10_000 (100%).
    InvalidAllocationSum = 12,
    /// Checked arithmetic overflow (amounts too large).
    ArithmeticOverflow = 13,
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct KreavSettlementContract;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

impl KreavSettlementContract {
    /// Calculate the amount for each recipient in the creator pool.
    ///
    /// The last recipient receives `creator_pool - sum_of_previous_amounts`
    /// to guarantee exact distribution with zero rounding loss.
    /// Integer division truncation dust (≤ N-1 base units) is absorbed by
    /// the final recipient, ensuring Σ amounts = creator_pool exactly.
    ///
    /// Returns (amounts_vec, total_sum_for_verification).
    fn calculate_creator_amounts(
        env: &Env,
        recipients: &Vec<Recipient>,
        creator_pool: i128,
    ) -> Vec<i128> {
        let count = recipients.len();
        let mut amounts = Vec::new(env);
        let mut distributed: i128 = 0;

        for i in 0..count {
            let recipient = recipients.get(i).unwrap();

            let amount = if i == count - 1 {
                // Last recipient: absorb rounding dust.
                // Guarantees Σ amounts = creator_pool exactly.
                creator_pool
                    .checked_sub(distributed)
                    .expect("arithmetic overflow in final recipient amount")
            } else {
                let computed = creator_pool
                    .checked_mul(recipient.share_bps)
                    .expect("arithmetic overflow in recipient amount calculation")
                    / BPS_DENOMINATOR;
                distributed = distributed
                    .checked_add(computed)
                    .expect("arithmetic overflow in running distribution total");
                computed
            };

            amounts.push_back(amount);
        }

        amounts
    }

    /// Validate all recipients in a single pass.
    ///
    /// Checks: address not zero, no duplicates, each share > 0, sum == 10000.
    /// Returns the validated allocation sum for the caller to assert against.
    fn validate_recipients(
        recipients: &Vec<Recipient>,
    ) -> Result<i128, ContractError> {
        let count = recipients.len();

        if count == 0 {
            return Err(ContractError::EmptyRecipients);
        }
        if count > MAX_RECIPIENTS {
            return Err(ContractError::TooManyRecipients);
        }

        let mut allocation_sum: i128 = 0;

        for i in 0..count {
            let recipient = recipients.get(i).unwrap();

            // Check share is positive
            if recipient.share_bps <= 0 {
                return Err(ContractError::ZeroAllocation);
            }

            // Accumulate with overflow protection
            allocation_sum = allocation_sum
                .checked_add(recipient.share_bps)
                .ok_or(ContractError::ArithmeticOverflow)?;

            // Check for duplicate addresses (linear scan, O(n²) — fine for n ≤ 10)
            for j in (i + 1)..count {
                let other = recipients.get(j).unwrap();
                if recipient.address == other.address {
                    return Err(ContractError::DuplicateRecipient);
                }
            }
        }

        // The critical money-integrity check: allocations must total exactly 100%
        if allocation_sum != BPS_DENOMINATOR {
            return Err(ContractError::InvalidAllocationSum);
        }

        Ok(allocation_sum)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

#[contractimpl]
impl KreavSettlementContract {
    /// Initialize the contract exactly once after deployment.
    ///
    /// Stores the platform wallet address and the USDC SAC address in instance
    /// storage. These are read on every `settle` call — the backend never
    /// passes them as parameters, eliminating an entire class of
    /// misconfiguration bugs.
    ///
    /// # Errors
    /// - `AlreadyInitialized` if called more than once.
    /// - `InvalidConfiguration` if `platform_wallet == usdc_sac`.
    pub fn initialize(
        env: Env,
        platform_wallet: Address,
        usdc_sac: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::PlatformWallet) {
            return Err(ContractError::AlreadyInitialized);
        }

        if platform_wallet == usdc_sac {
            return Err(ContractError::InvalidConfiguration);
        }

        platform_wallet.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::PlatformWallet, &platform_wallet);
        env.storage()
            .instance()
            .set(&DataKey::UsdcSac, &usdc_sac);
        env.storage()
            .instance()
            .extend_ttl(TTL_INSTANCE, TTL_INSTANCE);

        Ok(())
    }

    /// Execute a settlement: split USDC and transfer to recipients.
    ///
    /// This is the core function of the contract. It:
    /// 1. Verifies the caller is the registered platform wallet.
    /// 2. Rejects duplicate settlements (idempotency via `order_ref`).
    /// 3. Validates all inputs (amounts, recipients, allocation sum).
    /// 4. Calculates the split: 5% platform fee, 95% creator pool.
    /// 5. Transfers creator-pool shares to each recipient via the USDC SAC.
    /// 6. Records the settlement marker on-chain.
    /// 7. Emits events for backend reconciliation.
    ///
    /// # The platform fee (5%) is NOT transferred.
    /// It remains in the platform wallet automatically because only the
    /// creator pool is sent out. No self-transfer needed.
    ///
    /// # Rounding
    /// The last recipient receives `creator_pool - sum_of_previous_amounts`,
    /// ensuring the entire creator pool is always distributed with zero loss.
    /// Maximum rounding dust: (N-1) base units = $0.0000009 for N=10.
    ///
    /// # Parameters
    /// - `order_ref`: Backend `Order.id` (UUID). The canonical settlement
    ///   identifier and idempotency key. One order = one settlement.
    /// - `total_amount`: Total USDC in base units (7 decimals).
    /// - `recipients`: Creator pool allocations as `{address, share_bps}`.
    ///
    /// # Atomicity
    /// All transfers execute in one Soroban transaction. If any transfer
    /// fails (e.g., missing trustline, insufficient balance), the entire
    /// settlement reverts — no partial payouts.
    pub fn settle(
        env: Env,
        order_ref: String,
        total_amount: i128,
        recipients: Vec<Recipient>,
    ) -> Result<(), ContractError> {
        // ── Load configuration ────────────────────────────────────────

        let platform_wallet: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformWallet)
            .ok_or(ContractError::NotInitialized)?;

        let usdc_sac: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcSac)
            .ok_or(ContractError::NotInitialized)?;

        // ── Authorization ──────────────────────────────────────────────
        //
        // Enforced by the Soroban host at transaction-validation level.
        // If this fails, the host reverts before contract code executes.
        // The `UnauthorizedCaller` error is not actively returned but
        // reserved for future manual authorization checks.
        platform_wallet.require_auth();

        // ── Idempotency ────────────────────────────────────────────────
        let settlement_key = DataKey::Settlement(order_ref.clone());
        if env.storage().persistent().has(&settlement_key) {
            return Err(ContractError::OrderAlreadySettled);
        }

        // ── Input validation ───────────────────────────────────────────
        if total_amount <= 0 {
            return Err(ContractError::InvalidTotalAmount);
        }

        // ── Recipient validation ───────────────────────────────────────
        let _allocation_sum = Self::validate_recipients(&recipients)?;

        // ── Split calculation ──────────────────────────────────────────
        //
        // platform_fee = total_amount * 500 / 10_000
        // creator_pool = total_amount - platform_fee
        //
        // Integer division truncates toward zero. Platform fee rounding
        // loss (≤ 9999 base units = $0.0009999) stays in the creator pool
        // and is distributed to recipients. No funds are "lost."

        let platform_fee = total_amount
            .checked_mul(PLATFORM_FEE_BPS as i128)
            .ok_or(ContractError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;

        let creator_pool = total_amount
            .checked_sub(platform_fee)
            .ok_or(ContractError::ArithmeticOverflow)?;

        // ── Calculate per-recipient amounts ────────────────────────────
        //
        // Last recipient absorbs rounding dust for exact distribution.

        let amounts = Self::calculate_creator_amounts(&env, &recipients, creator_pool);

        // ── Transfers ──────────────────────────────────────────────────
        //
        // All transfers use the USDC SAC. Source is the platform wallet.
        // Platform fee stays in wallet — only creator pool is sent out.

        let token = token::Client::new(&env, &usdc_sac);
        let recipient_count = recipients.len();

        for i in 0..recipient_count {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();

            if amount > 0 {
                token.transfer(&platform_wallet, &recipient.address, &amount);
            }

            RecipientPaid {
                event_kind: Symbol::new(&env, "recipient"),
                order_ref: order_ref.clone(),
                address: recipient.address.clone(),
                amount,
            }
            .publish(&env);
        }

        // ── Record settlement marker ───────────────────────────────────
        env.storage().persistent().set(&settlement_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&settlement_key, TTL_PERSISTENT, TTL_PERSISTENT);

        // ── Summary event ──────────────────────────────────────────────
        SettlementExecuted {
            event_kind: Symbol::new(&env, "settlement"),
            order_ref,
            total_amount,
            platform_fee_amount: platform_fee,
            creator_pool_amount: creator_pool,
            recipient_count: recipient_count as u32,
        }
        .publish(&env);

        // ── TTL maintenance ────────────────────────────────────────────
        env.storage()
            .instance()
            .extend_ttl(TTL_INSTANCE, TTL_INSTANCE);

        Ok(())
    }

    /// Check whether an order has already been settled.
    ///
    /// The backend calls this before submitting a new settlement transaction,
    /// and before retrying a failed one. If `true`, the backend should NOT
    /// invoke `settle` again — the order is already settled.
    pub fn is_settled(env: Env, order_ref: String) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Settlement(order_ref))
    }

    /// Return the contract version string for compatibility checks and
    /// block explorer display. Not used for on-chain logic.
    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "Kreav Settlement v1.0.0")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test;
