import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
} from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawRequestDto } from './dto/withdraw-request.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';
import { WithdrawalListQueryDto } from './dto/withdrawal-list-query.dto';

/**
 * WithdrawalsController — BE-009.
 *
 * RESTful resource for simulated Anchor off-ramp withdrawals:
 *   POST /withdrawals     — request a withdrawal (returns 202 Accepted)
 *   GET  /withdrawals/:id — get withdrawal receipt (lazy status transition)
 *   GET  /withdrawals     — list withdrawals (paginated, by wallet address)
 *
 * The withdrawal is SIMULATED — no real USDC moves on-chain.
 * Settlement to the creator wallet is REAL (Soroban + Stellar Testnet).
 * Every receipt includes a simulation transparency block.
 *
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs (BE-009).
 */
@ApiTags('Withdrawals')
@Controller('withdrawals')
export class WithdrawalsController {
  private readonly logger = new Logger(WithdrawalsController.name);

  constructor(private readonly withdrawals: WithdrawalsService) {}

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
      "Initiates a simulated withdrawal from the creator's withdrawable balance. " +
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
        summary: 'GCash withdrawal',
        value: { amount: 5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' },
      },
      bank: {
        summary: 'Bank withdrawal',
        value: { amount: 10.0, destinationType: 'BANK', destinationAccount: '1234567890' },
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
  async requestWithdrawal(
    @Body() dto: WithdrawRequestDto,
    @Query('address') address: string,
  ): Promise<WithdrawResponseDto> {
    if (!address) {
      throw new NotFoundException('address query parameter is required');
    }
    this.logger.log(`POST /withdrawals?address=${address} amount=${dto.amount}`);
    return this.withdrawals.requestWithdrawal(
      address,
      dto.amount,
      dto.destinationType,
      dto.destinationAccount,
    ) as unknown as Promise<WithdrawResponseDto>;
  }

  /**
   * GET /withdrawals/:id — get withdrawal receipt.
   *
   * If the withdrawal is still PROCESSING and enough time has elapsed,
   * it lazily transitions to COMPLETED before returning.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get withdrawal receipt',
    description:
      'Returns a withdrawal receipt by ID. ' +
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
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found',
  })
  async getWithdrawal(@Param('id', new ParseUUIDPipe()) id: string): Promise<WithdrawResponseDto> {
    return this.withdrawals.getWithdrawal(id) as unknown as Promise<WithdrawResponseDto>;
  }

  /**
   * GET /withdrawals — list withdrawals for a wallet address (paginated).
   */
  @Get()
  @ApiOperation({
    summary: 'List withdrawals',
    description:
      'Returns paginated withdrawal history for a Stellar wallet address. ' +
      'Ordered newest-first.',
  })
  @ApiQuery({
    name: 'address',
    description: 'Stellar wallet public key (G...)',
    required: true,
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
  })
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
  async listWithdrawals(@Query() query: WithdrawalListQueryDto): Promise<{
    address: string;
    withdrawals: Record<string, unknown>[];
    page: number;
    limit: number;
    total: number;
  }> {
    return this.withdrawals.listWithdrawals(query.address, query.page, query.limit);
  }
}
