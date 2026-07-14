-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN     "anchor_transaction_id" TEXT,
ALTER COLUMN "destination_type" DROP DEFAULT,
ALTER COLUMN "destination_account" DROP DEFAULT;
