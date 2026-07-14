-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accent" TEXT,
ADD COLUMN     "avatar_emoji" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
