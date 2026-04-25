
export const PLAN_LIMITS = {
  STARTER: {
    maxProducts: 100,
    maxBranches: 1,
    maxStaff: 3,
    features: {
      hqDashboard: false,
      menuSync: false,
      growthEngine: true,
      aiMarketing: false,
      qrOrdering: true
    }
  },
  PRO: {
    maxProducts: 1000,
    maxBranches: 5,
    maxStaff: 15,
    features: {
      hqDashboard: true,
      menuSync: true,
      growthEngine: true,
      aiMarketing: true,
      qrOrdering: true
    }
  },
  ENTERPRISE: {
    maxProducts: 10000,
    maxBranches: 100,
    maxStaff: 500,
    features: {
      hqDashboard: true,
      menuSync: true,
      growthEngine: true,
      aiMarketing: true,
      qrOrdering: true
    }
  }
};

export type PlanName = keyof typeof PLAN_LIMITS;
