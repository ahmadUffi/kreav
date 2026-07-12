import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** POST /withdrawals/anchor/auth/verify — creator-signed SEP-10 challenge. */
export class AnchorVerifyDto {
  @ApiProperty({ description: 'The SEP-10 challenge XDR signed by the creator wallet' })
  @IsString()
  @IsNotEmpty()
  signedXdr!: string;
}

/** POST /withdrawals/anchor/interactive — start an interactive withdrawal. */
export class AnchorInteractiveDto {
  @ApiProperty({ description: 'Amount of USDC to withdraw', example: 11.4 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Anchor SEP-10 token from /auth/verify' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/** POST /withdrawals/anchor/build-payment — build the USDC send for a tx. */
export class AnchorBuildPaymentDto {
  @ApiProperty({ description: 'Anchor SEP-24 transaction id' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'Anchor SEP-10 token from /auth/verify' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/** POST /withdrawals/anchor/submit-payment — relay the creator-signed send. */
export class AnchorSubmitPaymentDto {
  @ApiProperty({ description: 'The USDC payment XDR signed by the creator wallet' })
  @IsString()
  @IsNotEmpty()
  signedXdr!: string;

  @ApiProperty({ description: 'Anchor SEP-24 transaction id (to record the tx hash against)' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
