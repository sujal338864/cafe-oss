# Database Changes for Menu Sync

## Added Models

### MenuSyncJob
Tracks the status and results of asynchronous background sync operations.
*   `status`: PENDING | PROCESSING | COMPLETED | FAILED
*   `mode`: ADDITIVE | REPLACE | PRICE_ONLY
*   `result`: JSON containing counts of created/updated items and error details per branch.

### BranchProductOverride
Stores local customizations made by individual branches that diverge from the HQ template.
*   `customPrice`: Overrides the template selling price.
*   `customIsActive`: Overrides template availability.

## Modified Models

### MenuTemplate
*   Added `description`.
*   Added `syncJobs` relation.

### Organization
*   Added `menuSyncJobs` relation back-reference.

### Shop
*   Added `productOverrides` relation back-reference.

### Product
*   Added `overrides` relation back-reference.
