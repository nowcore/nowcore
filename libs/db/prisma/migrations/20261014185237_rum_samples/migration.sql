-- CreateTable
CREATE TABLE "rum_samples" (
    "id" UUID NOT NULL,
    "beacon" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "cores" INTEGER,
    "memory_mb" INTEGER,
    "net" TEXT,
    "mobile" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rum_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rum_samples_metric_created_at_idx" ON "rum_samples"("metric", "created_at");

