/**
 * Contract event parsing and display.
 *
 * Extracts SettlementExecuted and RecipientPaid events from a Soroban
 * getTransaction response. Falls back to SAC transfer events when our
 * contract's custom events are not available in the receipt.
 */

import { scValToNative } from '@stellar/stellar-sdk';
import type { RecipientPaidEvent, SettleResult, SettlementExecutedEvent } from '../types/index.js';
import { formatUsdc } from './formatter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Event parsing from getTransaction receipt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all contract events from a getTransaction receipt.
 * Supports both the legacy `events` array format and the v16 XDR format
 * where events are in `events.contractEventsXdr[]`.
 */
export function extractRawEvents(receipt: any): any[] {
  // If events is a plain array, use it directly
  if (Array.isArray(receipt.events)) {
    return receipt.events;
  }

  // If events has contractEventsXdr (v16 SDK format)
  if (receipt.events?.contractEventsXdr) {
    return Array.from(receipt.events.contractEventsXdr);
  }

  return [];
}

/**
 * Parse a single XDR ContractEvent to extract topics and data as native values.
 *
 * The XDR structure for a ContractEvent (v0) is:
 *   event[0]._attributes = { ext, contractId, type, body }
 *   body._value._attributes = { topics: ScVal[], data: ScVal }
 */
function parseXdrEvent(event: any): { topics: any[]; data: any; contractId: string } | null {
  try {
    // Navigate the XDR structure
    const entry = Array.isArray(event) ? event[0] : event;
    if (!entry?._attributes) return null;

    const attrs = entry._attributes;
    const bodyUnion = attrs.body;
    if (!bodyUnion?._value?._attributes) return null;

    const v0 = bodyUnion._value._attributes;

    const topics: any[] = [];
    if (Array.isArray(v0.topics)) {
      for (const t of v0.topics) {
        try { topics.push(scValToNative(t)); } catch { topics.push('(parse error)'); }
      }
    }

    let data: any = null;
    if (v0.data) {
      try { data = scValToNative(v0.data); } catch { data = '(parse error)'; }
    }

    const contractIdHex = attrs.contractId
      ? Buffer.from(attrs.contractId).toString('hex')
      : '';

    return { topics, data, contractId: contractIdHex };
  } catch {
    return null;
  }
}

/**
 * Parse SettlementExecuted and RecipientPaid events from a successful tx receipt.
 *
 * Tries to find our custom contract events first. Falls back to SAC transfer
 * events if our events aren't available.
 */
export function parseSettlementEvents(
  receipt: any,
): { settlementEvent: SettlementExecutedEvent; recipientEvents: RecipientPaidEvent[] } {
  const rawEvents = extractRawEvents(receipt);

  // Try to find our custom events (SettlementExecuted, RecipientPaid)
  const ourEvents: any[] = [];
  const sacEvents: any[] = [];

  for (const raw of rawEvents) {
    const parsed = parseXdrEvent(raw);
    if (!parsed) continue;

    const firstTopic = parsed.topics[0];
    if (firstTopic === 'settlement' || firstTopic === 'recipient') {
      ourEvents.push(parsed);
    } else if (firstTopic === 'transfer') {
      sacEvents.push(parsed);
    }
  }

  // If we found our custom events, parse them
  if (ourEvents.length > 0) {
    return parseOurEvents(ourEvents);
  }

  // Fallback: use SAC transfer events + compute expected split
  if (sacEvents.length > 0) {
    return parseFromSacEvents(sacEvents);
  }

  // Last resort: compute from known values in the receipt returnValue
  return parseFromReturnValue(receipt);
}

function parseOurEvents(events: any[]): { settlementEvent: SettlementExecutedEvent; recipientEvents: RecipientPaidEvent[] } {
  let settlementEvent: SettlementExecutedEvent | undefined;
  const recipientEvents: RecipientPaidEvent[] = [];

  for (const ev of events) {
    if (ev.topics[0] === 'settlement') {
      // Extract from data map
      const data = ev.data;
      if (typeof data === 'object' && data !== null) {
        const map = data instanceof Map ? data : new Map(Object.entries(data));
        settlementEvent = {
          totalAmount: toBigInt(map.get('total_amount')),
          platformFeeAmount: toBigInt(map.get('platform_fee_amount')),
          creatorPoolAmount: toBigInt(map.get('creator_pool_amount')),
          recipientCount: toNumber(map.get('recipient_count')),
        };
      }
    } else if (ev.topics[0] === 'recipient') {
      const data = ev.data;
      if (typeof data === 'object' && data !== null) {
        const map = data instanceof Map ? data : new Map(Object.entries(data));
        recipientEvents.push({
          address: toString(map.get('address')),
          amount: toBigInt(map.get('amount')),
        });
      }
    }
  }

  if (!settlementEvent) {
    throw new Error('SettlementExecuted event not found in contract events');
  }

  return { settlementEvent, recipientEvents };
}

function parseFromSacEvents(sacEvents: any[]): { settlementEvent: SettlementExecutedEvent; recipientEvents: RecipientPaidEvent[] } {
  // SAC transfer events have topics: ["transfer", from, to, asset]
  // and data: amount (i128)
  const totalTransferred = sacEvents.reduce((sum: bigint, ev: any) => sum + toBigInt(ev.data), 0n);

  // We can't know the split from SAC events alone, so return a placeholder
  const recipientEvents: RecipientPaidEvent[] = sacEvents.map((ev: any) => ({
    address: toString(ev.topics[2] ?? ''),
    amount: toBigInt(ev.data),
  }));

  const totalAmount = totalTransferred; // approximate — doesn't include the retained fee
  const platformFeeAmount = 0n;
  const creatorPoolAmount = totalAmount;

  return {
    settlementEvent: {
      totalAmount,
      platformFeeAmount,
      creatorPoolAmount,
      recipientCount: recipientEvents.length,
    },
    recipientEvents,
  };
}

function parseFromReturnValue(receipt: any): { settlementEvent: SettlementExecutedEvent; recipientEvents: RecipientPaidEvent[] } {
  // When no events are available, return the raw return value if present
  // or an empty result
  const returnVal = receipt.returnValue;
  if (returnVal) {
    try {
      const native = scValToNative(returnVal);
      if (typeof native === 'object' && native !== null) {
        const map = native instanceof Map ? native : new Map(Object.entries(native));
        return {
          settlementEvent: {
            totalAmount: toBigInt(map.get('total_amount')),
            platformFeeAmount: toBigInt(map.get('platform_fee_amount')),
            creatorPoolAmount: toBigInt(map.get('creator_pool_amount')),
            recipientCount: toNumber(map.get('recipient_count')),
          },
          recipientEvents: [],
        };
      }
    } catch { /* fall through */ }
  }

  return {
    settlementEvent: {
      totalAmount: 0n,
      platformFeeAmount: 0n,
      creatorPoolAmount: 0n,
      recipientCount: 0,
    },
    recipientEvents: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type coercion helpers
// ─────────────────────────────────────────────────────────────────────────────

function toBigInt(val: any): bigint {
  if (val === undefined || val === null) return 0n;
  try { return BigInt(val); } catch { return 0n; }
}

function toNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  try { return Number(val); } catch { return 0; }
}

function toString(val: any): string {
  if (!val) return 'unknown';
  return String(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pretty-print a settlement result table.
 */
export function printSettlementTable(
  log: {
    field: (label: string, value: string | number | bigint) => void;
    divider: () => void;
    blank: () => void;
  },
  orderRef: string,
  result: SettleResult,
): void {
  log.field('Order', orderRef);
  log.divider();
  log.field('Platform Fee', `${formatUsdc(result.settlementEvent.platformFeeAmount)} USDC`);
  log.field('Creator Pool', `${formatUsdc(result.settlementEvent.creatorPoolAmount)} USDC`);
  log.divider();
  log.field('Transfers', '');
  for (const ev of result.recipientEvents) {
    const short = ev.address.length > 12 ? `${ev.address.slice(0, 12)}...` : ev.address;
    log.field(`  ${short}`, `${formatUsdc(ev.amount)} USDC`);
  }
  log.divider();
  log.field('Transaction', result.txHash);
  log.blank();
}
