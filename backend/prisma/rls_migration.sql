-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockHistory" ENABLE ROW LEVEL SECURITY;

-- Create an application role for the API server
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shopapp') THEN
    CREATE ROLE shopapp LOGIN;
    GRANT CONNECT ON DATABASE postgres TO shopapp;
    GRANT USAGE ON SCHEMA public TO shopapp;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopapp;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shopapp;
  END IF;
END $$;

-- Shop: only admin can see Shop row itself (read-only through API)
CREATE POLICY shop_tenant_isolation ON "Shop"
  AS PERMISSIVE FOR ALL TO shopapp
  USING (id = current_setting('app.current_shop_id', TRUE));

-- User: scoped to shopId
CREATE POLICY user_tenant_isolation ON "User"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Category
CREATE POLICY category_tenant_isolation ON "Category"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Product
CREATE POLICY product_tenant_isolation ON "Product"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Customer
CREATE POLICY customer_tenant_isolation ON "Customer"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Supplier
CREATE POLICY supplier_tenant_isolation ON "Supplier"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Order
CREATE POLICY order_tenant_isolation ON "Order"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Purchase
CREATE POLICY purchase_tenant_isolation ON "Purchase"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- Expense
CREATE POLICY expense_tenant_isolation ON "Expense"
  AS PERMISSIVE FOR ALL TO shopapp
  USING ("shopId" = current_setting('app.current_shop_id', TRUE));

-- OrderItem: scoped through Order.shopId join
CREATE POLICY order_item_tenant_isolation ON "OrderItem"
  AS PERMISSIVE FOR ALL TO shopapp
  USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderItem"."orderId"
        AND o."shopId" = current_setting('app.current_shop_id', TRUE)
    )
  );

-- PurchaseItem: scoped through Purchase.shopId join
CREATE POLICY purchase_item_tenant_isolation ON "PurchaseItem"
  AS PERMISSIVE FOR ALL TO shopapp
  USING (
    EXISTS (
      SELECT 1 FROM "Purchase" p
      WHERE p.id = "PurchaseItem"."purchaseId"
        AND p."shopId" = current_setting('app.current_shop_id', TRUE)
    )
  );

-- StockHistory: scoped through Product.shopId join
CREATE POLICY stock_history_tenant_isolation ON "StockHistory"
  AS PERMISSIVE FOR ALL TO shopapp
  USING (
    EXISTS (
      SELECT 1 FROM "Product" pr
      WHERE pr.id = "StockHistory"."productId"
        AND pr."shopId" = current_setting('app.current_shop_id', TRUE)
    )
  );

-- Bypass RLS for superuser (Prisma migrations, admin scripts)
ALTER TABLE "Shop" FORCE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Purchase" FORCE ROW LEVEL SECURITY;

SELECT 'RLS migration complete.' AS status;
