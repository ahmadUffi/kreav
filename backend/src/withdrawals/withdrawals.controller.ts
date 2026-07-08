import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiAcceptedResponse,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { WalletsService } from '../wallets/wallets.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WithdrawRequestDto } from './dto/withdraw-request.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';
import { WithdrawalListQueryDto } from './dto/withdrawal-list-query.dto';

/**
 * WithdrawalsController — BE-009 + Fase 1 (token-scoped identity).
 *
 * RESTful resource for simulated Anchor off-ramp withdrawals:
 *   POST /withdrawals     — request a withdrawal (JWT; returns 202 Accepted)
 *   GET  /withdrawals/:id — get withdrawal receipt (JWT; owner only)
 *   GET  /withdrawals     — list withdrawals (JWT; paginated)
 *
 * Fase 1: the wallet address is resolved server-side from the authenticated
 * creator's connected wallet — the old `?address=` query param is gone.
 *
 * The withdrawal is SIMULATED — no real USDC moves on-chain.
 * Settlement to the creator wallet is REAL (Soroban + Stellar Testnet).
 * Every receipt includes a simulation transparency block.
 *
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs (BE-009) + ROADMAP Fase 1.
 */
@ApiTags('Withdrawals')
@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WithdrawalsController {
  private readonly logger = new Logger(WithdrawalsController.name);

  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly wallets: WalletsService,
  ) {}

  /**
   * POST /withdrawals — request a simulated withdrawal.
   *
   * Returns 202 Accepted with the current receipt (status = PROCESSING).
   * The transition to COMPLETED happens lazily when GET /withdrawals/:id is called
   * after the simulation delay (~2.5s).
   */
  @Post()
  @HttpCode(202)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Request a withdrawal (simulated Anchor off-ramp)',
    description:
      "Initiates a simulated withdrawal from the authenticated creator's withdrawable balance. " +
      'Returns 202 Accepted immediately with status=PROCESSING. ' +
      'The transition to COMPLETED occurs lazily when GET /withdrawals/:id is called ' +
      'after the simulation delay (~2.5 seconds). ' +
      'The withdrawal is SIMULATED — no real USDC moves on-chain. ' +
      'Settlement to the creator wallet IS real (Soroban + Stellar Testnet).',
  })
  @ApiBody({
    type: WithdrawRequestDto,
    description: 'Withdrawal request payload',
    examples: {
      gcash: {
        summary: '🇵🇭 GCash withdrawal (Philippines)',
        value: { amount: 5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' },
      },
      gopay: {
        summary: '🇮🇩 GoPay withdrawal (Indonesia)',
        value: { amount: 10.0, destinationType: 'GOPAY', destinationAccount: '0812xxxxxxx' },
      },
      paynow: {
        summary: '🇸🇬 PayNow withdrawal (Singapore)',
        value: { amount: 3.5, destinationType: 'PAYNOW', destinationAccount: '91234567' },
      },
    },
  })
  @ApiAcceptedResponse({
    description: 'Withdrawal accepted and processing',
    type: WithdrawResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request — validation error or insufficient balance',
    schema: {
      example: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient withdrawable balance. Available: 4.50 USDC, Requested: 10.00 USDC.',
        statusCode: 400,
        timestamp: '2026-06-30T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  async requestWithdrawal(
    @CurrentUser() user: AuthUser,
    @Body() dto: WithdrawRequestDto,
  ): Promise<WithdrawResponseDto> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    this.logger.log(`POST /withdrawals user=${user.userId} amount=${dto.amount}`);
    return this.withdrawals.requestWithdrawal(
      address,
      dto.amount,
      dto.destinationType,
      dto.destinationAccount,
    ) as unknown as Promise<WithdrawResponseDto>;
  }

  /**
   * GET /withdrawals/:id — get withdrawal receipt (owner only).
   *
   * If the withdrawal is still PROCESSING and enough time has elapsed,
   * it lazily transitions to COMPLETED before returning.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get withdrawal receipt',
    description:
      'Returns a withdrawal receipt by ID (only for the authenticated creator — ' +
      "another creator's receipt returns 404). " +
      'If the withdrawal is in PROCESSING status and the simulation delay (~2.5s) has elapsed, ' +
      'it automatically transitions to COMPLETED before returning (lazy transition). ' +
      'The receipt includes the simulation transparency block.',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal receipt',
    type: WithdrawResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found (or owned by another creator)',
  })
  async getWithdrawal(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WithdrawResponseDto> {
    return this.withdrawals.getWithdrawal(
      id,
      user.userId,
    ) as unknown as Promise<WithdrawResponseDto>;
  }

  /**
   * GET /withdrawals — list withdrawals for the authenticated creator (paginated).
   */
  @Get()
  @ApiOperation({
    summary: 'List withdrawals',
    description:
      "Returns paginated withdrawal history for the authenticated creator's " +
      'connected wallet. Ordered newest-first. 404 if no wallet is connected.',
  })
  @ApiQuery({ name: 'page', description: 'Page number (1-indexed)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of withdrawals',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' },
        withdrawals: { type: 'array' },
        page: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  async listWithdrawals(
    @CurrentUser() user: AuthUser,
    @Query() query: WithdrawalListQueryDto,
  ): Promise<{
    address: string;
    withdrawals: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    return this.withdrawals.listWithdrawals(address, query.page, query.limit);
  }
}
