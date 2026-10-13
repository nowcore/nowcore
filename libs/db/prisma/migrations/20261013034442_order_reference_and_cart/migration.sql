-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cart_id" UUID;

-- Human-readable order references (NC-10427). A sequence, so concurrent
-- checkouts can never draw the same number.
CREATE SEQUENCE "order_reference_seq" START WITH 10427;
