import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body for GET /wallet/balance.
 *
 * Money is returned as a string ("9.50") per the global
 * DecimalToStringInterceptor convention.
 */
export class WalletBalanceResponseDto {
  @ApiProperty({
    description: 'The queried Stellar wallet address',
    example: 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B',
  })
  address!: string;

  @ApiProperty({
    description: 'USDC balance as a decimal string ("0" if none or unfunded)',
    example: '9.50',
  })
  balanceUsd!: string;

  @ApiProperty({
    description: 'Whether the account has a USDC trustline established',
    example: true,
  })
  hasUsdcTrustline!: boolean;

  @ApiProperty({
    description: 'Whether the account exists on the Stellar network (is funded)',
    example: true,
  })
  accountExists!: boolean;
}
