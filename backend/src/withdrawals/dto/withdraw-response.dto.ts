import { ApiProperty } from '@nestjs/swagger';

/**
 * Simulation transparency block — clearly states what's real vs simulated.
 * Included in every withdrawal receipt to prevent misunderstanding during demos.
 */
class SimulationInfoDto {
  @ApiProperty({
    description: 'Simulation mode indicator',
    example: 'SIMULATED',
  })
  mode!: string;

  @ApiProperty({
    description:
      'Honest disclaimer about what is real and what is simulated in the withdrawal flow',
    example: 'Bank payout is simulated. Settlement to creator wallet is real on Stellar Testnet.',
  })
  message!: string;

  @ApiProperty({
    description: 'Components that are REAL on-chain operations',
    example: ['Settlement', 'Soroban', 'USDC', 'Explorer'],
  })
  realComponents!: string[];

  @ApiProperty({
    description: 'Components that are SIMULATED for the MVP',
    example: ['Anchor', 'Bank Transfer'],
  })
  simulatedComponents!: string[];
}

/**
 * Withdrawal receipt returned by POST /withdrawals and GET /withdrawals/:id.
 *
 * Includes both the withdrawal details and a simulation transparency block
 * so judges and users clearly understand what is real vs simulated.
 *
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs (BE-009).
 */
export class WithdrawResponseDto {
  @ApiProperty({
    description: 'Unique withdrawal ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  withdrawalId!: string;

  @ApiProperty({
    description: 'Human-readable withdrawal reference',
    example: 'KRV-WD-20260630-000001',
  })
  reference!: string;

  @ApiProperty({ description: 'Current withdrawal status', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ description: 'Withdrawal amount in USDC', example: 5.0 })
  amount!: number;

  @ApiProperty({
    description: 'Available withdrawable balance before this withdrawal',
    example: 9.5,
  })
  availableBalanceBefore!: number;

  @ApiProperty({
    description: 'Available withdrawable balance after this withdrawal',
    example: 4.5,
  })
  availableBalanceAfter!: number;

  @ApiProperty({ description: 'Destination type', example: 'GCASH' })
  destinationType!: string;

  @ApiProperty({ description: 'Destination account identifier', example: '0917xxxxxxx' })
  destinationAccount!: string;

  @ApiProperty({ description: 'Mock Anchor name', example: 'Mock Philippines Anchor' })
  anchor!: string;

  @ApiProperty({ description: 'ISO-8601 timestamp when withdrawal was requested' })
  requestedAt!: string;

  @ApiProperty({ description: 'ISO-8601 timestamp when withdrawal completed', nullable: true })
  completedAt!: string | null;

  @ApiProperty({
    description: 'Settlement transaction hash on Stellar (REAL on-chain)',
    example: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090',
  })
  settlementTxHash!: string;

  @ApiProperty({
    description: 'Stellar.expert explorer URL for the settlement transaction',
    example:
      'https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090',
  })
  settlementExplorerUrl!: string;

  @ApiProperty({
    description: 'Transparency block — clearly indicates which parts are real vs simulated',
    type: SimulationInfoDto,
  })
  simulation!: SimulationInfoDto;
}
