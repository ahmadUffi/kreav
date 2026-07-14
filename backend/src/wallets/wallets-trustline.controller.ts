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
import { SponsorshipService } from '../stellar/sponsorship.service';
import { ExplorerService } from '../stellar/explorer.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrepareTrustlineResponseDto, SubmitTrustlineDto, SubmitTrustlineResponseDto } from './dto';

/**
 * WalletsTrustlineController — Fase 1.5 (sponsored onboarding).
 *
 *   POST /wallets/trustline/prepare — platform builds + signs a sponsored
 *        USDC-trustline tx for the authenticated creator's wallet.
 *   POST /wallets/trustline/submit  — relay the creator-signed tx on-chain.
 *
 * The platform pays the network fee AND sponsors the trustline reserve
 * (CAP-33), so a creator needs no XLM to start receiving settlements.
 * Non-custodial: the creator signs in their own wallet — the platform never
 * sees a secret key and only co-signs the exact tx it built.
 */
@ApiTags('Wallet')
@Controller('wallets/trustline')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsTrustlineController {
  private readonly logger = new Logger(WalletsTrustlineController.name);

  constructor(
    private readonly wallets: WalletsService,
    private readonly sponsorship: SponsorshipService,
    private readonly explorer: ExplorerService,
  ) {}

  /**
   * POST /wallets/trustline/prepare — build a platform-signed sponsored
   * trustline tx for the authenticated creator's connected wallet.
   */
  @Post('prepare')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Prepare a sponsored USDC trustline',
    description:
      'Builds a transaction that establishes a USDC trustline on the authenticated ' +
      "creator's connected wallet, with the reserve sponsored and the fee paid by " +
      'the platform (CAP-33). The transaction is already signed by the platform; the ' +
      'wallet only needs to add its signature and POST it back to /submit. ' +
      '409 if the wallet already has a USDC trustline.',
  })
  @ApiCreatedResponse({
    description: 'Prepared, platform-signed transaction',
    type: PrepareTrustlineResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  @ApiResponse({ status: 409, description: 'Wallet already has a USDC trustline' })
  async prepare(@CurrentUser() user: AuthUser): Promise<PrepareTrustlineResponseDto> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    this.logger.log(`POST /wallets/trustline/prepare user=${user.userId}`);
    return this.sponsorship.prepareSponsoredTrustline(address);
  }

  /**
   * POST /wallets/trustline/submit — relay the creator-signed tx.
   */
  @Post('submit')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Submit a sponsored USDC trustline',
    description:
      'Relays the platform-prepared, creator-signed trustline transaction to the ' +
      'network. The backend re-validates that the XDR is exactly the sponsored ' +
      "trustline it prepared for this creator's wallet before submitting.",
  })
  @ApiBody({ type: SubmitTrustlineDto })
  @ApiCreatedResponse({
    description: 'Trustline established on-chain',
    type: SubmitTrustlineResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Malformed or mismatched transaction' })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'No wallet connected to this account' })
  async submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitTrustlineDto,
  ): Promise<SubmitTrustlineResponseDto> {
    const address = await this.wallets.getAddressForCreator(user.userId);
    this.logger.log(`POST /wallets/trustline/submit user=${user.userId}`);
    const txHash = await this.sponsorship.submitSponsoredTrustline(dto.signedXdr, address);
    return { txHash, explorerLink: this.explorer.txUrl(txHash) };
  }
}
