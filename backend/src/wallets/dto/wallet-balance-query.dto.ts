import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /wallet/balance.
 *
 * `address` is a Stellar public key (G...), validated by regex.
 * Source: Kreav Backend PRD v3 — §9 Wallet APIs.
 */
export class WalletBalanceQueryDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...) to query balance for',
    example: 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'address must be a valid Stellar public key starting with G',
  })
  address!: string;
}
