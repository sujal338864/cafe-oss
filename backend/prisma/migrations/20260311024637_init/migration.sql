/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_shopId_fkey";

-- DropForeignKey
ALTER TABLE "StockHistory" DROP CONSTRAINT "StockHistory_productId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_shopId_fkey";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "Subscription";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "SubStatus";

-- CreateIndex
CREATE INDEX "Category_shopId_idx" ON "Category"("shopId");

-- CreateIndex
CREATE INDEX "Customer_shopId_name_idx" ON "Customer"("shopId", "name");

-- CreateIndex
CREATE INDEX "Expense_shopId_category_idx" ON "Expense"("shopId", "category");

-- CreateIndex
CREATE INDEX "Order_shopId_status_idx" ON "Order"("shopId", "status");

-- CreateIndex
CREATE INDEX "Order_shopId_customerId_idx" ON "Order"("shopId", "customerId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Product_shopId_isActive_idx" ON "Product"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "Purchase_shopId_supplierId_idx" ON "Purchase"("shopId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "StockHistory_productId_createdAt_idx" ON "StockHistory"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_shopId_idx" ON "Supplier"("shopId");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- AddForeignKey
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
