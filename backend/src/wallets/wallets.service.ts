import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WalletProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';
import { ExplorerService } from '../stellar/explorer.service';

/**
 * WalletsService — BE-008 query logic.
 *
 * Handles balance lookups (via Horizon) and transaction history
 * (via the Settlement/SettlementRecipient tables).
 *
 * No blockchain writes — query-only.
 *
 * Source: Kreav Backend PRD v3 — §9 Wallet APIs.
 */
@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly horizon: HorizonService,
    private readonly explorer: ExplorerService,
  ) {}

  /**
   * Get the USDC balance and account status for a Stellar wallet address.
   *
   * Delegates to HorizonService.getUsdcBalance() which handles:
   * - Account not funded → accountExists=false, balance "0"
   * - No USDC trustline → hasUsdcTrustline=false, balance "0"
   * - Funded + trustlined → live balance from Horizon
   */
  async getBalance(address: string): Promise<{
    address: string;
    balanceUsd: string;
    hasUsdcTrustline: boolean;
    accountExists: boolean;
  }> {
    const result = await this.horizon.getUsdcBalance(address);

    return {
      address,
      balanceUsd: result.balanceUsd,
      hasUsdcTrustline: result.hasUsdcTrustline,
      accountExists: result.accountExists,
    };
  }

  /**
   * Get settlement transaction history for a wallet address.
   *
   * Queries the SettlementRecipient table (joined with Settlement) for all
   * records matching the given wallet address, ordered newest-first.
   *
   * Returns paginated results.
   */
  async getTransactions(
    address: string,
    page: number,
    limit: number,
  ): Promise<{
    address: string;
    transactions: Array<{
      id: string;
      kind: 'SETTLEMENT' | 'WITHDRAWAL';
      direction: 'credit' | 'debit';
      orderId: string;
      txHash: string;
      explorerLink: string;
      totalAmount: string;
      amount: string;
      recipientType: string;
      role: string;
      percentage: string;
      destination: string;
      status: string;
      createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const skip = (page - 1) * limit;

    // toFixed(2) matches the DecimalToStringInterceptor convention — "9.50" not "9.5".
    const fmt = (d: { toFixed?: (n: number) => string } | null | undefined): string =>
      d?.toFixed?.(2) ?? String(d);
    const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : String(d));

    // Withdrawals are keyed by creator, settlements by wallet address — resolve
    // the creator so we can show BOTH incoming settlements and outgoing
    // withdrawals in one merged, newest-first history.
    const walletRow = await this.prisma.wallet.findFirst({
      where: { walletAddress: address },
      select: { creatorId: true },
    });

    const [settlementRows, withdrawalRows] = await Promise.all([
      this.prisma.settlementRecipient.findMany({
        where: { walletAddress: address },
        include: {
          settlement: {
            select: { orderId: true, txHash: true, totalAmount: true, status: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      walletRow
        ? this.prisma.withdrawal.findMany({
            // Only COMPLETED withdrawals are real money-out events. An abandoned
            // or in-flight withdrawal (PROCESSING/REQUESTED/FAILED) must NOT show
            // up as a transaction — matches the balance ledger, which also only
            // counts COMPLETED withdrawals.
            where: { creatorId: walletRow.creatorId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma nested include shape is complex
    const settlementTx = settlementRows.map((row: any) => ({
      id: row.id,
      kind: 'SETTLEMENT' as const,
      direction: (row.recipientType === 'CREATOR' ? 'credit' : 'debit') as 'credit' | 'debit',
      orderId: row.settlement.orderId,
      txHash: row.settlement.txHash,
      explorerLink: this.explorer.txUrl(row.settlement.txHash),
      totalAmount: fmt(row.settlement.totalAmount),
      amount: fmt(row.amount),
      recipientType: row.recipientType,
      role: row.role,
      percentage: fmt(row.percentage),
      destination: '',
      status: row.settlement.status,
      createdAt: iso(row.settlement.createdAt),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model shape
    const withdrawalTx = withdrawalRows.map((w: any) => ({
      id: w.id,
      kind: 'WITHDRAWAL' as const,
      direction: 'debit' as const,
      orderId: '',
      txHash: w.txHash ?? '',
      explorerLink: w.txHash ? this.explorer.txUrl(w.txHash) : '',
      totalAmount: fmt(w.amount),
      amount: fmt(w.amount),
      recipientType: '',
      role: '',
      percentage: '',
      destination: w.destinationType,
      status: w.status,
      createdAt: iso(w.createdAt),
    }));

    // Merge both sources, newest-first (createdAt is ISO-8601 → lexical = chrono),
    // then paginate the combined list.
    const merged = [...settlementTx, ...withdrawalTx].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
    const total = merged.length;
    const transactions = merged.slice(skip, skip + limit);

    return {
      address,
      transactions,
      page,
      limit,
      total,
    };
  }

  /**
   * Resolve the connected wallet address for a creator (token-scoped routes).
   *
   * Fase 1: wallet/withdrawal endpoints are scoped by the authenticated user,
   * not by an `?address=` query param — the address is looked up server-side.
   *
   * Throws NotFoundException when the creator has no connected wallet.
   */
  async getAddressForCreator(creatorId: string): Promise<string> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { creatorId },
      orderBy: { connectedAt: 'desc' },
      select: { walletAddress: true },
    });
    if (!wallet) {
      throw new NotFoundException('No wallet connected to this account');
    }
    return wallet.walletAddress;
  }

  // ── BE-020: Wallet Connect ───────────────────────────────────────────────

  /**
   * POST /wallets — connect a Stellar wallet to a creator.
   *
   * Validates that the creator exists, checks for duplicate wallet addresses,
   * and creates the wallet record. Non-custodial: stores only the public key.
   *
   * Throws:
   *   NotFoundException — creatorId does not match any user
   *   ConflictException — walletAddress is already connected to a creator
   */
  async connect(
    creatorId: string,
    walletAddress: string,
    provider: WalletProvider,
  ): Promise<{
    id: string;
    creatorId: string;
    walletAddress: string;
    provider: string;
    connectedAt: string;
  }> {
    // Verify the creator exists.
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });
    if (!creator) {
      throw new NotFoundException(`Creator with id ${creatorId} not found`);
    }

    // Check for duplicate wallet address.
    const existing = await this.prisma.wallet.findFirst({
      where: { walletAddress },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Wallet ${walletAddress} is already connected to another account`,
      );
    }

    const wallet = await this.prisma.wallet.create({
      data: { creatorId, walletAddress, provider },
      select: {
        id: true,
        creatorId: true,
        walletAddress: true,
        provider: true,
        connectedAt: true,
      },
    });

    this.logger.log(`Wallet connected: ${wallet.id} (${walletAddress}, ${provider})`);

    return {
      id: wallet.id,
      creatorId: wallet.creatorId,
      walletAddress: wallet.walletAddress,
      provider: wallet.provider,
      connectedAt:
        wallet.connectedAt instanceof Date
          ? wallet.connectedAt.toISOString()
          : String(wallet.connectedAt),
    };
  }
}
