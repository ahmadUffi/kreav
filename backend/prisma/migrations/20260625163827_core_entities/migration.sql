-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CREATOR', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "WalletProvider" AS ENUM ('FREIGHTER', 'LOBSTR');

-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'CHECKOUT_STARTED', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'SETTLEMENT_PENDING', 'SETTLED', 'WITHDRAW_PENDING', 'WITHDRAW_COMPLETED', 'PAYMENT_FAILED', 'SETTLEMENT_FAILED', 'WITHDRAW_FAILED', 'WAITING_WALLET', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('CREATOR', 'PLATFORM', 'AFFILIATE', 'TREASURY');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_usd" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_collaborators" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "revenue_percentage" DECIMAL(5,2) NOT NULL,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "tx_hash" TEXT,
    "payment_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_recipients" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "recipient_type" "RecipientType" NOT NULL,
    "role" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "settlement_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "provider" "WalletProvider" NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "settlement_id" TEXT,
    "tx_hash" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "event" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "products_creator_id_idx" ON "products"("creator_id");

-- CreateIndex
CREATE INDEX "product_collaborators_product_id_status_idx" ON "product_collaborators"("product_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payment_ref_key" ON "orders"("payment_ref");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_order_id_key" ON "settlements"("order_id");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE INDEX "settlement_recipients_settlement_id_idx" ON "settlement_recipients"("settlement_id");

-- CreateIndex
CREATE INDEX "wallets_creator_id_idx" ON "wallets"("creator_id");

-- CreateIndex
CREATE INDEX "withdrawals_creator_id_created_at_idx" ON "withdrawals"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_event_idx" ON "notification_logs"("status", "event");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collaborators" ADD CONSTRAINT "product_collaborators_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_recipients" ADD CONSTRAINT "settlement_recipients_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
