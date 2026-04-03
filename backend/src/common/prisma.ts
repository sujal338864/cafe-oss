import { PrismaClient } from '@prisma/client';

// Initialize the base client
export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

// Dedicated client for Analytics/Heavy queries to bypass Pooler (PgBouncer)
export const directPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});
