# Guided Onboarding Deep Analysis

## Current Login / Signup Flow
- **Signup (`/api/auth/register`)**: Currently tightly coupled. Requires `shopName`, `ownerName`, `email`, and `password` all upfront. It creates a `User`, a `Shop`, and a `Membership` simultaneously in a single database transaction. 
- **Login (`/api/auth/login`)**: Authenticates via `email` and returns the user object, their primary `shop`, an array of `memberships`, and the JWT token.
- **Frontend (`login/page.tsx`)**: The UI combines signup and login. Once the backend returns a token, `AuthContext` consumes it and forcefully redirects the user directly to `/dashboard`. There is no intermediate mode selection step.

## Current Shop Creation Logic
- The `User` model in `schema.prisma` strictly requires a `shopId` (`String`, non-nullable). This means every user in the system **must** belong to at least one valid shop at all times.
- Tenant isolation heavily relies on `req.user.shopId` existing to execute `withTenantContext`. 
- Creating an Organization via the newly added Dual Mode currently requires an active user who already has a shop.

## Current Dashboard Routing
- After login, the user hits `/dashboard`.
- Nested layouts (`/app/dashboard/layout.tsx`) query `AuthContext` to check role (`ADMIN`, `MANAGER`, `EMPLOYEE`) and filter sidebar navigation items accordingly.
- The `AuthContext` state currently drives UI access. There is no `onboardingCompleted` check that traps the user before they access dashboard tools.

## Reusable Components
- Our newly created Dual Mode `/onboarding` UI provides an excellent foundation. It has the mode selection cards (Independent vs. Franchise), subscription plan cards, and Organization setup forms.
- The `useAuth` hook and API service utility (`api.js`) can handle background profile updates.

## Risks
1. **Making `User.shopId` nullable could break existing endpoints**: Several middleware and APIs assume `req.user.shopId` is always a valid string. Modifying this in Prisma is highly risky.
2. **Infinite Redirect Loops**: If we trap users in `/onboarding` but fail to flag them as completed correctly, they will be blocked from the app entirely.
3. **Data Integrity**: If a user abandons the funnel halfway, their account must remain in a safe fallback state (e.g., defaulted to 'Independent').
4. **Existing Users**: The 15+ production shops must not see the onboarding screen. They need an automatic bypass.

## Best Integration Points
1. **Database Additions**: Add `onboardingCompleted Boolean @default(true)` to `User`. Existing users will default to `true` (skipping onboarding automatically). For new users during the signup endpoint, we explicitly pass `onboardingCompleted: false`.
2. **Signup Endpoint Bypass (`/api/auth/signup` vs `/register`)**: Keep `/register` untouched for any generic/legacy needs. We can update the frontend signup form to pass a generated placeholder shop name (e.g., `"Pending Setup"`) to satisfy the non-nullable `shopId` constraint, and then rename it during Step 4 of the onboarding wizard.
3. **Frontend Guarding**: Add a redirect check in `dashboard/layout.tsx` or `AuthContext` to intercept users hitting dashboard routes if `onboardingCompleted === false`.

## Safe Rollout Plan
1. **Phase 1: DB & Auth Additions**
   - Add `onboardingCompleted Boolean @default(true)` and `selectedMode String?` to User.
   - Run `prisma db push` (these are safe, additive fields).
2. **Phase 2: Auth Endpoints**
   - Update frontend Signup UI to require only Email/Password/Name initially. It will submit a placeholder `shopName = "My Business"` to the backend to fulfill the Prisma constraint.
   - Set `onboardingCompleted = false` for the new user.
3. **Phase 3: The Wizard UI**
   - Refine the `/onboarding` page to intercept this state.
   - **Step 1/2**: Mode Selection (Independent vs. Franchise).
   - **Step 3**: Plan Selection (showing mode-specific plans).
   - **Step 4**: Business Details Form. This API call will update the placeholder Shop name, optionally create an Organization (if Franchise), and set `onboardingCompleted = true`.
4. **Phase 4: Dashboard Middleware**
   - Update `AuthContext` and frontend routing to trap incomplete users and redirect them to `/onboarding`.
   - Implement the "Upgrade to Franchise" menu item for existing Independent users allowing safe migration to organizations later.
