-- AlterEnum
-- Migration: add REQUESTED, PROCESSING to WithdrawalStatus; remove PENDING
-- Step 1: Create new enum type
CREATE TYPE "WithdrawalStatus_new" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Step 2: Alter the column to use the new type
ALTER TABLE "withdrawals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "withdrawals" ALTER COLUMN "status" TYPE "WithdrawalStatus_new" USING ("status"::text::"WithdrawalStatus_new");
ALTER TABLE "withdrawals" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- Step 3: Drop old enum
DROP TYPE "WithdrawalStatus";

-- Step 4: Rename new enum
ALTER TYPE "WithdrawalStatus_new" RENAME TO "WithdrawalStatus";

-- AlterTable: add new columns
ALTER TABLE "withdrawals" ADD COLUMN "settlement_tx_hash" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN "destination_type" TEXT NOT NULL DEFAULT '';
ALTER TABLE "withdrawals" ADD COLUMN "destination_account" TEXT NOT NULL DEFAULT '';
ALTER TABLE "withdrawals" ADD COLUMN "reference" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN "completed_at" TIMESTAMP(3);

-- Add unique constraint on reference
UPDATE "withdrawals" SET "reference" = gen_random_uuid()::text WHERE "reference" IS NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "withdrawals_reference_key" ON "withdrawals"("reference");

-- Remove old tx_hash column
ALTER TABLE "withdrawals" DROP COLUMN "tx_hash";
