import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
      orderId: string;
      txHash: string;
      explorerLink: string;
      totalAmount: string;
      amount: string;
      recipientType: string;
      role: string;
      percentage: string;
      status: string;
      createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.settlementRecipient.findMany({
        where: { walletAddress: address },
        include: {
          settlement: {
            select: {
              orderId: true,
              txHash: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlementRecipient.count({
        where: { walletAddress: address },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma nested include shape is complex
    const transactions = rows.map((row: any) => ({
      id: row.id,
      orderId: row.settlement.orderId,
      txHash: row.settlement.txHash,
      explorerLink: this.explorer.txUrl(row.settlement.txHash),
      // toFixed(2) matches the DecimalToStringInterceptor convention — "9.50" not "9.5"
      totalAmount: row.settlement.totalAmount?.toFixed?.(2) ?? String(row.settlement.totalAmount),
      amount: row.amount?.toFixed?.(2) ?? String(row.amount),
      recipientType: row.recipientType,
      role: row.role,
      percentage: row.percentage?.toFixed?.(2) ?? String(row.percentage),
      status: row.settlement.status,
      createdAt:
        row.settlement.createdAt instanceof Date
          ? row.settlement.createdAt.toISOString()
          : String(row.settlement.createdAt),
    }));

    return {
      address,
      transactions,
      page,
      limit,
      total,
    };
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
