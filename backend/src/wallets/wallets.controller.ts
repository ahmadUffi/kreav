import { Controller, Get, Logger, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import {
  WalletBalanceQueryDto,
  WalletTransactionsQueryDto,
  WalletBalanceResponseDto,
  WalletTransactionsResponseDto,
} from './dto';

/**
 * WalletsController — BE-008.
 *
 *   GET /wallet/balance        — query USDC balance via Horizon
 *   GET /wallet/transactions   — query settlement history from DB
 *
 * Both are read-only. No blockchain writes.
 * Non-custodial: the backend stores only public keys — never secret keys.
 *
 * Source: Kreav Backend PRD v3 — §9 Wallet APIs.
 */
@ApiTags('Wallet')
@Controller('wallet')
export class WalletsController {
  private readonly logger = new Logger(WalletsController.name);

  constructor(private readonly wallets: WalletsService) {}

  /**
   * GET /wallet/balance?address=<G...>
   *
   * Returns the live USDC balance for a Stellar wallet address,
   * queried directly from Horizon. Also reports trustline and
   * account-existence status.
   */
  @Get('balance')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get wallet USDC balance',
    description:
      'Returns the live USDC balance for a Stellar wallet address, queried from Horizon. ' +
      'Also reports whether the account exists and has a USDC trustline. ' +
      'Returns "0" for unfunded or untrustlined accounts. No blockchain write.',
  })
  @ApiQuery({
    name: 'address',
    description: 'Stellar wallet public key (G...)',
    required: true,
    example: 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: WalletBalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid address format — must be a valid Stellar G... key',
  })
  async getBalance(@Query() query: WalletBalanceQueryDto): Promise<WalletBalanceResponseDto> {
    this.logger.log(`GET /wallet/balance?address=${query.address}`);
    return this.wallets.getBalance(query.address);
  }

  /**
   * GET /wallet/transactions?address=<G...>&page=1&limit=20
   *
   * Returns paginated settlement transaction history for a wallet address.
   * Queries the Settlement + SettlementRecipient tables from the local DB.
   * Ordered newest-first.
   */
  @Get('transactions')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description:
      'Returns paginated settlement transactions for a wallet address. ' +
      'Queries the local Settlement database (not Horizon). Ordered newest-first. ' +
      'Includes both CREATOR and PLATFORM recipient entries.',
  })
  @ApiQuery({
    name: 'address',
    description: 'Stellar wallet public key (G...)',
    required: true,
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: WalletTransactionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid address format — must be a valid Stellar G... key',
  })
  async getTransactions(
    @Query() query: WalletTransactionsQueryDto,
  ): Promise<WalletTransactionsResponseDto> {
    this.logger.log(
      `GET /wallet/transactions?address=${query.address}&page=${query.page}&limit=${query.limit}`,
    );
    return this.wallets.getTransactions(query.address, query.page, query.limit);
  }
}
