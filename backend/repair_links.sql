-- Link admin@cafeosz.com to the provided shops
INSERT INTO "ShopMember" ("id", "userId", "shopId", "role", "isActive", "joinedAt") 
SELECT 'cmmember'||md5(random()::text), u.id, s.id, 'ADMIN', true, now()
FROM "User" u, "Shop" s
WHERE u.email = 'admin@cafeosz.com' AND s.id IN ('cmmye4o5r00017rqu3ba8skxi', 'd8bd17c9-c001-4d56-8351-2c73214083d1')
ON CONFLICT DO NOTHING;

-- Ensure shops are isActive
UPDATE "Shop" SET "isActive" = true WHERE id IN ('cmmye4o5r00017rqu3ba8skxi', 'd8bd17c9-c001-4d56-8351-2c73214083d1');
