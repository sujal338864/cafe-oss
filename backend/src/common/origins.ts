/**
 * Centralized Domain Whitelist for CORS
 * Shared between Express and Socket.io
 *
 * SECURITY: .netlify.app wildcard intentionally removed — any Netlify app
 * could exploit it for CSRF. Only the known Vercel project subdomain is allowed.
 */

export const ALLOWED_ORIGINS_SET = new Set([
  process.env.FRONTEND_URL,
  process.env.STAGING_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
].filter(Boolean) as string[]);

export const isAuthorizedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS_SET.has(origin)) return true;

  // Scoped Vercel preview deployments only — no broad netlify.app wildcard
  return origin.includes('sujal338864s-projects.vercel.app');
};

export const ALLOWED_ORIGINS_ARRAY = Array.from(ALLOWED_ORIGINS_SET);
