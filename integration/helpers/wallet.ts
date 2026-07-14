/**
 * Wallet helpers — SAC balance queries.
 *
 * Reads USDC balances from the Stellar Asset Contract via RPC simulation.
 * The SAC implements SEP-41: balance(Address) → i128.
 */

import { Address, Contract, Keypair, TransactionBuilder, rpc, scValToNative } from '@stellar/stellar-sdk';
import type { AppConfig, BaseUnits, StellarAddress } from '../types/index.js';

/**
 * Fetch the USDC balance for a wallet address via the SAC contract.
 *
 * Builds a minimal transaction with the balance() call, simulates it, and
 * extracts the return value. Uses the platform wallet as the tx source
 * because the source account must exist on-chain with a valid sequence.
 *
 * Returns 0n if the account can't be queried (no trustline, unfunded, etc.).
 */
export async function usdcBalance(
  server: rpc.Server,
  config: AppConfig,
  address: StellarAddress,
): Promise<BaseUnits> {
  const sac = new Contract(config.usdcSac);
  const platformKeypair = Keypair.fromSecret(config.platformSecret);

  try {
    const sourceAccount = await server.getAccount(platformKeypair.publicKey());

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: config.network.passphrase,
    })
      .addOperation(sac.call('balance', new Address(address).toScVal()))
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulated)) {
      return 0n;
    }

    const result = simulated.result;
    if (!result?.retval) return 0n;

    return scValToNative(result.retval) as BaseUnits;
  } catch {
    return 0n;
  }
}
