import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalDestination } from '../enums/withdrawal-destination.enum';

/**
 * Request body for POST /withdrawals.
 *
 * The `amount` is a JSON number (e.g. 5.00). Prisma stores it as Decimal(18,2)
 * and the global DecimalToStringInterceptor serializes it back to "5.00" in responses.
 *
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs (BE-009).
 */
export class WithdrawRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw in USDC',
    example: 5.0,
    minimum: 0.01,
    type: 'number',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount!: number;

  @ApiProperty({
    description: 'Destination type for the withdrawal',
    enum: WithdrawalDestination,
    example: WithdrawalDestination.GCASH,
  })
  @IsEnum(WithdrawalDestination, { message: 'destinationType must be a valid Southeast Asian payment method (GCASH, PAYMAYA, GOPAY, OVO, DANA, SHOPEEPAY, MOMO, ZALOPAY, TRUEMONEY, PROMPTPAY, TOUCHNGO, GRABPAY, PAYNOW, WAVEMONEY, WING, ABA, BANK)' })
  destinationType!: WithdrawalDestination;

  @ApiProperty({
    description: 'Destination account identifier (e.g. phone number, bank account)',
    example: '0917xxxxxxx',
  })
  @IsString()
  @IsNotEmpty({ message: 'destinationAccount must not be empty' })
  destinationAccount!: string;
}
