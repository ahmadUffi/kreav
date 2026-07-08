import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  WalletTransactionsQueryDto,
  WalletBalanceResponseDto,
  WalletTransactionsResponseDto,
} from './dto';

/**
 * WalletsController — BE-008 + Fase 1 (token-scoped identity).
 *
 *   GET /wallet/balance        — USDC balance of the creator's wallet (JWT)
 *   GET /wallet/transactions   — settlement history of the creator's wallet (JWT)
 *
 * Fase 1: the wallet address is resolved server-side from the authenticated
 * creator's connected wallet — the old `?address=` query param is gone.
 *
 * Both are read-only. No blockchain writes.
 * Non-custodial: the backend stores only public keys — never secret keys.
 *
 * Source: Kreav Backend PRD v3 — §9 Wallet APIs + ROADMAP Fase 1.
 */
@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsController {
  private readonly logger = new Logger(WalletsController.name);

  constructor(private readonly wallets: WalletsService) {}

  /**
   * GET /wallet/balance — live USDC balance of the authenticated creator's wallet.
   */
  @Get('balance')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get wallet USDC balance',
    description:
      "Returns the live USDC balance for the authenticated creator's connected " +
      'wallet, queried from Horizon. Also reports whether the account exists and ' +
      'has a USDC trustline. Returns "0" for unfunded or untrustlined accounts. ' +
      'No blockchain write. 404 if no wallet is connected.',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: WalletBalanceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  async getBalance(@CurrentUser() user: AuthUser): Promise<WalletBalanceResponseDto> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    this.logger.log(`GET /wallet/balance user=${user.userId} address=${address.slice(0, 8)}...`);
    return this.wallets.getBalance(address);
  }

  /**
   * GET /wallet/transactions — settlement history of the creator's wallet.
   */
  @Get('transactions')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description:
      "Returns paginated settlement transactions for the authenticated creator's " +
      'connected wallet. Queries the local Settlement database (not Horizon). ' +
      'Ordered newest-first. Includes both CREATOR and PLATFORM recipient entries. ' +
      '404 if no wallet is connected.',
  })
  @ApiQuery({ name: 'page', description: 'Page number (1-indexed)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: WalletTransactionsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: WalletTransactionsQueryDto,
  ): Promise<WalletTransactionsResponseDto> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    this.logger.log(
      `GET /wallet/transactions user=${user.userId} page=${query.page} limit=${query.limit}`,
    );
    return this.wallets.getTransactions(address, query.page, query.limit);
  }
}
