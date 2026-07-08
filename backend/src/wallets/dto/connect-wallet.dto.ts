import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletProvider } from '@prisma/client';

/**
 * Body for POST /wallets.
 *
 * Connects a Stellar wallet address to the AUTHENTICATED creator account
 * (Fase 1: creator identity comes from the session JWT, not the body).
 * Non-custodial: only the public key is stored — never the secret key.
 *
 * Source: BE-020 — Wallet Connect API + ROADMAP Fase 1.
 */
export class ConnectWalletDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...)',
    required: true,
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key starting with G',
  })
  walletAddress!: string;

  @ApiProperty({
    description: 'Wallet provider extension',
    enum: WalletProvider,
    required: true,
    example: 'FREIGHTER',
  })
  @IsEnum(WalletProvider, { message: 'provider must be FREIGHTER or LOBSTR' })
  provider!: WalletProvider;
}
