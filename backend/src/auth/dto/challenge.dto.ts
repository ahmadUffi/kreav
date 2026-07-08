import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /auth/challenge — request a SEP-10 challenge transaction.
 *
 * Source: Fase 1 (Roadmap) — SEP-10 wallet auth for creators.
 */
export class ChallengeRequestDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...) that will sign the challenge',
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key (G...)',
  })
  walletAddress!: string;
}

/** Response for POST /auth/challenge. */
export class ChallengeResponseDto {
  @ApiProperty({
    description:
      'Base64 XDR of the SEP-10 challenge transaction (sign with Freighter, then POST /auth/verify)',
    example: 'AAAAAgAAAAB...',
  })
  transaction!: string;

  @ApiProperty({
    description: 'Network passphrase the challenge was built for',
    example: 'Test SDF Network ; September 2015',
  })
  networkPassphrase!: string;
}

/** Body for POST /auth/verify — the challenge signed by the wallet. */
export class VerifyRequestDto {
  @ApiProperty({
    description: 'Base64 XDR of the challenge transaction, signed by the client wallet',
    example: 'AAAAAgAAAAB...',
  })
  @IsString()
  @IsNotEmpty()
  transaction!: string;
}
