
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ShopScalarFieldEnum = {
  id: 'id',
  name: 'name',
  ownerName: 'ownerName',
  phone: 'phone',
  email: 'email',
  gstNumber: 'gstNumber',
  address: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  currency: 'currency',
  timezone: 'timezone',
  logoUrl: 'logoUrl',
  plan: 'plan',
  planExpiry: 'planExpiry',
  isActive: 'isActive',
  pricingEnabled: 'pricingEnabled',
  pricingRules: 'pricingRules',
  invoiceSettings: 'invoiceSettings',
  loyaltyRate: 'loyaltyRate',
  redeemRate: 'redeemRate',
  invoiceCount: 'invoiceCount',
  mode: 'mode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  organizationId: 'organizationId'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  email: 'email',
  passwordHash: 'passwordHash',
  role: 'role',
  isEmailVerified: 'isEmailVerified',
  verifyToken: 'verifyToken',
  resetToken: 'resetToken',
  resetExpiry: 'resetExpiry',
  lastLogin: 'lastLogin',
  isActive: 'isActive',
  onboardingCompleted: 'onboardingCompleted',
  selectedMode: 'selectedMode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MembershipScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  shopId: 'shopId',
  role: 'role',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  color: 'color',
  order: 'order',
  createdAt: 'createdAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  categoryId: 'categoryId',
  name: 'name',
  sku: 'sku',
  barcode: 'barcode',
  description: 'description',
  costPrice: 'costPrice',
  sellingPrice: 'sellingPrice',
  taxRate: 'taxRate',
  stock: 'stock',
  lowStockAlert: 'lowStockAlert',
  unit: 'unit',
  imageUrl: 'imageUrl',
  isActive: 'isActive',
  isAvailable: 'isAvailable',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ComboScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  organizationId: 'organizationId',
  name: 'name',
  description: 'description',
  imageUrl: 'imageUrl',
  fixedPrice: 'fixedPrice',
  isActive: 'isActive',
  showInScanner: 'showInScanner',
  showInPOS: 'showInPOS',
  startTime: 'startTime',
  endTime: 'endTime',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ComboItemScalarFieldEnum = {
  id: 'id',
  comboId: 'comboId',
  productId: 'productId',
  quantity: 'quantity'
};

exports.Prisma.StockHistoryScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  type: 'type',
  quantity: 'quantity',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  phone: 'phone',
  email: 'email',
  address: 'address',
  gstNumber: 'gstNumber',
  outstandingBalance: 'outstandingBalance',
  totalPurchases: 'totalPurchases',
  loyaltyPoints: 'loyaltyPoints',
  walletBalance: 'walletBalance',
  campaignOptOut: 'campaignOptOut',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SupplierScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  phone: 'phone',
  email: 'email',
  address: 'address',
  gstNumber: 'gstNumber',
  outstandingBalance: 'outstandingBalance',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  customerId: 'customerId',
  userId: 'userId',
  invoiceNumber: 'invoiceNumber',
  subtotal: 'subtotal',
  taxAmount: 'taxAmount',
  discountAmount: 'discountAmount',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  paymentMethod: 'paymentMethod',
  paymentStatus: 'paymentStatus',
  status: 'status',
  kitchenStatus: 'kitchenStatus',
  notes: 'notes',
  couponId: 'couponId',
  couponDiscount: 'couponDiscount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  productId: 'productId',
  comboId: 'comboId',
  name: 'name',
  quantity: 'quantity',
  costPrice: 'costPrice',
  unitPrice: 'unitPrice',
  taxRate: 'taxRate',
  discount: 'discount',
  total: 'total'
};

exports.Prisma.PurchaseScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  supplierId: 'supplierId',
  billNumber: 'billNumber',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  paymentStatus: 'paymentStatus',
  purchaseDate: 'purchaseDate',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.PurchaseItemScalarFieldEnum = {
  id: 'id',
  purchaseId: 'purchaseId',
  productId: 'productId',
  quantity: 'quantity',
  costPrice: 'costPrice',
  total: 'total'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  category: 'category',
  amount: 'amount',
  description: 'description',
  date: 'date',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.CouponScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  code: 'code',
  type: 'type',
  value: 'value',
  minOrder: 'minOrder',
  maxUses: 'maxUses',
  usedCount: 'usedCount',
  isFirstOnly: 'isFirstOnly',
  isActive: 'isActive',
  expiresAt: 'expiresAt',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CouponUsageScalarFieldEnum = {
  id: 'id',
  couponId: 'couponId',
  customerId: 'customerId',
  orderId: 'orderId',
  discountApplied: 'discountApplied',
  createdAt: 'createdAt'
};

exports.Prisma.CampaignScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  targetSegment: 'targetSegment',
  message: 'message',
  type: 'type',
  status: 'status',
  scheduledAt: 'scheduledAt',
  sentCount: 'sentCount',
  couponId: 'couponId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoyaltyTierScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  name: 'name',
  minPoints: 'minPoints',
  discountRate: 'discountRate',
  badgeColor: 'badgeColor',
  createdAt: 'createdAt'
};

exports.Prisma.BrandProfileScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  brandType: 'brandType',
  toneOfVoice: 'toneOfVoice',
  targetAudience: 'targetAudience',
  primaryColor: 'primaryColor',
  secondaryColor: 'secondaryColor',
  logoUrl: 'logoUrl',
  socialLinks: 'socialLinks'
};

exports.Prisma.ScheduledContentScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  title: 'title',
  contentBody: 'contentBody',
  imageUri: 'imageUri',
  contentType: 'contentType',
  status: 'status',
  scheduledFor: 'scheduledFor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DailyMarketingIntelScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  date: 'date',
  planText: 'planText',
  keyFocus: 'keyFocus',
  actionItems: 'actionItems'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  logoUrl: 'logoUrl',
  plan: 'plan',
  isActive: 'isActive',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrgMembershipScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  shopId: 'shopId',
  userId: 'userId',
  orgRole: 'orgRole',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrgDailySnapshotScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  date: 'date',
  totalRevenue: 'totalRevenue',
  totalOrders: 'totalOrders',
  totalCustomers: 'totalCustomers',
  bestBranchId: 'bestBranchId',
  bestBranchRev: 'bestBranchRev',
  branchData: 'branchData',
  createdAt: 'createdAt'
};

exports.Prisma.MenuTemplateScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  description: 'description',
  items: 'items',
  isActive: 'isActive',
  syncMode: 'syncMode',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MenuSyncJobScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  templateId: 'templateId',
  targetBranchIds: 'targetBranchIds',
  mode: 'mode',
  status: 'status',
  result: 'result',
  error: 'error',
  scheduledFor: 'scheduledFor',
  completedAt: 'completedAt',
  createdAt: 'createdAt'
};

exports.Prisma.BranchProductOverrideScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  productId: 'productId',
  customPrice: 'customPrice',
  customIsActive: 'customIsActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BranchComboOverrideScalarFieldEnum = {
  id: 'id',
  shopId: 'shopId',
  comboId: 'comboId',
  customPrice: 'customPrice',
  customIsActive: 'customIsActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.Plan = exports.$Enums.Plan = {
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
};

exports.Role = exports.$Enums.Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
};

exports.StockType = exports.$Enums.StockType = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN'
};

exports.PaymentMethod = exports.$Enums.PaymentMethod = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  UNPAID: 'UNPAID'
};

exports.OrderStatus = exports.$Enums.OrderStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.KitchenStatus = exports.$Enums.KitchenStatus = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED'
};

exports.ExpenseCategory = exports.$Enums.ExpenseCategory = {
  RENT: 'RENT',
  ELECTRICITY: 'ELECTRICITY',
  SALARY: 'SALARY',
  MAINTENANCE: 'MAINTENANCE',
  MARKETING: 'MARKETING',
  TRANSPORT: 'TRANSPORT',
  OTHER: 'OTHER'
};

exports.CouponType = exports.$Enums.CouponType = {
  PERCENTAGE: 'PERCENTAGE',
  FLAT: 'FLAT',
  FIRST_ORDER: 'FIRST_ORDER'
};

exports.Prisma.ModelName = {
  Shop: 'Shop',
  User: 'User',
  Membership: 'Membership',
  Category: 'Category',
  Product: 'Product',
  Combo: 'Combo',
  ComboItem: 'ComboItem',
  StockHistory: 'StockHistory',
  Customer: 'Customer',
  Supplier: 'Supplier',
  Order: 'Order',
  OrderItem: 'OrderItem',
  Purchase: 'Purchase',
  PurchaseItem: 'PurchaseItem',
  Expense: 'Expense',
  Coupon: 'Coupon',
  CouponUsage: 'CouponUsage',
  Campaign: 'Campaign',
  LoyaltyTier: 'LoyaltyTier',
  BrandProfile: 'BrandProfile',
  ScheduledContent: 'ScheduledContent',
  DailyMarketingIntel: 'DailyMarketingIntel',
  Organization: 'Organization',
  OrgMembership: 'OrgMembership',
  OrgDailySnapshot: 'OrgDailySnapshot',
  MenuTemplate: 'MenuTemplate',
  MenuSyncJob: 'MenuSyncJob',
  BranchProductOverride: 'BranchProductOverride',
  BranchComboOverride: 'BranchComboOverride'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
