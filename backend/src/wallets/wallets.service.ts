import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly horizon: HorizonService,
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
}
