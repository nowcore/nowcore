-- AlterTable
ALTER TABLE "trends" ADD COLUMN     "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "trend_clusters" (
    "key" TEXT NOT NULL,
    "status" "TrendStatus" NOT NULL,
    "drop_id" UUID,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_clusters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "trends_seen_at_idx" ON "trends"("seen_at");

-- AddForeignKey
ALTER TABLE "trend_clusters" ADD CONSTRAINT "trend_clusters_drop_id_fkey" FOREIGN KEY ("drop_id") REFERENCES "drops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

