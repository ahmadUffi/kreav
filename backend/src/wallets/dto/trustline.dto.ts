import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTOs for the sponsored USDC-trustline flow (Fase 1.5).
 *
 *   POST /wallets/trustline/prepare → PrepareTrustlineResponseDto
 *   POST /wallets/trustline/submit  ← SubmitTrustlineDto → SubmitTrustlineResponseDto
 *
 * The platform sponsors the reserve and pays the fee; the creator only signs.
 */

/** Response of POST /wallets/trustline/prepare — a platform-signed tx to co-sign. */
export class PrepareTrustlineResponseDto {
  @ApiProperty({
    description: 'Base64 transaction XDR — already signed by the platform; the wallet co-signs it.',
    example: 'AAAAAgAAAAA...',
  })
  xdr!: string;

  @ApiProperty({
    description: 'Network passphrase the wallet must sign against.',
    example: 'Test SDF Network ; September 2015',
  })
  networkPassphrase!: string;

  @ApiProperty({
    description: 'Whether the transaction also creates the (previously unfunded) creator account.',
    example: true,
  })
  createsAccount!: boolean;
}

/** Body of POST /wallets/trustline/submit — the creator-signed XDR. */
export class SubmitTrustlineDto {
  @ApiProperty({
    description: 'The prepared transaction XDR after the wallet added its signature.',
    example: 'AAAAAgAAAAA...',
  })
  @IsString()
  @IsNotEmpty()
  signedXdr!: string;
}

/** Response of POST /wallets/trustline/submit. */
export class SubmitTrustlineResponseDto {
  @ApiProperty({
    description: 'On-chain transaction hash.',
    example: 'a1b2c3d4e5f6...',
  })
  txHash!: string;

  @ApiProperty({
    description: 'Block-explorer link for the transaction.',
    example: 'https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f6...',
  })
  explorerLink!: string;
}
