import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for POST /wallets.
 *
 * Returns the connected wallet record. Non-custodial: only the public key
 * is stored — never the secret key.
 *
 * Source: BE-020 — Wallet Connect API.
 */
export class ConnectWalletResponseDto {
  @ApiProperty({
    description: 'Wallet record ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Creator user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  creatorId!: string;

  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
  })
  walletAddress!: string;

  @ApiProperty({
    description: 'Wallet provider',
    example: 'FREIGHTER',
  })
  provider!: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp of when the wallet was connected',
    example: '2026-06-30T12:00:00.000Z',
  })
  connectedAt!: string;
}
