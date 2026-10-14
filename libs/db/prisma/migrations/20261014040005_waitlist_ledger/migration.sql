-- DropForeignKey
ALTER TABLE "waitlist_subscriptions" DROP CONSTRAINT "waitlist_subscriptions_drop_id_fkey";

-- DropIndex
DROP INDEX "waitlist_subscriptions_email_drop_id_key";

-- AlterTable
ALTER TABLE "waitlist_subscriptions" DROP COLUMN "drop_id",
DROP COLUMN "notified_at",
ADD COLUMN     "unsubscribed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "drop_alerts" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "drop_id" UUID NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drop_alerts_drop_id_idx" ON "drop_alerts"("drop_id");

-- CreateIndex
CREATE UNIQUE INDEX "drop_alerts_subscription_id_drop_id_key" ON "drop_alerts"("subscription_id", "drop_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_subscriptions_email_key" ON "waitlist_subscriptions"("email");

-- AddForeignKey
ALTER TABLE "drop_alerts" ADD CONSTRAINT "drop_alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "waitlist_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_alerts" ADD CONSTRAINT "drop_alerts_drop_id_fkey" FOREIGN KEY ("drop_id") REFERENCES "drops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

