import { ApiProperty } from '@nestjs/swagger';

/**
 * A single transaction entry in the wallet transaction list.
 * Each entry represents one recipient's share of a settlement.
 */
class TransactionItemDto {
  @ApiProperty({ description: 'Settlement recipient record ID' })
  id!: string;

  @ApiProperty({ description: 'Related order ID (UUID)' })
  orderId!: string;

  @ApiProperty({
    description: 'Settlement transaction hash on Stellar',
    example: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090',
  })
  txHash!: string;

  @ApiProperty({
    description: 'Total settlement amount in USD',
    example: '10.00',
  })
  totalAmount!: string;

  @ApiProperty({
    description: 'Amount credited to this recipient in USD',
    example: '9.50',
  })
  amount!: string;

  @ApiProperty({
    description: 'Recipient type — CREATOR or PLATFORM',
    example: 'CREATOR',
  })
  recipientType!: string;

  @ApiProperty({
    description: 'Role label (e.g. "Author", "Platform Fee")',
    example: 'Author',
  })
  role!: string;

  @ApiProperty({
    description: 'Revenue percentage allocated to this recipient',
    example: '95.00',
  })
  percentage!: string;

  @ApiProperty({
    description: 'Settlement status (COMPLETED / FAILED / PENDING)',
    example: 'COMPLETED',
  })
  status!: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp of the settlement',
    example: '2026-06-29T12:00:00.000Z',
  })
  createdAt!: string;
}

/**
 * Response body for GET /wallet/transactions.
 */
export class WalletTransactionsResponseDto {
  @ApiProperty({
    description: 'The queried Stellar wallet address',
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
  })
  address!: string;

  @ApiProperty({
    description: 'Array of settlement transactions involving this wallet',
    type: [TransactionItemDto],
  })
  transactions!: TransactionItemDto[];

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total matching records', example: 5 })
  total!: number;
}
