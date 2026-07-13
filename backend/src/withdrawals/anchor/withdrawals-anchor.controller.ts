import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../../wallets/wallets.service';
import { JwtAuthGuard, type AuthUser } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { STELLAR_CONFIG, type StellarConfig } from '../../stellar/stellar.config';
import { SponsorshipService } from '../../stellar/sponsorship.service';
import { AnchorSep24Service } from './anchor-sep24.service';
import {
  AnchorBuildPaymentDto,
  AnchorInteractiveDto,
  AnchorSubmitPaymentDto,
  AnchorVerifyDto,
} from './anchor.dto';

/**
 * WithdrawalsAnchorController — Fase 2A real SEP-24 off-ramp (creator cash-out).
 *
 * Non-custodial: the creator signs the SEP-10 challenge and the USDC payment in
 * their own wallet (Freighter). The backend only PROXIES the anchor HTTP (so the
 * browser never hits a cross-origin host) and RECORDS the withdrawal. The anchor
 * JWT is passed back and forth via the `x-anchor-token` header, never persisted.
 *
 * Flow: auth/challenge → (Freighter sign) → auth/verify → interactive
 *   → (anchor KYC popup) → transaction (poll) → build-payment
 *   → (Freighter sign) → submit-payment → transaction (poll to completed).
 *
 * Gated by `anchorEnabled` (ANCHOR_ENABLED) — off by default so the simulated
 * withdrawal remains the fallback. ROADMAP Fase 2A.
 */
@ApiTags('Withdrawals (Anchor)')
@Controller('withdrawals/anchor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WithdrawalsAnchorController {
  private readonly logger = new Logger(WithdrawalsAnchorController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly anchor: AnchorSep24Service,
    private readonly sponsorship: SponsorshipService,
    @Inject(STELLAR_CONFIG) private readonly config: StellarConfig,
  ) {}

  @Post('auth/challenge')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Get a SEP-10 challenge for the creator wallet' })
  @ApiResponse({ status: 403, description: 'Anchor off-ramp disabled' })
  async challenge(@CurrentUser() user: AuthUser) {
    this.assertEnabled();
    const address = await this.wallets.getAddressForCreator(user.userId);
    return this.anchor.getAuthChallenge(address);
  }

  @Post('auth/verify')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Exchange the signed challenge for an anchor token' })
  async verify(@CurrentUser() _user: AuthUser, @Body() dto: AnchorVerifyDto) {
    this.assertEnabled();
    const token = await this.anchor.postAuthVerify(dto.signedXdr);
    return { token };
  }

  @Post('interactive')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Start an interactive USDC withdrawal' })
  async interactive(@CurrentUser() user: AuthUser, @Body() dto: AnchorInteractiveDto) {
    this.assertEnabled();
    const anchorToken = this.requireToken(dto.token);
    const address = await this.wallets.getAddressForCreator(user.userId);

    const { url, id } = await this.anchor.withdrawInteractive(anchorToken, {
      account: address,
      amount: dto.amount.toString(),
    });

    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        creatorId: user.userId,
        amount: new Prisma.Decimal(dto.amount),
        destinationType: 'ANCHOR',
        destinationAccount: this.config.anchorHomeDomain,
        reference: `KRV-WD-A-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: 'PROCESSING',
        anchorTransactionId: id,
      },
      select: { id: true },
    });

    this.logger.log(`Anchor withdrawal started: ${withdrawal.id} (anchorTx=${id})`);
    return { url, id, withdrawalId: withdrawal.id };
  }

  @Get('transaction/:id')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Poll a SEP-24 transaction and persist its status' })
  async transaction(@Param('id') id: string, @Query('token') token: string | undefined) {
    this.assertEnabled();
    const anchorToken = this.requireToken(token);
    const tx = await this.anchor.getTransaction(anchorToken, id);

    // Mirror the anchor status onto our Withdrawal row (idempotent on read).
    // Reconcile the amount to the anchor's authoritative `amount_in` — the
    // creator may have changed it in the anchor's own form (the Kreav amount is
    // only a prefill), so the record must reflect what actually moved.
    const status = this.anchor.mapStatus(tx.status);
    const data: { status: typeof status; completedAt: Date | null; amount?: Prisma.Decimal } = {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    };
    if (tx.amountIn) data.amount = new Prisma.Decimal(tx.amountIn);
    await this.prisma.withdrawal.updateMany({
      where: { anchorTransactionId: id },
      data,
    });

    return {
      status: tx.status,
      mappedStatus: status,
      withdrawAnchorAccount: tx.withdrawAnchorAccount,
      withdrawMemo: tx.withdrawMemo,
      withdrawMemoType: tx.withdrawMemoType,
      amountIn: tx.amountIn,
      moreInfoUrl: tx.moreInfoUrl,
    };
  }

  @Post('build-payment')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Build the unsigned USDC send to the anchor' })
  async buildPayment(@CurrentUser() user: AuthUser, @Body() dto: AnchorBuildPaymentDto) {
    this.assertEnabled();
    const anchorToken = this.requireToken(dto.token);
    const address = await this.wallets.getAddressForCreator(user.userId);

    const tx = await this.anchor.getTransaction(anchorToken, dto.id);
    if (!tx.withdrawAnchorAccount || !tx.amountIn) {
      throw new ForbiddenException(
        'Anchor is not ready for the transfer yet (no destination/amount) — poll until pending_user_transfer_start.',
      );
    }

    return this.sponsorship.buildWithdrawPayment({
      from: address,
      to: tx.withdrawAnchorAccount,
      amount: tx.amountIn,
      memo: tx.withdrawMemo,
      memoType: tx.withdrawMemoType,
    });
  }

  @Post('submit-payment')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Relay the creator-signed USDC send to the anchor' })
  async submitPayment(@CurrentUser() user: AuthUser, @Body() dto: AnchorSubmitPaymentDto) {
    this.assertEnabled();
    const address = await this.wallets.getAddressForCreator(user.userId);
    const txHash = await this.sponsorship.submitWithdrawPayment(dto.signedXdr, address);
    // Record the on-chain send hash so it surfaces in the wallet's Recent transactions.
    await this.prisma.withdrawal.updateMany({
      where: { anchorTransactionId: dto.id },
      data: { txHash },
    });
    return { txHash };
  }

  private assertEnabled(): void {
    if (!this.config.anchorEnabled) {
      throw new ForbiddenException('Anchor off-ramp is disabled (set ANCHOR_ENABLED=true)');
    }
  }

  private requireToken(token: string | undefined): string {
    if (!token) {
      throw new UnauthorizedException(
        'Missing x-anchor-token (authenticate with the anchor first)',
      );
    }
    return token;
  }
}
