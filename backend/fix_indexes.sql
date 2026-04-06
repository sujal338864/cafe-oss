-- DropIndex
DROP INDEX "Order_createdAt_idx";

-- DropIndex
DROP INDEX "Order_shopId_invoiceNumber_key";

-- CreateIndex
CREATE INDEX "Customer_shopId_idx" ON "Customer"("shopId");

-- CreateIndex
CREATE INDEX "Expense_shopId_createdAt_idx" ON "Expense"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_shopId_invoiceNumber_idx" ON "Order"("shopId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_productId_idx" ON "OrderItem"("orderId", "productId");

-- CreateIndex
CREATE INDEX "Product_shopId_stock_idx" ON "Product"("shopId", "stock");

-- CreateIndex
CREATE INDEX "Product_shopId_isActive_stock_idx" ON "Product"("shopId", "isActive", "stock");

