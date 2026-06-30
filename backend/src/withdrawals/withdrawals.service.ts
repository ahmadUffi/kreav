import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { ExplorerService } from '../stellar/explorer.service';
import { DomainException } from '../common/exceptions/domain.exception';

/**
 * Simulation delay in milliseconds — the time a withdrawal spends in PROCESSING
 * status before the lazy transition moves it to COMPLETED.
 */
const SIMULATION_DELAY_MS = 2_500;

/**
 * WithdrawalsService — BE-009 core.
 *
 * Handles simulated withdrawal requests:
 *   POST /withdrawals     → validate → REQUESTED → PROCESSING → (lazy) COMPLETED
 *   GET  /withdrawals/:id → return receipt with lazy status transition
 *   GET  /withdrawals     → paginated list
 *
 * Key design decisions:
 *   - No setTimeout — status transitions happen lazily on GET /:id reads
 *   - Withdrawable balance tracks internal ledger, NOT on-chain balance
 *   - No real USDC is ever moved — this is a simulation
 *   - Every receipt includes a simulation transparency block
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly explorer: ExplorerService,
  ) {}

  /**
   * Calculate the withdrawable balance for a wallet address.
   *
   * withdrawable = SUM(completed SettlementRecipient CREATOR amounts)
   *             - SUM(completed Withdrawal amounts)
   *
   * This is an INTERNAL ledger — it NEVER touches the real on-chain balance.
   */
  async getWithdrawableBalance(walletAddress: string): Promise<Decimal> {
    // Find creator by wallet address
    const wallet = await this.prisma.wallet.findFirst({
      where: { walletAddress },
      select: { creatorId: true },
    });

    if (!wallet) {
      return new Prisma.Decimal(0);
    }

    // Total settled (CREATOR recipient, COMPLETED settlement)
    const settlementAgg = await this.prisma.settlementRecipient.aggregate({
      where: {
        walletAddress,
        recipientType: 'CREATOR',
        settlement: { status: 'COMPLETED' },
      },
      _sum: { amount: true },
    });

    // Total already withdrawn
    const withdrawalAgg = await this.prisma.withdrawal.aggregate({
      where: {
        creatorId: wallet.creatorId,
        status: WithdrawalStatus.COMPLETED,
      },
      _sum: { amount: true },
    });

    const totalSettled = settlementAgg._sum.amount ?? new Prisma.Decimal(0);
    const totalWithdrawn = withdrawalAgg._sum.amount ?? new Prisma.Decimal(0);

    return totalSettled.minus(totalWithdrawn);
  }

  /**
   * Generate a human-readable withdrawal reference.
   * Format: KRV-WD-YYYYMMDD-NNNNNN
   *
   * Example: KRV-WD-20260630-000001
   */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const last = await this.prisma.withdrawal.findFirst({
      where: { reference: { startsWith: `KRV-WD-${dateStr}-` } },
      orderBy: { createdAt: 'desc' },
      select: { reference: true },
    });

    let nextNum = 1;
    if (last) {
      const parts = last.reference.split('-');
      const lastNum = parseInt(parts[3] ?? '0', 10);
      nextNum = lastNum + 1;
    }

    return `KRV-WD-${dateStr}-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Build the most recent settlement tx hash for a wallet address.
   * Used to link the withdrawal receipt to the real settlement that funded it.
   */
  private async findRecentSettlementTxHash(
    walletAddress: string,
  ): Promise<{ txHash: string; explorerUrl: string } | null> {
    const recent = await this.prisma.settlementRecipient.findFirst({
      where: {
        walletAddress,
        recipientType: 'CREATOR',
        settlement: { status: 'COMPLETED' },
      },
      include: {
        settlement: {
          select: { txHash: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recent?.settlement?.txHash) return null;

    return {
      txHash: recent.settlement.txHash,
      explorerUrl: this.explorer.txUrl(recent.settlement.txHash),
    };
  }

  /**
   * Request a withdrawal.
   *
   * Flow:
   *   1. Validate input
   *   2. Check sufficient withdrawable balance
   *   3. Create Withdrawal (REQUESTED)
   *   4. Transition to PROCESSING
   *   5. Return receipt with status=PROCESSING
   *   (The COMPLETED transition happens lazily on GET /:id)
   */
  async requestWithdrawal(
    walletAddress: string,
    amount: number,
    destinationType: string,
    destinationAccount: string,
  ): Promise<Record<string, unknown>> {
    // Find creator
    const wallet = await this.prisma.wallet.findFirst({
      where: { walletAddress },
      select: { creatorId: true },
    });

    if (!wallet) {
      throw new DomainException(
        'WALLET_NOT_FOUND',
        'No wallet found for the given address. Connect a wallet first.',
        404,
      );
    }

    // Check balance
    const availableBalance = await this.getWithdrawableBalance(walletAddress);
    const amountDecimal = new Prisma.Decimal(amount);

    if (availableBalance.lessThan(amountDecimal)) {
      throw new DomainException(
        'INSUFFICIENT_BALANCE',
        `Insufficient withdrawable balance. Available: ${availableBalance.toFixed(2)} USDC, Requested: ${amountDecimal.toFixed(2)} USDC. ` +
          'Note: Withdrawable balance is calculated from completed settlements minus previous withdrawals.',
        400,
      );
    }

    // Generate reference
    const reference = await this.generateReference();

    // Find recent settlement tx for receipt
    const settlementInfo = await this.findRecentSettlementTxHash(walletAddress);

    // Create withdrawal (REQUESTED)
    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        creatorId: wallet.creatorId,
        amount: amountDecimal,
        destinationType,
        destinationAccount,
        reference,
        status: WithdrawalStatus.REQUESTED,
        settlementTxHash: settlementInfo?.txHash ?? null,
      },
    });

    // Transition to PROCESSING
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: WithdrawalStatus.PROCESSING },
    });

    const balanceAfter = availableBalance.minus(amountDecimal);

    this.logger.log(
      `Withdrawal REQUESTED → PROCESSING: ref=${reference}, amount=${amountDecimal.toFixed(2)} USDC, ` +
        `balanceBefore=${availableBalance.toFixed(2)}, balanceAfter=${balanceAfter.toFixed(2)}`,
    );

    return this.buildReceipt(
      withdrawal.id,
      reference,
      WithdrawalStatus.PROCESSING,
      amountDecimal,
      availableBalance,
      balanceAfter,
      destinationType,
      destinationAccount,
      settlementInfo?.txHash,
      settlementInfo?.explorerUrl,
      withdrawal.createdAt,
      null,
    );
  }

  /**
   * Get a withdrawal by ID with lazy status transition.
   *
   * If the withdrawal is in PROCESSING and enough time has elapsed,
   * it automatically transitions to COMPLETED.
   */
  async getWithdrawal(id: string): Promise<Record<string, unknown>> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    // Lazy transition: PROCESSING → COMPLETED after simulation delay
    let status = withdrawal.status;
    let completedAt = withdrawal.completedAt;

    if (
      status === WithdrawalStatus.PROCESSING &&
      Date.now() - withdrawal.createdAt.getTime() >= SIMULATION_DELAY_MS
    ) {
      completedAt = new Date();
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.COMPLETED,
          completedAt,
        },
      });
      status = WithdrawalStatus.COMPLETED;
      this.logger.log(
        `Withdrawal COMPLETED (lazy): ref=${withdrawal.reference}, id=${withdrawal.id}`,
      );
    }

    // Calculate available balances
    const wallet = await this.prisma.wallet.findFirst({
      where: { creatorId: withdrawal.creatorId },
      select: { walletAddress: true },
    });

    let balanceBefore = new Prisma.Decimal(0);
    if (wallet) {
      // For the receipt, we need what the balance was before this withdrawal.
      // We calculate it as: current withdrawable + this withdrawal amount.
      const currentAvailable = await this.getWithdrawableBalance(wallet.walletAddress);
      balanceBefore = currentAvailable.plus(withdrawal.amount);
    }

    const balanceAfter = balanceBefore.minus(withdrawal.amount);

    return this.buildReceipt(
      withdrawal.id,
      withdrawal.reference,
      status,
      withdrawal.amount,
      balanceBefore,
      balanceAfter,
      withdrawal.destinationType,
      withdrawal.destinationAccount,
      withdrawal.settlementTxHash ?? undefined,
      withdrawal.settlementTxHash ? this.explorer.txUrl(withdrawal.settlementTxHash) : undefined,
      withdrawal.createdAt,
      completedAt,
    );
  }

  /**
   * List withdrawals for a wallet address (paginated).
   */
  async listWithdrawals(
    walletAddress: string,
    page: number,
    limit: number,
  ): Promise<{
    address: string;
    withdrawals: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { walletAddress },
      select: { creatorId: true },
    });

    if (!wallet) {
      return { address: walletAddress, withdrawals: [], page, limit, total: 0 };
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { creatorId: wallet.creatorId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({
        where: { creatorId: wallet.creatorId },
      }),
    ]);

    const withdrawals = rows.map((w) => ({
      withdrawalId: w.id,
      reference: w.reference,
      status: w.status,
      amount: Number(w.amount),
      destinationType: w.destinationType,
      destinationAccount: w.destinationAccount,
      requestedAt: w.createdAt.toISOString(),
      completedAt: w.completedAt?.toISOString() ?? null,
      settlementTxHash: w.settlementTxHash,
      settlementExplorerUrl: w.settlementTxHash ? this.explorer.txUrl(w.settlementTxHash) : null,
    }));

    return {
      address: walletAddress,
      withdrawals,
      page,
      limit,
      total,
    };
  }

  /**
   * Build a complete withdrawal receipt with simulation transparency block.
   */
  private buildReceipt(
    withdrawalId: string,
    reference: string,
    status: WithdrawalStatus,
    amount: Decimal,
    availableBalanceBefore: Decimal,
    availableBalanceAfter: Decimal,
    destinationType: string,
    destinationAccount: string,
    settlementTxHash?: string,
    settlementExplorerUrl?: string,
    requestedAt?: Date,
    completedAt?: Date | null,
  ): Record<string, unknown> {
    return {
      withdrawalId,
      reference,
      status,
      amount: Number(amount),
      availableBalanceBefore: Number(availableBalanceBefore),
      availableBalanceAfter: Number(availableBalanceAfter),
      destinationType,
      destinationAccount,
      anchor: 'Mock Philippines Anchor',
      requestedAt: requestedAt?.toISOString() ?? new Date().toISOString(),
      completedAt: completedAt?.toISOString() ?? null,
      settlementTxHash: settlementTxHash ?? null,
      settlementExplorerUrl: settlementExplorerUrl ?? null,
      simulation: {
        mode: 'SIMULATED',
        message:
          'Bank payout is simulated. Settlement to creator wallet is real on Stellar Testnet.',
        realComponents: ['Settlement', 'Soroban', 'USDC', 'Explorer'],
        simulatedComponents: ['Anchor', 'Bank Transfer'],
      },
    };
  }
}
