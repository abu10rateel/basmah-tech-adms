/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubscriptionPlan {
  id: 'basic' | 'advanced' | 'enterprise';
  name: string;
  badgeName: string;
  description: string;
  rangeText: string;
  minEmployees: number;
  maxEmployees: number; // Infinity for unlimited
  monthlyPrice: number;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  basic: {
    id: 'basic',
    name: 'الباقة الأساسية',
    badgeName: 'الأساسية',
    description: 'نطاق عدد الموظفين المسموح به حتى 49 موظف',
    rangeText: 'حتى 49 موظف',
    minEmployees: 1,
    maxEmployees: 49,
    monthlyPrice: 150
  },
  advanced: {
    id: 'advanced',
    name: 'الباقة المتقدمة',
    badgeName: 'المتقدمة',
    description: 'نطاق عدد الموظفين المسموح به من 50 إلى 100 موظف',
    rangeText: '50 - 100 موظف',
    minEmployees: 50,
    maxEmployees: 100,
    monthlyPrice: 300
  },
  enterprise: {
    id: 'enterprise',
    name: 'باقة الشركات',
    badgeName: 'الشركات',
    description: 'الشركات غير المحدودة (مفتوحة - بدون حد أقصى)',
    rangeText: 'غير محدودة (مفتوحة)',
    minEmployees: 1,
    maxEmployees: Infinity,
    monthlyPrice: 600
  }
};

/**
 * Normalizes any plan string or package name into standard SubscriptionPlan object.
 */
export function getPlanInfo(planStr?: string): SubscriptionPlan {
  if (!planStr) return SUBSCRIPTION_PLANS.basic;
  const s = planStr.toLowerCase();
  
  if (s.includes('متقدمة') || s.includes('advanced') || s.includes('100')) {
    return SUBSCRIPTION_PLANS.advanced;
  }
  if (s.includes('شركات') || s.includes('enterprise') || s.includes('غير محدودة') || s.includes('مفتوحة')) {
    return SUBSCRIPTION_PLANS.enterprise;
  }
  return SUBSCRIPTION_PLANS.basic;
}

/**
 * Validates whether adding a new employee is allowed based on current count and active plan.
 */
export function validateEmployeeCountLimit(
  currentEmployeeCount: number,
  planStr?: string,
  isEditingExistingEmployee: boolean = false
): { allowed: boolean; maxAllowed: number; plan: SubscriptionPlan; message?: string } {
  const plan = getPlanInfo(planStr);

  // Editing existing employee is always allowed regardless of count
  if (isEditingExistingEmployee) {
    return { allowed: true, maxAllowed: plan.maxEmployees, plan };
  }

  if (currentEmployeeCount >= plan.maxEmployees) {
    return {
      allowed: false,
      maxAllowed: plan.maxEmployees,
      plan,
      message: `عذراً، لقد وصلت للحد الأقصى المسموح به للموظفين في (${plan.name} - ${plan.rangeText})، الحد الأقصى الحالي: ${plan.maxEmployees} عامل. يرجى ترقية الاشتراك لإضافة المزيد.`
    };
  }

  return {
    allowed: true,
    maxAllowed: plan.maxEmployees,
    plan
  };
}
