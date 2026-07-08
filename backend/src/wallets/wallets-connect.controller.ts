import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectWalletDto, ConnectWalletResponseDto } from './dto';

/**
 * WalletsConnectController — BE-020 + Fase 1 (token-scoped identity).
 *
 *   POST /wallets  — connect a Stellar wallet to the AUTHENTICATED creator (JWT)
 *
 * Separate from the @Controller('wallet') controller because the POST
 * lives at `/wallets` (plural, RESTful resource convention) while the
 * existing read endpoints use `/wallet/balance` and `/wallet/transactions`.
 *
 * Non-custodial: stores only the public key — never the secret key.
 *
 * Source: BE-020 — Wallet Connect API + ROADMAP Fase 1.
 */
@ApiTags('Wallet')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsConnectController {
  private readonly logger = new Logger(WalletsConnectController.name);

  constructor(private readonly wallets: WalletsService) {}

  /**
   * POST /wallets — connect a Stellar wallet to the authenticated creator.
   */
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Connect a Stellar wallet',
    description:
      'Connects a Stellar wallet address to the authenticated creator account ' +
      '(identity from the session JWT). ' +
      'Non-custodial: only the public key is stored — never the secret key. ' +
      'Validates that the wallet address is not already connected. ' +
      'Returns 409 Conflict if the wallet is already registered to another account.',
  })
  @ApiBody({
    type: ConnectWalletDto,
    description: 'Wallet connection payload',
    examples: {
      freighter: {
        summary: 'Freighter wallet',
        value: {
          walletAddress: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
          provider: 'FREIGHTER',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Wallet connected successfully',
    type: ConnectWalletResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid address format or missing fields',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({
    status: 404,
    description: 'Creator not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Wallet already connected to another account',
  })
  async connect(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConnectWalletDto,
  ): Promise<ConnectWalletResponseDto> {
    this.logger.log(`POST /wallets user=${user.userId} provider=${dto.provider}`);
    return this.wallets.connect(user.userId, dto.walletAddress, dto.provider);
  }
}
