# API Plan — Central Menu Sync

## 1. Template Management
*   **GET** `/api/org/:orgId/menu-templates`: Fetch all active templates for an organization.
*   **POST** `/api/org/:orgId/menu-templates`: Create a new template with product JSON items.
*   **PUT** `/api/org/:orgId/menu-templates/:id`: Update template definition or items.

## 2. Sync Operations (Async)
*   **POST** `/api/org/:orgId/menu-templates/:id/sync`: 
    *   Initiate a background sync job.
    *   Payload: `{ branchIds: string[], mode: 'ADDITIVE' | 'REPLACE' | 'PRICE_ONLY' }`.
    *   Returns: `{ jobId: string }`.

## 3. Monitoring & Audit
*   **GET** `/api/org/:orgId/menu-sync-jobs`: Retrieve the list of recent sync jobs and their status.
*   **GET** `/api/org/:orgId/menu-sync-jobs/:id`: Fetch detailed results for a specific job (including per-branch success/fail details).
