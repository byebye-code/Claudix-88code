/**
 * 88code 订阅数据类型定义
 * 参考来源：88code-status-vscode-extension
 */

export interface Subscription {
  resetTimes: number;
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  currentCredits: number;
  subscriptionPlanId: number;
  subscriptionPlanName: string;
  cost: number;
  startDate: Date;
  endDate: Date;
  billingCycle: string;
  billingCycleDesc: string;
  remainingDays: number;
  subscriptionStatus: string;
  subscriptionPlan: SubscriptionPlan;
  isActive: boolean;
  autoRenew: boolean;
  autoResetWhenZero: boolean;
  lastCreditReset: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: number;
  subscriptionName: string;
  billingCycle: string;
  cost: number;
  features: string;
  hotTag: string;
  tokenLimit: number;
  concurrencyLimit: number;
  rateLimitRequests: number;
  creditLimit: number;
  creditsPerHour: number;
  dailyCostLimit: number;
  enableModelRestriction: boolean;
  planType: string;
}

/**
 * 额度变化记录
 */
export interface CreditChangeRecord {
  id: string;
  timestamp: number;
  previousCredits: number;
  currentCredits: number;
  change: number;
  subscriptionId: number;
  subscriptionName: string;
}
