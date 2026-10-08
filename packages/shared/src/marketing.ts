
export interface CustomerSegmentFilter {
  minTotalSpendMinor?: number; // In minor units (poisha)
  maxTotalSpendMinor?: number;
  minVisitCount?: number;
  maxVisitCount?: number;
  inactiveDays?: number; // Customers who have not visited in >= inactiveDays
  activeWithinDays?: number; // Customers who visited within the last X days
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  hasActiveSubscription?: boolean;
  branchId?: string;
  excludeOptedOut?: boolean;
}

export interface CustomerMarketingMetrics {
  customerId: string;
  totalSpendMinor: number;
  visitCount: number;
  lastVisitAt: Date | null;
  loyaltyPoints: number;
  hasActiveSubscription: boolean;
  preferredBranchId?: string | null;
  marketingOptOut: boolean;
}

/**
 * Pure evaluation function for customer segment matching.
 */
export function matchesSegmentFilter(
  metrics: CustomerMarketingMetrics,
  filter: CustomerSegmentFilter,
  now: Date = new Date(),
): boolean {
  // Opt-out check
  if (filter.excludeOptedOut !== false && metrics.marketingOptOut) {
    return false;
  }

  // Total spend check (minor units)
  if (filter.minTotalSpendMinor !== undefined && metrics.totalSpendMinor < filter.minTotalSpendMinor) {
    return false;
  }
  if (filter.maxTotalSpendMinor !== undefined && metrics.totalSpendMinor > filter.maxTotalSpendMinor) {
    return false;
  }

  // Visit count check
  if (filter.minVisitCount !== undefined && metrics.visitCount < filter.minVisitCount) {
    return false;
  }
  if (filter.maxVisitCount !== undefined && metrics.visitCount > filter.maxVisitCount) {
    return false;
  }

  // Inactive duration check
  if (filter.inactiveDays !== undefined) {
    if (!metrics.lastVisitAt) return true; // never visited counts as inactive
    const daysSinceLast = (now.getTime() - metrics.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < filter.inactiveDays) {
      return false;
    }
  }

  // Active within days check
  if (filter.activeWithinDays !== undefined) {
    if (!metrics.lastVisitAt) return false;
    const daysSinceLast = (now.getTime() - metrics.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast > filter.activeWithinDays) {
      return false;
    }
  }

  // Subscription check
  if (filter.hasActiveSubscription !== undefined) {
    if (metrics.hasActiveSubscription !== filter.hasActiveSubscription) {
      return false;
    }
  }

  // Branch check
  if (filter.branchId && metrics.preferredBranchId && metrics.preferredBranchId !== filter.branchId) {
    return false;
  }

  // Loyalty tier check
  if (filter.loyaltyTier) {
    const tier = resolveLoyaltyTier(metrics.loyaltyPoints);
    if (tier !== filter.loyaltyTier) {
      return false;
    }
  }

  return true;
}

export function resolveLoyaltyTier(points: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (points >= 10000) return 'platinum';
  if (points >= 5000) return 'gold';
  if (points >= 1000) return 'silver';
  return 'bronze';
}

export interface CampaignMessageData {
  campaignName: string;
  customerName: string;
  template: string;
  couponCode?: string;
  giftCardCode?: string;
  discountSummary?: string;
  unsubscribeUrl?: string;
}

export function renderCampaignMessage(
  template: string,
  data: CampaignMessageData,
): string {
  const rendered = template
    .replace(/\{\{customerName\}\}/g, data.customerName)
    .replace(/\{\{campaignName\}\}/g, data.campaignName)
    .replace(/\{\{couponCode\}\}/g, data.couponCode ?? '')
    .replace(/\{\{giftCardCode\}\}/g, data.giftCardCode ?? '')
    .replace(/\{\{discountSummary\}\}/g, data.discountSummary ?? '')
    .replace(/\{\{unsubscribeUrl\}\}/g, data.unsubscribeUrl ?? '');

  return rendered.trim();
}
